import { pathToFileURL } from 'node:url';
import { db, transaction } from './db.js';

const TOPS = ['XS', 'S', 'M', 'L', 'XL'];
const MEN_JEANS = ['28', '30', '32', '34', '36'];
const WOMEN_JEANS = ['24', '26', '28', '30', '32'];
const ONE = ['One size'];

const C = {
  white: ['White', '#f5f3ee'],
  black: ['Black', '#1c1c1e'],
  charcoal: ['Charcoal', '#3b3f45'],
  grey: ['Heather Grey', '#b8bbc0'],
  navy: ['Navy', '#1f2f4d'],
  sky: ['Sky Blue', '#8fb4d9'],
  sage: ['Sage', '#9caf88'],
  olive: ['Olive', '#6b6b3a'],
  sand: ['Sand', '#d9c7a5'],
  camel: ['Camel', '#b98a55'],
  rust: ['Rust', '#b4532a'],
  burgundy: ['Burgundy', '#6e1f2f'],
  blush: ['Blush', '#ecc3c0'],
  cream: ['Cream', '#f1e8d4'],
  indigo: ['Indigo Wash', '#2f4a73'],
  light: ['Light Wash', '#7fa0c4'],
  stone: ['Stone', '#cfc8bc'],
};

// [slug, name, category, type, price, rating, reviews, featured, colors, sizes, description, details]
const PRODUCTS = [
  // ---- Men ----
  ['essential-crew-tee', 'Essential Crew Tee', 'men', 't-shirts', 2800, 4.7, 934, 1, ['white', 'black', 'grey', 'navy', 'sage'], TOPS,
    'The everyday tee. A clean crew neck and a relaxed, true-to-size fit in a soft midweight cotton.',
    '100% organic cotton, 180 gsm. Machine wash cold, tumble dry low.'],
  ['boxy-pocket-tee', 'Boxy Pocket Tee', 'men', 't-shirts', 3400, 4.5, 412, 0, ['sand', 'olive', 'black', 'rust'], TOPS,
    'A slightly cropped, boxy cut with a chest pocket. Heavy enough to hang well, soft enough to live in.',
    '100% cotton, 220 gsm, garment dyed. Wash cold with similar colours.'],
  ['heavyweight-hoodie', 'Heavyweight Hoodie', 'men', 'hoodies', 7800, 4.8, 1268, 1, ['black', 'charcoal', 'sand', 'burgundy'], TOPS,
    'A thick brushed-back fleece hoodie with a double-layer hood and a kangaroo pocket. Built to last years.',
    '80% cotton, 20% recycled polyester, 450 gsm. Machine wash cold, hang to dry.'],
  ['zip-through-hoodie', 'Zip-Through Hoodie', 'men', 'hoodies', 7200, 4.4, 301, 0, ['grey', 'navy', 'olive'], TOPS,
    'Easy layering with a full-length zip and ribbed cuffs. Lighter than our pullover, so it works indoors too.',
    '85% cotton, 15% polyester, 380 gsm. Machine wash cold.'],
  ['oxford-button-down', 'Oxford Button-Down', 'men', 'shirts', 6400, 4.6, 523, 1, ['white', 'sky', 'stone'], TOPS,
    'A classic oxford shirt with a soft collar roll. Dress it up with chinos or throw it open over a tee.',
    '100% cotton oxford. Machine wash warm, iron on medium.'],
  ['linen-camp-shirt', 'Linen Camp Shirt', 'men', 'shirts', 6900, 4.5, 288, 0, ['sand', 'sage', 'navy'], TOPS,
    'Breezy short-sleeve shirt with a relaxed camp collar. Gets softer with every wash.',
    '100% European linen. Wash cold, line dry, wrinkles are part of the charm.'],
  ['straight-fit-jeans', 'Straight Fit Jeans', 'men', 'jeans', 8800, 4.6, 1105, 1, ['indigo', 'black', 'light'], MEN_JEANS,
    'Mid-rise with a straight leg from hip to hem. Rigid denim with just enough stretch to move in.',
    '98% cotton, 2% elastane, 12 oz denim. Wash inside out, cold.'],
  ['slim-tapered-jeans', 'Slim Tapered Jeans', 'men', 'jeans', 8400, 4.3, 462, 0, ['indigo', 'charcoal'], MEN_JEANS,
    'A slimmer thigh that tapers to the ankle. Sits just above the hip.',
    '97% cotton, 3% elastane, 11 oz denim. Wash cold.'],
  ['coach-jacket', 'Lightweight Coach Jacket', 'men', 'jackets', 9800, 4.5, 217, 0, ['navy', 'olive', 'black'], TOPS,
    'Water-resistant shell with snap buttons and a lined collar. Packs small, layers well.',
    '100% recycled nylon shell, cotton lining. Spot clean or wash cold.'],
  ['chino-shorts', 'Stretch Chino Shorts', 'men', 'shorts', 4800, 4.4, 389, 0, ['sand', 'navy', 'olive', 'stone'], TOPS,
    'Seven-inch inseam with a flat front and a touch of stretch. The summer default.',
    '97% cotton, 3% elastane twill. Machine wash cold.'],

  // ---- Women ----
  ['baby-tee', 'Fitted Baby Tee', 'women', 't-shirts', 2600, 4.6, 706, 1, ['white', 'black', 'blush', 'sage'], TOPS,
    'A cropped, close-fitting tee in a soft rib knit. Pairs with everything high-waisted.',
    '95% cotton, 5% elastane rib. Machine wash cold.'],
  ['wrap-midi-dress', 'Wrap Midi Dress', 'women', 'dresses', 8900, 4.7, 598, 1, ['rust', 'navy', 'sage', 'cream'], TOPS,
    'A flattering wrap silhouette with an adjustable tie waist and flutter sleeves. Falls mid-calf.',
    '100% viscose crepe. Dry clean or hand wash cold.'],
  ['satin-slip-dress', 'Satin Slip Dress', 'women', 'dresses', 7600, 4.4, 344, 0, ['black', 'blush', 'burgundy'], TOPS,
    'Bias-cut satin with adjustable straps and a subtle cowl neck. Wear it alone or over a tee.',
    '100% recycled polyester satin. Hand wash cold, hang dry.'],
  ['shirt-dress', 'Poplin Shirt Dress', 'women', 'dresses', 9200, 4.5, 261, 0, ['white', 'sky', 'stone'], TOPS,
    'Crisp cotton poplin with a self-belt and roll-up sleeves. Hits just below the knee.',
    '100% organic cotton poplin. Machine wash warm.'],
  ['chunky-knit-sweater', 'Chunky Knit Sweater', 'women', 'knitwear', 9400, 4.8, 812, 1, ['cream', 'camel', 'burgundy', 'sage'], TOPS,
    'An oversized, cozy crew in a chunky cable knit. Drop shoulders and a slightly cropped hem.',
    '60% merino wool, 40% cotton. Hand wash cold, dry flat.'],
  ['ribbed-cardigan', 'Ribbed Cardigan', 'women', 'knitwear', 7900, 4.5, 305, 0, ['grey', 'camel', 'black'], TOPS,
    'Soft ribbed button-front cardigan that works as a top or a layer.',
    '55% cotton, 45% viscose knit. Machine wash gentle.'],
  ['wide-leg-jeans', 'High-Rise Wide Leg Jeans', 'women', 'jeans', 9000, 4.7, 1042, 1, ['light', 'indigo', 'black'], WOMEN_JEANS,
    'A high rise and a full-length wide leg. Non-stretch rigid denim for a structured drape.',
    '100% cotton, 13 oz denim. Wash inside out, cold.'],
  ['mom-jeans', 'Relaxed Mom Jeans', 'women', 'jeans', 8200, 4.4, 520, 0, ['light', 'indigo'], WOMEN_JEANS,
    'Relaxed through the hip and thigh with a tapered leg and a cropped hem.',
    '99% cotton, 1% elastane. Machine wash cold.'],
  ['pleated-midi-skirt', 'Pleated Midi Skirt', 'women', 'skirts', 6800, 4.5, 276, 0, ['black', 'camel', 'sage', 'navy'], TOPS,
    'Knife pleats with an elasticated back waist so it moves when you do.',
    '100% recycled polyester. Machine wash cold, hang dry.'],
  ['classic-trench', 'Classic Trench Coat', 'women', 'jackets', 15800, 4.8, 433, 1, ['camel', 'black', 'stone'], TOPS,
    'Double-breasted, water-repellent cotton gabardine with a storm flap and a removable belt.',
    '100% cotton gabardine, polyester lining. Dry clean only.'],
  ['cropped-hoodie', 'Cropped Hoodie', 'women', 'hoodies', 6800, 4.3, 359, 0, ['blush', 'grey', 'black', 'cream'], TOPS,
    'A boxy cropped hoodie in brushed fleece, made to sit right at the waistband.',
    '80% cotton, 20% polyester, 400 gsm. Machine wash cold.'],

  // ---- Accessories ----
  ['dad-cap', 'Washed Cotton Cap', 'accessories', 'caps', 2800, 4.6, 640, 1, ['navy', 'sand', 'black', 'sage'], ONE,
    'Six-panel unstructured cap with a curved brim and a brass buckle adjuster.',
    '100% washed cotton twill. Spot clean.'],
  ['rib-beanie', 'Ribbed Merino Beanie', 'accessories', 'beanies', 3400, 4.7, 388, 0, ['charcoal', 'cream', 'burgundy', 'camel'], ONE,
    'A warm, fine-gauge rib beanie that stretches to fit. Not itchy.',
    '100% merino wool. Hand wash cold, dry flat.'],
  ['canvas-tote', 'Everyday Canvas Tote', 'accessories', 'bags', 3800, 4.5, 721, 1, ['cream', 'black', 'olive'], ONE,
    'Roomy heavy canvas tote with an inside zip pocket and reinforced handles.',
    '100% organic cotton canvas, 12 oz. Spot clean.'],
  ['wool-scarf', 'Brushed Wool Scarf', 'accessories', 'scarves', 4800, 4.4, 154, 0, ['camel', 'grey', 'burgundy'], ONE,
    'An oversized, brushed wool scarf with fringed ends.',
    '70% wool, 30% acrylic. Dry clean recommended.'],
];

/** Deterministic pseudo-random stock so a re-seed gives the same shop. About one in nine variants is sold out. */
function stockFor(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const n = (h >>> 0) % 18;
  return n < 2 ? 0 : n < 4 ? 2 + (n % 3) : 8 + n;
}

export function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0) return false;
  insertAll();
  return true;
}

function insertAll() {
  const insertProduct = db.prepare(`
    INSERT INTO products (slug, name, category, type, price_cents, rating, review_count, featured, description, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertVariant = db.prepare('INSERT INTO variants (product_id, color, color_hex, size, stock) VALUES (?, ?, ?, ?, ?)');
  transaction(() => {
    for (const [slug, name, category, type, price, rating, reviews, featured, colors, sizes, description, details] of PRODUCTS) {
      const { lastInsertRowid } = insertProduct.run(slug, name, category, type, price, rating, reviews, featured, description, details);
      for (const key of colors) {
        const [colorName, hex] = C[key];
        for (const size of sizes) insertVariant.run(lastInsertRowid, colorName, hex, size, stockFor(`${slug}/${colorName}/${size}`));
      }
    }
  });
}

// `npm run seed` wipes the catalog and reseeds. Existing orders keep their own item snapshots,
// so a reset is refused once any order references a variant.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--reset')) {
    const used = db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n;
    if (used > 0) {
      console.error('Refusing to reset: orders reference existing products. Delete data/threads.db to start over.');
      process.exit(1);
    }
    db.exec('DELETE FROM products');
  }
  console.log(seedIfEmpty() ? `Seeded ${PRODUCTS.length} products.` : 'Products already present; nothing to do.');
}
