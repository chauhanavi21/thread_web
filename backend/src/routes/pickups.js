import { Router } from 'express';
import { requireAdmin } from '../auth.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { loadOrder } from '../orderView.js';
import { collectPickup } from '../pickup.js';

const router = Router();
router.use(requireAdmin);
router.get('/', (req, res) => {
  const status = req.query.status;
  if (status && !['reserved', 'ready', 'collected', 'cancelled', 'expired'].includes(status)) throw new HttpError(400, 'Unknown pickup status.');
  const rows = status
    ? db.prepare("SELECT id FROM orders WHERE fulfillment = 'pickup' AND status = ? ORDER BY id DESC").all(status)
    : db.prepare("SELECT id FROM orders WHERE fulfillment = 'pickup' ORDER BY id DESC").all();
  res.json(rows.map(({ id }) => loadOrder(id)));
});
router.post('/:id/collect', (req, res) => {
  const id = Number(req.params.id);
  collectPickup(id, req.body?.cashReceivedCents);
  res.json(loadOrder(id));
});
export default router;
