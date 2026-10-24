import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { dataDir } from './db.js';
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
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = Number(payload.sub);
    next();
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
}
