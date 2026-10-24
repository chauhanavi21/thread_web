import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, signToken } from '../auth.js';
import { HttpError, rateLimit, str } from '../http.js';

const scrypt = promisify(crypto.scrypt);
const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', authLimiter, async (req, res) => {
  const name = str(req.body?.name, { field: 'Name', max: 80 });
  const email = str(req.body?.email, { field: 'Email', max: 254 }).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must be at least 8 characters.');

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists.');
  }
  const hash = await hashPassword(password);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email, hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Same message for unknown email and wrong password so accounts can't be enumerated.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  res.json({ user: publicUser(user) });
});

export default router;
