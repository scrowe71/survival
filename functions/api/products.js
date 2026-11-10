import { PRODUCTS } from "../_lib/config.js";
import { json } from "../_lib/util.js";

// Public product list (no file keys exposed).
export const onRequestGet = () =>
  json(
    Object.entries(PRODUCTS).map(([id, p]) => ({
      id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      currency: p.currency,
      formats: p.files.map((f) => f.label),
    }))
  );
