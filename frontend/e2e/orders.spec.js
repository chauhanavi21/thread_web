import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const shipping = { name: 'Browser Customer', address: '12 Example Street', city: 'Sample City', zip: '12345' };

async function prepareCheckout(page, request) {
  const suffix = randomUUID();
  const login = await request.post('/api/auth/login', { data: { email: 'browser-admin@example.test', password: 'BrowserTestsOnly!2026' } });
  expect(login.ok()).toBeTruthy();
  const { token: adminToken } = await login.json();
  const created = await request.post('/api/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      slug: `browser-tee-${suffix}`, name: 'Browser Test Tee', category: 'men', type: 't-shirts',
      description: 'Fictional product for isolated browser verification.', priceCents: 2500,
      variants: [{ color: 'Ink', colorHex: '#111111', size: 'M', stock: 5 }],
    },
  });
  expect(created.status()).toBe(201);
  const product = await created.json();

  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill(shipping.name);
  await page.getByLabel('Email', { exact: true }).fill(`browser-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('BrowserCustomer!2026');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('/');
  const token = await page.evaluate(() => localStorage.getItem('threads.token'));
  await page.goto(`/product/${product.slug}`);
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your bag', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await fillShipping(page);
  return { product, token, adminToken };
}

async function fillShipping(page) {
  await page.getByLabel('Full name', { exact: true }).fill(shipping.name);
  await page.getByLabel('Address', { exact: true }).fill(shipping.address);
  await page.getByLabel('City', { exact: true }).fill(shipping.city);
  await page.getByLabel('ZIP / postal code', { exact: true }).fill(shipping.zip);
}

test('a lost checkout response and page reload still produce exactly one order', async ({ page, request }) => {
  const { product, token } = await prepareCheckout(page, request);
  let committedOrder;
  const keys = [];
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!committedOrder) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      committedOrder = await response.json();
      return route.abort('failed');
    }
    return route.continue();
  });

  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Retrying the same bag and address is safe.');
  const savedAttempt = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('threads.checkout.'))?.[1]);
  expect(savedAttempt).toBeTruthy();
  expect(savedAttempt).not.toContain(shipping.address);
  await page.reload();
  await fillShipping(page);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(`/orders/${committedOrder.id}`);
  await expect(page.getByRole('heading', { name: `Order #${committedOrder.id}`, exact: true })).toBeVisible();
  await expect(page.getByText('Thank you! Your order has been placed.')).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(keys[1]).toBe(keys[0]);
  const orders = await request.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
  expect(await orders.json()).toHaveLength(1);
  const updated = await (await request.get(`/api/products/${product.slug}`)).json();
  expect(updated.variants[0].stock).toBe(4);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('threads.cart') || '[]'))).toEqual([]);
});

test('a stock conflict keeps the bag and gives a route back to review it', async ({ page, request }) => {
  const { product, adminToken } = await prepareCheckout(page, request);
  const updated = await request.put(`/api/admin/products/${product.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { ...product, variants: product.variants.map((variant) => ({ ...variant, stock: 0 })) },
  });
  expect(updated.status()).toBe(200);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('out of stock');
  await page.getByRole('link', { name: 'review bag', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your bag', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browser Test Tee', exact: true })).toBeVisible();
});
