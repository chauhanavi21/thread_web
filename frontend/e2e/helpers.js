import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

let cachedAdminToken;
export async function getAdminToken(request) {
  if (!cachedAdminToken) {
    const response = await request.post('/api/auth/login', { data: { email: 'browser-admin@example.test', password: 'BrowserTestsOnly!2026' } });
    expect(response.ok()).toBeTruthy();
    cachedAdminToken = (await response.json()).token;
  }
  return cachedAdminToken;
}

export async function boutiqueScenario(request) {
  const adminToken = await getAdminToken(request);
  const suffix = randomUUID();
  const response = await request.post('/api/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      slug: `boutique-${suffix}`, name: 'Boutique Size Tee', category: 'men', type: 't-shirts',
      description: 'Fictional boutique workflow fixture.', priceCents: 2500,
      variants: [{ color: 'Ink', colorHex: '#111111', size: 'M', stock: 5 }, { color: 'Ink', colorHex: '#111111', size: 'L', stock: 3 }],
    },
  });
  expect(response.status()).toBe(201);
  const account = await request.post('/api/auth/register', { data: { name: 'Boutique Customer', email: `boutique-${suffix}@example.test`, password: 'BoutiqueCustomer!2026' } });
  expect(account.status()).toBe(201);
  return { product: await response.json(), token: (await account.json()).token, adminToken };
}

export async function pageAccount(page, token, destination) {
  await page.goto('/');
  await page.evaluate((value) => localStorage.setItem('threads.token', value), token);
  await page.goto(destination);
}
