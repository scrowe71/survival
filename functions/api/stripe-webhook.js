import { PRODUCTS } from "../_lib/config.js";
import { now, normalizeEmail, safeEqual, siteUrl } from "../_lib/util.js";
import { emailLinks } from "../_lib/links.js";

// Stripe calls this URL after a payment. We verify Stripe signed it, record the order,
// and email the buyer their personal download link.
export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const ok = await verifyStripeSignature(payload, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  const relevant =
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!relevant) return new Response("ignored", { status: 200 });

  const s = event.data.object;
  const email = normalizeEmail(s.customer_details?.email || s.customer_email);
  const productId = s.metadata?.product_id;
  if (!email || !PRODUCTS[productId]) {
    console.error("Webhook missing email or product", s.id);
    return new Response("missing data", { status: 200 }); // don't make Stripe retry forever
  }

  // Idempotent: Stripe may deliver the same event more than once.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO orders (stripe_session_id, email, product_id, amount_cents, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(s.id, email, productId, s.amount_total ?? 0, s.currency ?? "usd", now())
    .run();

  const order = await env.DB.prepare("SELECT * FROM orders WHERE stripe_session_id = ?").bind(s.id).first();
  if (order.email_sent) return new Response("already handled", { status: 200 });

  try {
    await emailLinks(env, siteUrl(env, request), email, [order]);
    await env.DB.prepare("UPDATE orders SET email_sent = 1 WHERE id = ?").bind(order.id).run();
  } catch (err) {
    console.error("Email failed", err);
    return new Response("email failed", { status: 500 }); // Stripe will retry, and we'll try the email again
  }
  return new Response("ok", { status: 200 });
}

async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const signatures = header
    .split(",")
    .filter((p) => p.trim().startsWith("v1="))
    .map((p) => p.trim().slice(3));
  const t = parts.t;
  if (!t || !signatures.length) return false;
  if (Math.abs(now() - Number(t)) > 300) return false; // reject replays older than 5 minutes

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((sig) => safeEqual(sig, expected));
}
