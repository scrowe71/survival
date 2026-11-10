import { PRODUCTS } from "../_lib/config.js";
import { json, siteUrl } from "../_lib/util.js";

// POST /api/checkout  { productId }  →  { url }  (redirect the buyer to Stripe's hosted checkout)
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const product = PRODUCTS[body.productId];
  if (!product) return json({ error: "Unknown product" }, 404);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Store is not configured yet" }, 500);

  const base = siteUrl(env, request);
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${base}/thanks.html`,
    cancel_url: `${base}/#buy`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": product.currency,
    "line_items[0][price_data][unit_amount]": String(product.priceCents),
    "line_items[0][price_data][product_data][name]": product.name,
    "line_items[0][price_data][product_data][description]": product.description,
    "metadata[product_id]": body.productId,
    "payment_intent_data[metadata][product_id]": body.productId,
    customer_creation: "if_required",
    billing_address_collection: "auto",
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe checkout error", JSON.stringify(session));
    return json({ error: "Could not start checkout. Please try again." }, 502);
  }
  return json({ url: session.url });
}
