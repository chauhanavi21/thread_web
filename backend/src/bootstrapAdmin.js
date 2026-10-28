import crypto from 'node:crypto';
import { db } from './db.js';
import { hashPassword } from './auth.js';

/**
 * Makes sure at least one admin exists.
 *  - ADMIN_EMAIL + ADMIN_PASSWORD (env): creates that account, or promotes it if the email is already registered.
 *  - Otherwise, when there is no admin at all: creates admin@threads.local with a random password, printed once.
 * Nothing is done when an admin already exists and the env vars are not set.
 */
export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
    if (existing) {
      if (existing.role !== 'admin') db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    } else {
      db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', ?, ?, 'admin')").run(email, await hashPassword(password));
    }
    return;
  }

  if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return;

  const generated = crypto.randomBytes(9).toString('base64url');
  const fallbackEmail = 'admin@threads.local';
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(fallbackEmail)) {
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(fallbackEmail);
    return;
  }
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', ?, ?, 'admin')").run(fallbackEmail, await hashPassword(generated));
  console.log('\n  No admin account existed, so one was created:');
  console.log(`    email:    ${fallbackEmail}`);
  console.log(`    password: ${generated}`);
  console.log('  This is shown once. Set ADMIN_EMAIL and ADMIN_PASSWORD to choose your own.\n');
}
