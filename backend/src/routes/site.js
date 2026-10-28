import { Router } from 'express';
import { db } from '../db.js';
import { getSettings } from '../settings.js';

const router = Router();

// GET /api/site -> everything the storefront needs that the admin controls: categories and site settings.
router.get('/', (_req, res) => {
  const categories = db
    .prepare(
      `SELECT c.key, c.title, c.blurb, c.image FROM categories c
       WHERE EXISTS (SELECT 1 FROM products p WHERE p.category = c.key AND p.active = 1)
       ORDER BY c.sort_order, c.title`,
    )
    .all();
  res.json({ categories, settings: getSettings() });
});

export default router;
