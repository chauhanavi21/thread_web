import { test, expect } from '@playwright/test';
import { boutiqueScenario, pageAccount } from './helpers.js';

test('a customer exchanges a size and staff inspect a subsequent damaged return', async ({ page, request }, testInfo) => {
  const { product, token, adminToken } = await boutiqueScenario(request);
  const customerHeaders = { Authorization: `Bearer ${token}` };
  const staffHeaders = { Authorization: `Bearer ${adminToken}` };
  const medium = product.variants.find((variant) => variant.size === 'M');
  const large = product.variants.find((variant) => variant.size === 'L');
  const purchase = await request.post('/api/orders', { headers: customerHeaders, data: {
    items: [{ variantId: medium.id, qty: 2 }], shipping: { name: 'Boutique Customer', address: '12 Example Street', city: 'Sample City', zip: '12345' },
  } });
  expect(purchase.status()).toBe(201);
  const order = await purchase.json();
  for (const status of ['processing', 'shipped', 'delivered']) {
    expect((await request.patch(`/api/admin/orders/${order.id}`, { headers: staffHeaders, data: { status } })).status()).toBe(200);
  }
  await pageAccount(page, token, `/orders/${order.id}`);
  await page.getByRole('combobox', { name: 'What do you need?', exact: true }).selectOption('exchange');
  await page.getByRole('combobox', { name: 'Replacement size and colour', exact: true }).selectOption(String(large.id));
  await page.getByLabel('Reason', { exact: true }).fill('Please exchange my M for an L.');
  await page.getByRole('button', { name: 'Request exchange', exact: true }).click();
  await expect(page.getByText('exchange #', { exact: false })).toHaveCount(1);
  let saved = await (await request.get(`/api/orders/${order.id}`, { headers: customerHeaders })).json();
  const exchange = saved.returnCases[0];

  await pageAccount(page, adminToken, '/admin/returns');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  let card = page.getByRole('article', { name: `Return case ${exchange.id}`, exact: true });
  await card.getByRole('button', { name: 'Approve exchange', exact: true }).click();
  await card.getByRole('combobox', { name: 'Inspection for Boutique Size Tee (M)', exact: true }).selectOption('resellable');
  await card.getByRole('button', { name: 'Complete exchange', exact: true }).click();
  await expect(card.locator('.pill')).toHaveText('completed');

  await pageAccount(page, token, `/orders/${order.id}`);
  await page.getByLabel('Reason', { exact: true }).fill('The remaining item is damaged.');
  await page.getByRole('button', { name: 'Request return', exact: true }).click();
  await expect(page.getByText('return #', { exact: false })).toHaveCount(1);
  saved = await (await request.get(`/api/orders/${order.id}`, { headers: customerHeaders })).json();
  const returned = saved.returnCases[0];
  await pageAccount(page, adminToken, '/admin/returns');
  card = page.getByRole('article', { name: `Return case ${returned.id}`, exact: true });
  await card.getByRole('button', { name: 'Approve return', exact: true }).click();
  await card.getByRole('combobox', { name: 'Inspection for Boutique Size Tee (M)', exact: true }).selectOption('damaged');
  await card.getByRole('checkbox', { name: /Refund of/ }).check();
  await card.getByRole('button', { name: 'Complete return', exact: true }).click();
  await expect(card.locator('.pill')).toHaveText('completed');
  const updated = await (await request.get(`/api/products/${product.slug}`)).json();
  expect(updated.variants.find((variant) => variant.id === medium.id).stock).toBe(4);
  expect(updated.variants.find((variant) => variant.id === large.id).stock).toBe(2);
  await pageAccount(page, token, `/orders/${order.id}`);
  await expect(page.getByText('Refund recorded: $25.00', { exact: true })).toBeVisible();
  await expect(page.getByText(/kept out of sellable stock/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('completed-exchange-and-return.png'), fullPage: true });
});

test('recording a counter sale updates an already-open storefront and saves a cash receipt', async ({ page, request, context }, testInfo) => {
  const { product, adminToken } = await boutiqueScenario(request);
  const storefront = await context.newPage();
  await storefront.goto(`/product/${product.slug}`);
  await storefront.getByRole('button', { name: 'M', exact: true }).click();
  await expect(storefront.getByText('Only 5 left in Ink, M.', { exact: true })).toBeVisible();

  await pageAccount(page, adminToken, '/admin/counter-sales');
  await page.getByRole('searchbox', { name: 'Find a product, size or colour', exact: true }).fill(product.slug);
  await page.getByRole('button', { name: 'Add Boutique Size Tee Ink M', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Quantity for Boutique Size Tee M', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Customer name (optional)', exact: true }).fill('Walk-in fixture');
  await page.getByRole('spinbutton', { name: 'Cash received ($)', exact: true }).fill('60');
  await page.getByRole('button', { name: 'Record cash sale', exact: true }).click();
  const receipt = page.getByRole('region', { name: /Counter receipt/ });
  await expect(receipt.getByRole('heading', { name: /Counter receipt #/ })).toBeVisible();
  await expect(receipt.getByText('$50.00', { exact: true })).toHaveCount(2);
  await expect(receipt.getByText('$10.00', { exact: true })).toBeVisible();
  const receiptNumber = (await receipt.getByRole('heading').textContent()).match(/#(\d+)/)[1];
  await expect(storefront.getByText('Only 3 left in Ink, M.', { exact: true })).toBeVisible();
  await expect(storefront.getByRole('button', { name: 'M', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: new RegExp(`^Receipt #${receiptNumber} · Walk-in fixture`) }).click();
  await expect(page.getByRole('region', { name: /Counter receipt/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('counter-sale-receipt.png'), fullPage: true });
  await storefront.close();
});
