import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dataDirectory = mkdtempSync(path.join(tmpdir(), 'threads-browser-'));
process.env.THREADS_DATA_DIR = dataDirectory;
process.env.JWT_SECRET = 'threads-browser-tests-only';
process.env.ADMIN_EMAIL = 'browser-admin@example.test';
process.env.ADMIN_PASSWORD = 'BrowserTestsOnly!2026';
const { db } = await import('../../backend/src/db.js');
const { app } = await import('../../backend/src/app.js');
const { seedIfEmpty } = await import('../../backend/src/seed.js');
const { ensureAdmin } = await import('../../backend/src/bootstrapAdmin.js');
const { startPickupExpiry } = await import('../../backend/src/pickup.js');
seedIfEmpty();
await ensureAdmin();
const stopExpiry = startPickupExpiry();
const server = app.listen(4400, '127.0.0.1');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopExpiry();
    server.close(() => {
      db.close();
      assert.ok(path.resolve(dataDirectory).startsWith(path.join(path.resolve(tmpdir()), 'threads-browser-')));
      rmSync(dataDirectory, { recursive: true, force: true });
      process.exit(0);
    });
    server.closeAllConnections();
  });
}
