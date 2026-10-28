import express from 'express';
import cors from 'cors';
import { seedIfEmpty } from './seed.js';
import { ensureAdmin } from './bootstrapAdmin.js';
import { HttpError } from './http.js';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import siteRouter from './routes/site.js';
import adminRouter, { UPLOAD_DIR } from './routes/admin.js';

const PORT = Number(process.env.PORT) || 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const added = seedIfEmpty();
if (added) console.log(`Added ${added} products to the catalog.`);
await ensureAdmin();

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: ORIGIN.split(',') }));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/site', siteRouter);
app.use('/api/admin', adminRouter);
// Uploaded product photos. Served with nosniff so a mislabelled file can never run as a script.
app.use('/api/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d', immutable: true, setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => console.log(`Threads API listening on http://localhost:${PORT}`));
