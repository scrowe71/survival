import { PRODUCTS } from "../_lib/config.js";
import { now, sha256Hex } from "../_lib/util.js";
import { page } from "../download/[token].js";

// POST /api/download (form: token, file) — streams the file from the private R2 bucket.
export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const fileIndex = Number(form.get("file") || 0);
  const tokenHash = await sha256Hex(token);

  // One atomic statement: only counts the download if the link is still valid and under its limit.
  const result = await env.DB.prepare(
    `UPDATE download_tokens SET uses = uses + 1
      WHERE token_hash = ? AND expires_at > ? AND uses < max_uses
        AND order_id IN (SELECT id FROM orders WHERE refunded = 0)`
  )
    .bind(tokenHash, now())
    .run();

  const back = `<h1>This link has expired or reached its limit</h1>
    <p><a class="btn" href="/get-link.html">Get a new download link</a></p>`;
  if (!result.meta.changes) return page("Link expired", back, 410);

  const row = await env.DB.prepare(
    "SELECT o.product_id FROM download_tokens t JOIN orders o ON o.id = t.order_id WHERE t.token_hash = ?"
  )
    .bind(tokenHash)
    .first();
  const file = PRODUCTS[row.product_id]?.files[fileIndex];
  if (!file) return page("Not found", "<h1>File not found</h1>", 404);

  const obj = await env.FILES.get(file.key);
  if (!obj) {
    console.error("Missing R2 object", file.key);
    return page("Unavailable", "<h1>That file is temporarily unavailable</h1><p>Please contact us and we'll sort it out.</p>", 500);
  }

  return new Response(obj.body, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(obj.size),
      "Content-Disposition": `attachment; filename="${file.downloadName}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
