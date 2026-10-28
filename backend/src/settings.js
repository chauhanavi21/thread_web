import { db } from './db.js';
import { HttpError } from './http.js';

// Everything the storefront shows or enforces that the admin can change. Each value is stored as JSON in the
// `settings` table; anything not yet saved falls back to these defaults.
// `kind` drives validation: text (string, optional max), int (whole number range), slug (product slug or empty), perks.
const FIELDS = {
  announcement: { kind: 'text', max: 160, default: '' },
  heroEyebrow: { kind: 'text', max: 60, default: 'New season · Fall 26' },
  heroTitle: { kind: 'text', max: 120, default: 'Clothes made to be *worn* on repeat' }, // *word* becomes the accent
  heroText: { kind: 'text', max: 240, default: 'Well-cut essentials in organic cotton, linen and wool, in colours that go with everything.' },
  heroProduct: { kind: 'slug', default: 'wrap-midi-dress' },
  bannerTitle: { kind: 'text', max: 120, default: 'Discover your new favourite in our *best sellers*' },
  bannerText: { kind: 'text', max: 240, default: 'The pieces our customers keep coming back for. Free shipping when your bag passes $100.' },
  bannerProduct: { kind: 'slug', default: 'shirt-dress' },
  perks: {
    kind: 'perks',
    default: [
      { title: 'Free shipping', text: 'On every order over $100' },
      { title: 'Honest fabrics', text: 'Organic cotton, linen and wool' },
      { title: 'Easy returns', text: '30 days, no questions asked' },
    ],
  },
  footerNote: { kind: 'text', max: 200, default: 'Demo store, so no real payments are taken. Photos from Unsplash.' },
  freeShippingOverCents: { kind: 'int', min: 0, max: 10_000_000, default: 10000 },
  flatShippingCents: { kind: 'int', min: 0, max: 100_000, default: 699 },
  maxQtyPerItem: { kind: 'int', min: 1, max: 100, default: 10 },
};

export function getSettings() {
  const out = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.default]));
  for (const { key, value } of db.prepare('SELECT key, value FROM settings').all()) {
    if (!(key in FIELDS)) continue; // internal rows (seed flags) are never exposed
    try {
      out[key] = JSON.parse(value);
    } catch {
      /* corrupt row: keep the default */
    }
  }
  return out;
}

function clean(key, value) {
  const f = FIELDS[key];
  switch (f.kind) {
    case 'text': {
      if (typeof value !== 'string') throw new HttpError(400, `${key} must be text.`);
      const v = value.trim();
      if (v.length > f.max) throw new HttpError(400, `${key} must be at most ${f.max} characters.`);
      return v;
    }
    case 'int': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < f.min || n > f.max) throw new HttpError(400, `${key} must be a whole number from ${f.min} to ${f.max}.`);
      return n;
    }
    case 'slug': {
      if (typeof value !== 'string') throw new HttpError(400, `${key} must be a product slug.`);
      const v = value.trim();
      if (v && !db.prepare('SELECT 1 FROM products WHERE slug = ?').get(v)) throw new HttpError(400, `No product with slug "${v}".`);
      return v;
    }
    case 'perks': {
      if (!Array.isArray(value) || value.length > 6) throw new HttpError(400, 'perks must be a list of up to 6 items.');
      return value.map((p) => {
        const title = typeof p?.title === 'string' ? p.title.trim() : '';
        const text = typeof p?.text === 'string' ? p.text.trim() : '';
        if (!title || title.length > 60 || text.length > 120) throw new HttpError(400, 'Each perk needs a title (max 60) and short text (max 120).');
        return { title, text };
      });
    }
    default:
      throw new HttpError(500, 'Unknown setting kind.');
  }
}

/** Validates every provided key first, then saves them together. Unknown keys are rejected. */
export function updateSettings(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new HttpError(400, 'Expected an object of settings.');
  const next = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in FIELDS)) throw new HttpError(400, `Unknown setting "${key}".`);
    next[key] = clean(key, value);
  }
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [key, value] of Object.entries(next)) upsert.run(key, JSON.stringify(value));
  return getSettings();
}
