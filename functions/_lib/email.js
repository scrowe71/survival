// Sends email through Resend (https://resend.com). If RESEND_API_KEY isn't set
// (local testing), the email is printed to the console instead of sent.
export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[DEV EMAIL] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html, text, reply_to: env.REPLY_TO_EMAIL || undefined }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}
