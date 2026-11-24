const attempts = new Map();
const storageKey = (userId) => `threads.checkout.${userId}`;

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? attempts.get(key);
  } catch {
    return attempts.get(key);
  }
}

// Store only a digest and retry key, never the shipping address. Matching retries
// keep their key across a page reload, even if the first response was lost.
export async function checkoutKey(userId, body) {
  const canonical = JSON.stringify({
    items: body.items.map(({ variantId, qty }) => [variantId, qty]).sort(([a], [b]) => a - b),
    shipping: body.fulfillment === 'pickup' ? null : Object.fromEntries(['name', 'address', 'city', 'zip'].map((field) => [field, body.shipping[field].trim()])),
    ...(body.fulfillment === 'pickup' ? { fulfillment: 'pickup', pickup: { name: body.pickup.name.trim(), contact: body.pickup.contact.trim() } } : {}),
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const slot = `${storageKey(userId)}.${fingerprint}`;
  const previous = read(slot) ?? read(storageKey(userId));
  if (previous?.fingerprint === fingerprint && /^[A-Za-z0-9_-]{16,128}$/.test(previous.key)) return previous.key;
  const attempt = { key: crypto.randomUUID(), fingerprint };
  attempts.set(slot, attempt);
  try {
    localStorage.setItem(slot, JSON.stringify(attempt));
  } catch {
    // In-memory retries still work when browser storage is unavailable.
  }
  return attempt.key;
}

export function clearCheckoutKey(userId, key) {
  const prefix = storageKey(userId);
  for (const [slot, attempt] of attempts) {
    if ((slot === prefix || slot.startsWith(`${prefix}.`)) && attempt.key === key) attempts.delete(slot);
  }
  try {
    for (const slot of Object.keys(localStorage)) {
      if ((slot === prefix || slot.startsWith(`${prefix}.`)) && JSON.parse(localStorage.getItem(slot))?.key === key) localStorage.removeItem(slot);
    }
  } catch {
    // Storage may be blocked or contain an invalid saved value.
  }
}
