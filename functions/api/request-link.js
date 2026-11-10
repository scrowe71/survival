import { LINK_REQUESTS_PER_EMAIL_PER_HOUR, LINK_REQUESTS_PER_IP_PER_HOUR } from "../_lib/config.js";
import { json, now, normalizeEmail, isValidEmail, siteUrl } from "../_lib/util.js";
import { emailLinks } from "../_lib/links.js";

// POST /api/request-link { email }
// If that email has paid orders, a NEW 60-minute link is sent to that inbox.
// The reply is always the same, so nobody can use this form to find out who bought the book.
const GENERIC = { message: "If that email address has a purchase, a new download link is on its way. Check your inbox (and spam folder)." };

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return json({ error: "Please enter a valid email address." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const hourAgo = now() - 3600;

  const { byEmail, byIp } = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM link_requests WHERE email = ?1 AND created_at > ?3) AS byEmail,
       (SELECT COUNT(*) FROM link_requests WHERE ip = ?2 AND created_at > ?3) AS byIp`
  )
    .bind(email, ip, hourAgo)
    .first();

  if (byEmail >= LINK_REQUESTS_PER_EMAIL_PER_HOUR || byIp >= LINK_REQUESTS_PER_IP_PER_HOUR) {
    return json({ error: "Too many requests. Please wait an hour and try again." }, 429);
  }
  await env.DB.prepare("INSERT INTO link_requests (email, ip, created_at) VALUES (?, ?, ?)").bind(email, ip, now()).run();

  const { results: orders } = await env.DB.prepare("SELECT * FROM orders WHERE email = ? AND refunded = 0").bind(email).all();
  if (orders.length) {
    try {
      await emailLinks(env, siteUrl(env, request), email, orders, { isResend: true });
    } catch (err) {
      console.error("Resend email failed", err);
      return json({ error: "We couldn't send the email right now. Please try again in a few minutes." }, 502);
    }
  }
  return json(GENERIC);
}
