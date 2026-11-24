import { test, expect, devices } from '@playwright/test';
import { boutiqueScenario, pageAccount } from './helpers.js';

const baseURL = 'http://127.0.0.1:5417';
const staffContext = (browser, testInfo) => browser.newContext({
  ...(testInfo.project.name === 'phone' ? devices['iPhone 13'] : devices['Desktop Chrome']), baseURL,
});

test('a pickup survives a lost response, updates live when ready and records cash at collection', async ({ page, request, browser }, testInfo) => {
  const { product, token, adminToken } = await boutiqueScenario(request);
  await pageAccount(page, token, `/product/${product.slug}`);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await page.getByRole('radio', { name: 'Collect in store — pay at pickup', exact: true }).check();
  await expect(page.getByRole('textbox', { name: 'Address', exact: true })).toHaveCount(0);
  await expect(page.getByText(/held for 24 hours/)).toBeVisible();
  let savedOrder;
  const keys = [];
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!savedOrder) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      savedOrder = await response.json();
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Reserve for pickup', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('pickup contact is safe');
  await page.reload();
  await page.getByRole('radio', { name: 'Collect in store — pay at pickup', exact: true }).check();
  await page.getByRole('button', { name: 'Reserve for pickup', exact: true }).click();
  await expect(page).toHaveURL(`/orders/${savedOrder.id}`);
  await expect(page.getByText('Your pickup is reserved.', { exact: true })).toBeVisible();
  await expect(page.getByText('Pay $25.00 cash at collection.', { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const headers = { Authorization: `Bearer ${token}` };
  let order = await (await request.get(`/api/orders/${savedOrder.id}`, { headers })).json();
  expect(order.paymentStatus).toBe('unpaid');
  expect(order.shippingCents).toBe(0);
  expect(await (await request.get('/api/orders', { headers })).json()).toHaveLength(1);

  const shop = await staffContext(browser, testInfo);
  try {
    const staffPage = await shop.newPage();
    await pageAccount(staffPage, adminToken, '/admin/pickups');
    const card = staffPage.getByRole('article', { name: `Pickup ${savedOrder.id}`, exact: true });
    await card.getByRole('button', { name: 'Mark ready for pickup', exact: true }).click();
    await expect(page.locator('.pill').first()).toHaveText('Ready for pickup');
    await card.getByRole('spinbutton', { name: `Cash received for pickup #${savedOrder.id} ($)`, exact: true }).fill('30');
    await card.getByRole('button', { name: 'Record payment & collection', exact: true }).click();
    await expect(card.locator('.pill')).toHaveText('collected');
    await expect(page.locator('.pill').first()).toHaveText('collected');
    await expect(page.getByText('Cash received: $30.00 · Change: $5.00', { exact: true })).toBeVisible();
    await expect.poll(() => staffPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await staffPage.screenshot({ path: testInfo.outputPath('collected-pickup.png'), fullPage: true });
  } finally { await shop.close(); }
  order = await (await request.get(`/api/orders/${savedOrder.id}`, { headers })).json();
  expect(order.paymentStatus).toBe('paid');
  expect(order.items[0].returnableQty).toBe(1);
  const updated = await (await request.get(`/api/products/${product.slug}`)).json();
  expect(updated.variants.find((variant) => variant.size === 'M').stock).toBe(4);
});

test('staff configure the pickup policy and a customer can cancel an unpaid hold', async ({ page, request, browser }, testInfo) => {
  const { product, token, adminToken } = await boutiqueScenario(request);
  const headers = { Authorization: `Bearer ${adminToken}` };
  const original = await (await request.get('/api/admin/settings', { headers })).json();
  const shop = await staffContext(browser, testInfo);
  try {
    const staffPage = await shop.newPage();
    await pageAccount(staffPage, adminToken, '/admin/settings');
    await staffPage.getByRole('spinbutton', { name: /^Pickup hold \(hours\)/ }).fill('2');
    await staffPage.getByRole('textbox', { name: 'Pickup address', exact: true }).fill('Fictional pickup desk, Sample City');
    await staffPage.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(staffPage.getByRole('status')).toContainText('Saved.');
    const response = await request.post('/api/orders', { headers: { Authorization: `Bearer ${token}` }, data: {
      fulfillment: 'pickup', pickup: { name: 'Boutique Customer', contact: 'customer@example.test' },
      items: [{ variantId: product.variants.find((variant) => variant.size === 'M').id, qty: 1 }],
    } });
    expect(response.status()).toBe(201);
    const order = await response.json();
    expect(order.pickup.location).toBe('Fictional pickup desk, Sample City');
    expect(Date.parse(order.pickup.expiresAt) - Date.now()).toBeLessThanOrEqual(2 * 3600000);
    expect(Date.parse(order.pickup.expiresAt) - Date.now()).toBeGreaterThan(1.9 * 3600000);
    await pageAccount(page, token, `/orders/${order.id}`);
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, cancel order', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('This pickup reservation has been cancelled.');
    const updated = await (await request.get(`/api/products/${product.slug}`)).json();
    expect(updated.variants.find((variant) => variant.size === 'M').stock).toBe(5);
    expect((await (await request.get(`/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()).paymentStatus).toBe('unpaid');
  } finally {
    await request.put('/api/admin/settings', { headers, data: { pickupHoldHours: original.pickupHoldHours, pickupAddress: original.pickupAddress } });
    await shop.close();
  }
});
