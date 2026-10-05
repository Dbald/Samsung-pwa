import { expect, test } from '@playwright/test';
import { events, flagship, productUrl, products } from './helpers';

// Request interception can't see fetches a service worker makes; these tests cover
// the viewer itself, so run them without one (offline.spec.ts covers the worker).
test.use({ serviceWorkers: 'block' });

test('3D inspection loads with controls and a working reset', async ({ page }) => {
  const csp: string[] = [];
  page.on('console', (m) => m.text().includes('Content Security Policy') && csp.push(m.text()));
  await page.goto(productUrl(flagship));
  const viewer = page.locator('[data-viewer]');
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(page.locator('model-viewer')).toBeVisible();
  await expect(page.locator('.viewer__poster')).toBeHidden();

  const box = (await page.locator('model-viewer').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const orbitAfterDrag = await page.locator('model-viewer').evaluate((el) => (el as unknown as { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta);

  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.waitForTimeout(1500);
  const orbitAfterReset = await page.locator('model-viewer').evaluate((el) => (el as unknown as { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta);
  const approved = (-30 * Math.PI) / 180;
  expect(Math.abs(orbitAfterReset - approved)).toBeLessThan(0.05);
  expect(Math.abs(orbitAfterDrag - approved)).toBeGreaterThan(0.05);

  const names = (await events(page)).map((e) => e.name);
  expect(names).toEqual(expect.arrayContaining(['product_view', 'viewer_requested', 'viewer_ready']));
  expect(csp).toEqual([]);
});

test('a blocked model leaves a usable image, details and a retry', async ({ page }) => {
  await page.route(/\.glb(\?.*)?$/, (route) => route.abort());
  await page.goto(productUrl(flagship));
  const viewer = page.locator('[data-viewer]');
  await expect(viewer).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
  await expect(page.locator('.viewer__poster')).toBeVisible();
  await expect(page.getByText("The 3D model couldn't load")).toBeVisible();
  await expect(page.getByRole('link', { name: /View at Samsung US/ })).toBeVisible();
  expect((await events(page)).some((e) => e.name === 'viewer_error')).toBe(true);

  await page.unroute(/\.glb(\?.*)?$/);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
});

test('a corrupt model produces the error state, not an empty canvas', async ({ page }) => {
  await page.route(/\.glb(\?.*)?$/, (route) => route.fulfill({ contentType: 'model/gltf-binary', body: Buffer.from('not a glb') }));
  await page.goto(productUrl(flagship));
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
  await expect(page.locator('.viewer__poster')).toBeVisible();
});

test('AR stays hidden until scale is verified, with an explanation', async ({ page }) => {
  await page.goto(productUrl(flagship));
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'View in your space' })).toBeHidden();
  await expect(page.getByText("In-room preview isn't available for this product yet.")).toBeVisible();
});

test('switching products releases the previous viewer', async ({ page }) => {
  for (const p of [flagship, products[1], flagship]) {
    await page.goto(productUrl(p));
    await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect(page.locator('model-viewer')).toHaveCount(1);
  }
});
