import { PRODUCTS, SITE_NAME, LINK_TTL_SECONDS, MAX_DOWNLOADS_PER_FILE } from "./config.js";
import { now, randomToken, sha256Hex, escapeHtml } from "./util.js";
import { sendEmail } from "./email.js";

// Creates a fresh, single-buyer token for one order. Returns the full download URL.
export async function issueLink(env, baseUrl, order) {
  const product = PRODUCTS[order.product_id];
  const token = randomToken();
  const t = now();
  await env.DB.prepare(
    "INSERT INTO download_tokens (token_hash, order_id, created_at, expires_at, uses, max_uses) VALUES (?, ?, ?, ?, 0, ?)"
  )
    .bind(await sha256Hex(token), order.id, t, t + LINK_TTL_SECONDS, MAX_DOWNLOADS_PER_FILE * (product?.files.length || 1))
    .run();
  return { url: `${baseUrl}/download/${token}`, productName: product?.name || order.product_id };
}

// Emails one message containing a fresh link for each of the buyer's orders.
export async function emailLinks(env, baseUrl, email, orders, { isResend = false } = {}) {
  const links = [];
  for (const order of orders) links.push(await issueLink(env, baseUrl, order));

  const minutes = Math.round(LINK_TTL_SECONDS / 60);
  const intro = isResend
    ? `Here is your new download link for ${SITE_NAME}.`
    : `Thank you for your purchase! Your copy of ${SITE_NAME} is ready.`;

  const text = [
    intro,
    "",
    ...links.map((l) => `${l.productName}: ${l.url}`),
    "",
    `This link is for you only and expires in ${minutes} minutes.`,
    `Need it again later? Request a new link any time at ${baseUrl}/get-link.html using this email address.`,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#f4f1ea;padding:24px;color:#222">
  <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #d9d2c0;padding:28px">
    <h2 style="margin-top:0;color:#3d4a2a">${escapeHtml(SITE_NAME)}</h2>
    <p>${escapeHtml(intro)}</p>
    ${links
      .map(
        (l) => `<p style="margin:24px 0"><a href="${l.url}" style="background:#3d4a2a;color:#fff;padding:12px 20px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Download: ${escapeHtml(l.productName)}</a></p>`
      )
      .join("")}
    <p style="font-size:14px;color:#555">This link is for you only and expires in <b>${minutes} minutes</b>.
    Need it again later? <a href="${baseUrl}/get-link.html">Request a new link</a> using this email address.</p>
  </div></body></html>`;

  await sendEmail(env, {
    to: email,
    subject: isResend ? `Your new ${SITE_NAME} download link` : `Your ${SITE_NAME} download`,
    html,
    text,
  });
}
