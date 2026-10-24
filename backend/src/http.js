export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Very small in-memory rate limiter (per IP) for sensitive endpoints. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) throw new HttpError(429, 'Too many attempts. Please try again in a few minutes.');
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export function str(value, { field, min = 1, max = 200 }) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length < min || v.length > max) {
    throw new HttpError(400, `${field} must be between ${min} and ${max} characters.`);
  }
  return v;
}
