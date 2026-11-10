-- Orders recorded from Stripe after payment
CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL,
  product_id        TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'usd',
  created_at        INTEGER NOT NULL,
  email_sent        INTEGER NOT NULL DEFAULT 0,
  refunded          INTEGER NOT NULL DEFAULT 0   -- set to 1 to cut off a refunded buyer
);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

-- One row per emailed link. Only the SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS download_tokens (
  token_hash TEXT PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  uses       INTEGER NOT NULL DEFAULT 0,
  max_uses   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_order ON download_tokens(order_id);

-- Rate limiting for the "send me a new link" form
CREATE TABLE IF NOT EXISTS link_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  ip         TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_linkreq_email ON link_requests(email, created_at);
CREATE INDEX IF NOT EXISTS idx_linkreq_ip ON link_requests(ip, created_at);
