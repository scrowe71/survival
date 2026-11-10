# Bugging In — Digital Store Setup

GitHub → Cloudflare Pages, same as your other sites, with these extra pieces:

| Piece | What it does | Cost |
|---|---|---|
| **Stripe Checkout** | Takes the payment on Stripe's own secure page | 2.9% + 30¢ per sale |
| **Cloudflare R2** (private bucket) | Holds the book files. There is no public URL to them. | Free under 10 GB |
| **Cloudflare D1** (database) | Stores orders and download links | Free tier |
| **Resend** | Sends the download emails from your domain | Free up to 3,000/month |

## How it works
1. The buyer clicks **Buy now** and pays on Stripe.
2. Stripe tells your site the payment went through (`/api/stripe-webhook`). The site checks Stripe's signature, records the order and emails the buyer a link that is **unique to them**.
3. The link works for **60 minutes** and allows **3 downloads per file**, whichever runs out first.
4. After that, the buyer goes to **My downloads** (`/get-link.html`) and enters their email. If it matches a paid order, a fresh link goes to *that inbox*. Getting the email is what proves they bought the book.
5. Opening the link only shows a page with download buttons. The file comes from the button, so email virus scanners that "click" links automatically don't use up the buyer's downloads.

Settings such as price, link time, download limit and product files are all in **`functions/_lib/config.js`**.

---

## One-time setup (PowerShell)

You need Node.js installed (`node -v` should print a version).

### 1. GitHub repo
The repo is **`scrowe71/survival`**. The store code is on the **dev** branch; **main** only holds a placeholder until you promote dev. Get a local copy:
```powershell
cd $HOME\Documents
git clone https://github.com/scrowe71/survival.git
cd survival
git checkout dev
npm install
```
After that, `git pull origin dev` picks up any changes Claude pushes.

### 2. Cloudflare database and file storage
```powershell
npx wrangler login
npx wrangler d1 create survival-db
```
Copy the `database_id` it prints into **`wrangler.toml`** (replace `PASTE-DATABASE-ID-HERE`). Then:
```powershell
npx wrangler d1 migrations apply survival-db --remote
npx wrangler r2 bucket create survival-files
npx wrangler r2 object put survival-files/bugging-in.pdf  --file "C:\path\to\Bugging-In.pdf"  --remote
npx wrangler r2 object put survival-files/bugging-in.epub --file "C:\path\to\Bugging-In.epub" --remote
```
The file names (`bugging-in.pdf`, `bugging-in.epub`) must match the `key` values in `config.js`. To replace a file with a new edition, run the same command again. Never put the book files in the GitHub repo (`.gitignore` already blocks `.pdf` and `.epub`).

Commit the `wrangler.toml` change and push.

### 3. Cloudflare Pages project
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick `survival`.
- Production branch: **main**
- Build command: *(leave empty)*
- Output directory: **public**

The D1 and R2 connections come from `wrangler.toml` automatically.

### 4. Stripe
1. Create an account at stripe.com and complete business verification.
2. **Developers → API keys** → copy the **Secret key**.
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-SITE/api/stripe-webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the **Signing secret** (`whsec_...`).

### 5. Resend (email)
1. Sign up at resend.com → **Domains → Add domain** → it gives you DNS records. Add them in Cloudflare DNS.
2. **API Keys → Create** → copy the key.

> Until you buy a domain, Resend can only send test emails to your own address. A domain is required before going live.

### 6. Secrets in Cloudflare
Pages project → **Settings → Variables and Secrets**. Add these as **Secret** (encrypted):

| Name | Production (main) | Preview (dev) |
|---|---|---|
| `STRIPE_SECRET_KEY` | live key `sk_live_...` | test key `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | live webhook secret | test webhook secret |
| `RESEND_API_KEY` | `re_...` | `re_...` |

This fits your dev/main setup: the **dev** preview site uses Stripe **test mode** (pay with card `4242 4242 4242 4242`, any future date, any CVC), and **main** takes real money. Make one webhook in Stripe test mode pointing at the dev preview URL and one in live mode pointing at the real domain.

Also update `FROM_EMAIL` in `wrangler.toml` once you have the domain.

### 7. Custom domain
After buying the domain: Pages project → **Custom domains → Set up a domain**.

---

## Everyday tasks

**Change price or link rules:** edit `functions/_lib/config.js`, push to dev, test, then promote to main.

**Cut off a refunded buyer** (their links and resend requests stop working):
```powershell
npx wrangler d1 execute survival-db --remote --command "UPDATE orders SET refunded = 1 WHERE email = 'buyer@example.com'"
```

**See recent orders:**
```powershell
npx wrangler d1 execute survival-db --remote --command "SELECT id, email, amount_cents, datetime(created_at,'unixepoch') FROM orders ORDER BY id DESC LIMIT 20"
```

**Test locally:** copy `.dev.vars.example` to `.dev.vars`, then run `npm run db:local` and `npm run dev`. Open http://localhost:8788. Without a Resend key, emails print in the terminal.

## Good to know
- **Sales tax:** Indiana and many other states tax digital goods. Stripe Tax can collect it automatically. Check with a tax professional before launch.
- **What this can't stop:** a buyer can still forward a link within its 60 minutes, or share the file after downloading it. The limits make casual sharing hard, but no system can make a downloaded file uncopyable. If that matters to you, consider stamping each copy with the buyer's email (PDF watermarking) as a later upgrade.
