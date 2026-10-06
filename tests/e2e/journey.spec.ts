import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { events, flagship, productUrl, products, stubRetailers } from './helpers';

test('catalog lists every product and the core journey reaches the retailer', async ({ page }) => {
  await stubRetailers(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Browse appliances' }).click();
  await expect(page).toHaveURL(/#catalog$/);
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(products.length);

  await page.getByRole('link', { name: new RegExp(flagship.title.slice(0, 20)) }).click();
  await expect(page).toHaveURL(productUrl(flagship));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(flagship.title);
  await expect(page.getByText(flagship.sku, { exact: true })).toBeVisible();

  // Back and refresh keep the user on the right page.
  await page.goBack();
  await expect(page).toHaveURL(/\/#catalog$/);
  await page.goForward();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(flagship.title);

  const retailer = page.getByRole('link', { name: /View at Samsung US/ });
  await expect(retailer).toHaveAttribute('href', flagship.commerce.retailerUrl!);
  await retailer.click();
  await expect(page).toHaveTitle('Retailer stub');
  await page.goBack();
  await expect(page).toHaveURL(productUrl(flagship));
});

for (const p of products) {
  test(`${p.id}: opens directly and agrees with its catalog record`, async ({ page }) => {
    const res = await page.goto(productUrl(p));
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(p.sku.replace('/', '\\/')));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title);
    await expect(page.locator('[data-viewer]')).toHaveAttribute('data-model', new RegExp(p.assets.model.replace(/\.glb$/, '').split('/')[1]));
    await expect(page.getByText(/Historical, not a current offer/)).toBeVisible();
  });
}

test('legacy URLs redirect to the matching product', async ({ page }) => {
  for (const p of products)
    for (const legacy of p.legacyPaths) {
      await page.goto(`/${legacy}`);
      await expect(page).toHaveURL(productUrl(p));
    }
  await page.goto('/AR.html');
  await expect(page).toHaveURL('/');
});

test('unknown pages return a helpful 404', async ({ page }) => {
  const res = await page.goto('/products/does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Browse appliances' })).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`no horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', productUrl(flagship), productUrl(products[1]), '/compare/']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test('has no serious or critical automated accessibility findings', async ({ page }) => {
  for (const path of ['/', productUrl(flagship), '/compare/', '/offline.html']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('model-viewer').analyze();
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${path}: ${v.id} ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  }
});

test('keyboard users reach details and the retailer without operating 3D', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard flow is checked on desktop');
  await page.goto(productUrl(flagship));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  let reached = false;
  for (let i = 0; i < 15 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.hasAttribute('data-retailer') ?? false);
  }
  expect(reached, `retailer link reachable by Tab in ${browserName}`).toBe(true);
});

test('records product views and retailer clicks without delaying navigation', async ({ page }) => {
  await stubRetailers(page);
  await page.goto(productUrl(flagship));
  const first = await events(page);
  expect(first.find((e) => e.name === 'product_view')?.productId).toBe(flagship.id);

  // The page unloads on click, so note what happened somewhere that survives navigation.
  await page.evaluate(() => {
    addEventListener('showroom:event', (e) => {
      const { name, productId } = (e as CustomEvent).detail;
      if (name === 'retailer_click') sessionStorage.setItem('test.retailer_click', productId);
    });
    // Runs after the app's own handlers: tracking must not cancel or hold the navigation.
    addEventListener('click', (e) => sessionStorage.setItem('test.prevented', String(e.defaultPrevented)));
  });
  await page.getByRole('link', { name: /View at Samsung US/ }).click();
  await expect(page).toHaveTitle('Retailer stub');
  await page.goBack();
  expect(await page.evaluate(() => sessionStorage.getItem('test.retailer_click'))).toBe(flagship.id);
  expect(await page.evaluate(() => sessionStorage.getItem('test.prevented'))).toBe('false');
});

test('the manifest is complete and its icons load', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  const m = await res.json();
  expect(m).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', lang: 'en' });
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);
});

test('desktop shows a same-product QR code and copies the link', async ({ page, context }, info) => {
  test.skip(info.project.name === 'mobile', 'QR handoff is for desktop');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(productUrl(flagship));
  await expect(page.locator('[data-qr] svg')).toBeVisible();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`http://localhost:4173${productUrl(flagship)}`);
});
