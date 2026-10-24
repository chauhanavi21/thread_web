# Threads — clothing store

Full-stack demo e-commerce site for clothing. React (Vite) frontend, Node/Express + SQLite backend. Everything runs locally.

The look follows a brutalist editorial reference: off-white paper, pure black type, huge condensed Anton headings, Archivo body text, a diamond cursor, a scroll-driven hero and a slide-in menu.

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
- **No photos**: each garment is drawn as an SVG in the chosen colour (`frontend/src/components/ProductImage.jsx`), so the picture always matches the swatch. To use real photos, replace that one component.
- The JWT signing key is generated into `backend/data/jwt.secret` (gitignored), or set `JWT_SECRET`.
- The database is `backend/data/threads.db` (gitignored). Delete it to start fresh.
- Motion respects the OS "reduce motion" setting. The diamond cursor only appears for mouse and trackpad users.

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
