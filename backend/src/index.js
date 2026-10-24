import express from 'express';
import cors from 'cors';
import { seedIfEmpty } from './seed.js';
import { HttpError } from './http.js';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';

const PORT = Number(process.env.PORT) || 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

if (seedIfEmpty()) console.log('Seeded product catalog.');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: ORIGIN.split(',') }));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => console.log(`Threads API listening on http://localhost:${PORT}`));
