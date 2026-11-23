import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getAdminToken } from './helpers.js';

const shipping = { name: 'Browser Customer', address: '12 Example Street', city: 'Sample City', zip: '12345' };

async function prepareCheckout(page, request) {
  const suffix = randomUUID();
  const adminToken = await getAdminToken(request);
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

test('customers can keep or cancel an order, with its status and stock saved', async ({ page, request }) => {
  const { product, token } = await prepareCheckout(page, request);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/);
  const orderURL = page.url();
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('button', { name: 'Keep order', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel order', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Yes, cancel order', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, cancel order', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('This order has been cancelled.');
  await expect(page.getByRole('button', { name: 'Cancel order', exact: true })).toHaveCount(0);
  await expect(page.getByText('Thank you! Your order has been placed.')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('This order has been cancelled.');
  const updated = await (await request.get(`/api/products/${product.slug}`)).json();
  expect(updated.variants[0].stock).toBe(5);
  const orders = await (await request.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(orders).toHaveLength(1);
  expect(orders[0].status).toBe('cancelled');
  await page.goto('/orders');
  await page.getByRole('link', { name: `View order #${orders[0].id}`, exact: true }).click();
  await expect(page).toHaveURL(orderURL);
});

test('dispatch during cancellation shows the current state and prevents restocking', async ({ page, request }) => {
  const { product, adminToken } = await prepareCheckout(page, request);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/\d+$/);
  const orderId = page.url().split('/').at(-1);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  const headers = { Authorization: `Bearer ${adminToken}` };
  expect((await request.patch(`/api/admin/orders/${orderId}`, { headers, data: { status: 'processing' } })).status()).toBe(200);
  expect((await request.patch(`/api/admin/orders/${orderId}`, { headers, data: { status: 'shipped' } })).status()).toBe(200);
  await page.getByRole('button', { name: 'Yes, cancel order', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('An order that is shipped cannot be changed to cancelled.');
  await expect(page.getByRole('button', { name: 'Cancel order', exact: true })).toHaveCount(0);
  await expect(page.locator('.pill')).toHaveText('shipped');
  const updated = await (await request.get(`/api/products/${product.slug}`)).json();
  expect(updated.variants[0].stock).toBe(4);

  // The staff selector offers only the server's legal next step.
  await page.evaluate((token) => localStorage.setItem('threads.token', token), adminToken);
  await page.goto('/admin/orders');
  const status = page.getByRole('combobox', { name: `Status of order ${orderId}`, exact: true });
  await expect(status.locator('option')).toHaveText(['shipped', 'delivered']);
  await status.selectOption('delivered');
  await expect(page.getByText(`Order #${orderId} is now delivered.`)).toBeVisible();
  await expect(page.getByRole('combobox', { name: `Status of order ${orderId}`, exact: true })).toBeDisabled();
});
