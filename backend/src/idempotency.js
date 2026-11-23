import { createHash } from 'node:crypto';
import { HttpError } from './http.js';

export function validateRequestKey(key) {
  if (key !== undefined && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new HttpError(400, 'Idempotency-Key must be 16 to 128 letters, numbers, underscores or hyphens.');
  }
}

export const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
