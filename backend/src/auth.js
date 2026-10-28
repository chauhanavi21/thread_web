import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { db, dataDir } from './db.js';
import { HttpError } from './http.js';

// The signing key comes from JWT_SECRET, or is generated once and kept in data/jwt.secret (gitignored).
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(dataDir, 'jwt.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email, role: row.role });

const SECRET = loadSecret();
const EXPIRES_IN = '7d';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: EXPIRES_IN });
}

/** Express middleware: requires a valid `Authorization: Bearer <token>` header and sets req.userId. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Please sign in to continue.');
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  // next() stays outside the try so errors from later handlers are not mistaken for a bad token.
  req.userId = Number(payload.sub);
  next();
}

/**
 * Express middleware: requires a signed-in user whose role is "admin". The role is read from the database on every
 * request (not from the token), so demoting or deleting an admin takes effect immediately.
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.userId);
    if (!user) throw new HttpError(401, 'Account no longer exists.');
    if (user.role !== 'admin') throw new HttpError(403, 'Admin access required.');
    next();
  });
}
