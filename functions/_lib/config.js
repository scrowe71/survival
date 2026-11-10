// ─────────────────────────────────────────────────────────────
//  STORE CONFIG — the one file you edit to change products/prices
// ─────────────────────────────────────────────────────────────

export const SITE_NAME = "Bugging In"; // working title — change when the book has its final name

// How long a download link works, and how many downloads it allows (per file).
export const LINK_TTL_SECONDS = 60 * 60; // 60 minutes
export const MAX_DOWNLOADS_PER_FILE = 3;

// Anti-abuse limits for the "email me a new link" page.
export const LINK_REQUESTS_PER_EMAIL_PER_HOUR = 3;
export const LINK_REQUESTS_PER_IP_PER_HOUR = 10;

// Products. Prices are set HERE on the server, so nobody can change them in the browser.
// `files[].key` is the object name in your private R2 bucket.
export const PRODUCTS = {
  "bugging-in-ebook": {
    name: "Bugging In — eBook",
    description: "The complete guide to sheltering in place: PDF and EPUB editions.",
    priceCents: 1499, // $14.99
    currency: "usd",
    files: [
      { key: "bugging-in.pdf", downloadName: "Bugging-In.pdf", label: "PDF edition", type: "application/pdf" },
      { key: "bugging-in.epub", downloadName: "Bugging-In.epub", label: "EPUB edition (phones, Kobo, Apple Books)", type: "application/epub+zip" },
    ],
  },
};
