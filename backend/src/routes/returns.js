import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { RETURN_STATUSES, actOnReturnCase, createReturnCase, loadReturnCase } from '../returns.js';

export const customerReturnsRouter = Router();
customerReturnsRouter.use(requireAuth);
customerReturnsRouter.post('/:id/cancel', (req, res) => res.json(actOnReturnCase(Number(req.params.id), 'cancel', {}, { customerId: req.userId })));

export const adminReturnsRouter = Router();
adminReturnsRouter.use(requireAdmin);
adminReturnsRouter.get('/', (req, res) => {
  const status = req.query.status;
  if (status && !RETURN_STATUSES.includes(status)) throw new HttpError(400, 'Unknown return status.');
  const rows = status ? db.prepare('SELECT id FROM return_cases WHERE status = ? ORDER BY id DESC').all(status) : db.prepare('SELECT id FROM return_cases ORDER BY id DESC').all();
  res.json(rows.map(({ id }) => loadReturnCase(id)));
});
adminReturnsRouter.post('/', (req, res) => {
  const result = createReturnCase(req.body?.orderId, req.userId, req.body, { staff: true, requestKey: req.get('Idempotency-Key') });
  res.status(result.replayed ? 200 : 201).json(result.returnCase);
});
adminReturnsRouter.post('/:id/actions', (req, res) => res.json(actOnReturnCase(Number(req.params.id), req.body?.action, req.body)));
