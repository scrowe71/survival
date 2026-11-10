import { PRODUCTS, SITE_NAME } from "../_lib/config.js";
import { now, sha256Hex, escapeHtml } from "../_lib/util.js";

// GET /download/<token> — shows the download page.
// Opening this page does NOT use up a download. Email security scanners (Outlook, Gmail)
// often "click" links automatically; the actual file only comes from the button, which POSTs.
export async function onRequestGet({ params, env }) {
  const token = String(params.token || "");
  const row = await env.DB.prepare(
    `SELECT t.expires_at, t.uses, t.max_uses, o.product_id, o.refunded
       FROM download_tokens t JOIN orders o ON o.id = t.order_id
      WHERE t.token_hash = ?`
  )
    .bind(await sha256Hex(token))
    .first();

  const t = now();
  if (!row || row.refunded) return page("Link not valid", invalidBody("This download link isn't valid."), 404);
  if (row.expires_at <= t) return page("Link expired", invalidBody("This download link has expired (links last 60 minutes)."), 410);
  if (row.uses >= row.max_uses) return page("Download limit reached", invalidBody("This link has reached its download limit."), 410);

  const product = PRODUCTS[row.product_id];
  const minsLeft = Math.max(1, Math.ceil((row.expires_at - t) / 60));
  const buttons = product.files
    .map(
      (f, i) => `<form method="post" action="/api/download">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="file" value="${i}">
        <button class="btn" type="submit">Download ${escapeHtml(f.label)}</button>
      </form>`
    )
    .join("");

  return page(
    "Your download",
    `<h1>${escapeHtml(product.name)}</h1>
     <p>Your personal link is good for about <strong>${minsLeft} more minute${minsLeft === 1 ? "" : "s"}</strong>.</p>
     <div class="downloads">${buttons}</div>
     <p class="small">Save the files somewhere safe, like your computer, a USB drive or a printed copy. Need them again later? <a href="/get-link.html">Request a new link</a>.</p>`
  );
}

function invalidBody(msg) {
  return `<h1>${escapeHtml(msg)}</h1>
    <p>Already bought the book? Enter the email address you used at checkout and we'll send you a fresh link.</p>
    <p><a class="btn" href="/get-link.html">Get a new download link</a></p>`;
}

export function page(title, body, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)} · ${escapeHtml(SITE_NAME)}</title>
<link rel="stylesheet" href="/styles.css"></head>
<body><header class="bar"><a href="/" class="brand">${escapeHtml(SITE_NAME)}</a></header>
<main class="narrow card">${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }
  );
}
