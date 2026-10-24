# Threads — clothing store

Full-stack demo e-commerce site for clothing. React (Vite) frontend, Node/Express + SQLite backend. Everything runs locally.

The look follows Dribbble fashion e-commerce references: warm cream paper, near-black ink, one terracotta accent, large Instrument Serif headings with italic highlights, rounded cards and real product photos. The layout is responsive from a 360px phone to a wide desktop.

## Run it

Needs Node 22.13+ (uses the built-in `node:sqlite`).

```powershell
# terminal 1 — API on http://localhost:4000
cd backend
npm install
npm run dev

# terminal 2 — site on http://localhost:5173
cd frontend
npm install
npm run dev
```

The catalog (25 pieces, 369 size/colour variants) is seeded on first start. `npm run seed` in `backend` resets it, unless orders already exist.

## Features

- Women, Men and Accessories, filtered by garment type, with search and sorting
- Colour swatches and a size picker on each product. Stock is tracked per size and colour, and sold-out sizes are crossed out
- Bag persisted in the browser, free shipping over $100
- Accounts (register / sign in, scrypt-hashed passwords, JWT sessions), checkout and order history
- Prices and stock are always checked on the server, and stock is taken in a transaction, so a rejected order changes nothing

## Notes

- **Payments are a local stand-in**: placing an order marks it `paid`. Real payment and email providers are intentionally not wired up.
- **Photos**: 20 of the 25 products use free Unsplash photos in `frontend/public/images/products/<slug>.jpg`. Some are close matches rather than exact: the trench is a blue coat, the cropped hoodie is a yellow set, the tote is a wicker bag and the sweater is a crochet poncho. Replace any file with the same name to change a picture.
- **Colour swatches** pick the size/colour variant for the bag and stock, but a photo shows one fixed colour, so the product page says the photo is for illustration.
- **Fallback drawings**: a product with no photo (shorts, baby tee, cardigan, mom jeans, scarf) shows a garment drawn as an SVG in the chosen colour (`GarmentDrawing.jsx`). Drop a `<slug>.jpg` in that folder and it switches to the photo automatically.
- The JWT signing key is generated into `backend/data/jwt.secret` (gitignored), or set `JWT_SECRET`.
- The database is `backend/data/threads.db` (gitignored). Delete it to start fresh.
- Motion respects the OS "reduce motion" setting.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/products` | `category`, `type`, `q`, `sort`, `featured=1`. Each product includes its `variants` |
| GET | `/api/products/meta` | categories and types with counts |
| GET | `/api/products/:slug` | includes `related` |
| POST | `/api/auth/register`, `/api/auth/login` | returns `{ token, user }` |
| GET | `/api/auth/me` | auth required |
| GET, POST | `/api/orders` | auth required. Body: `{ items: [{ variantId, qty }], shipping }` |
| GET | `/api/orders/:id` | own orders only |
