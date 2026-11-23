const attempts = new Map();
const storageKey = (userId) => `threads.checkout.${userId}`;

function read(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId))) ?? attempts.get(userId);
  } catch {
    return attempts.get(userId);
  }
}

// Store only a digest and retry key, never the shipping address. Matching retries
// keep their key across a page reload, even if the first response was lost.
export async function checkoutKey(userId, body) {
  const canonical = JSON.stringify({
    items: body.items.map(({ variantId, qty }) => [variantId, qty]).sort(([a], [b]) => a - b),
    shipping: Object.fromEntries(['name', 'address', 'city', 'zip'].map((field) => [field, body.shipping[field].trim()])),
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const previous = read(userId);
  if (previous?.fingerprint === fingerprint && /^[A-Za-z0-9_-]{16,128}$/.test(previous.key)) return previous.key;
  const attempt = { key: crypto.randomUUID(), fingerprint };
  attempts.set(userId, attempt);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(attempt));
  } catch {
    // In-memory retries still work when browser storage is unavailable.
  }
  return attempt.key;
}

export function clearCheckoutKey(userId, key) {
  if (attempts.get(userId)?.key === key) attempts.delete(userId);
  try {
    if (JSON.parse(localStorage.getItem(storageKey(userId)))?.key === key) localStorage.removeItem(storageKey(userId));
  } catch {
    // Storage may be blocked or contain an invalid saved value.
  }
}
