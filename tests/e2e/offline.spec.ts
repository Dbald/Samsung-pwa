import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { Server } from 'node:http';
import { startServer } from '../../scripts/serve';
import { flagship, productUrl, products } from './helpers';

// Each test gets its own origin and server, then stops the server: a real loss of
// network that also covers service worker fetches (setOffline alone does not survive
// a service worker restart). setOffline additionally drives navigator.onLine.
let server: Server;
let origin: string;

test.beforeEach(async ({}, info) => {
  const port = 4300 + info.workerIndex * 2 + (info.project.name === 'mobile' ? 1 : 0);
  server = await startServer(port);
  origin = `http://localhost:${port}`;
});

test.afterEach(() => {
  server.closeAllConnections();
  server.close();
});

async function goOffline(context: BrowserContext) {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await context.setOffline(true);
}

async function installServiceWorker(page: Page) {
  await page.goto(`${origin}/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('after one online visit the app works offline with explicit unavailable states', async ({ page, context }) => {
  await installServiceWorker(page);
  await page.goto(`${origin}${productUrl(flagship)}`);
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  await goOffline(context);

  // Recently viewed product: text and the model it already loaded both work offline.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(flagship.title);
  await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toBeVisible();
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  // The retailer is never cached: the action explains itself instead of failing.
  const retailer = page.getByRole('link', { name: /View at Samsung US/ });
  await expect(retailer).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Connect to the internet to continue to the retailer.')).toBeVisible();
  await retailer.click({ force: true });
  await expect(page).toHaveURL(`${origin}${productUrl(flagship)}`);

  // Catalog shell is precached.
  await page.goto(`${origin}/`);
  await expect(page.locator('.card')).toHaveCount(products.length);

  // A product never visited falls back to the offline page listing what is saved.
  await page.goto(`${origin}${productUrl(products[3])}`);
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page.locator('[data-recent] a', { hasText: flagship.title })).toBeVisible();
});

test('an uncached model offline shows the offline message, not a broken canvas', async ({ page, context }) => {
  await installServiceWorker(page);
  // Save only the page text, as if the visit ended before the model downloaded.
  const url = `${origin}${productUrl(products[2])}`;
  await page.evaluate(async (path) => {
    const shell = (await caches.keys()).find((n) => n.startsWith('shell-'))!;
    const pages = await caches.open(shell.replace('shell-', 'pages-'));
    await pages.put(path, await fetch(path));
  }, new URL(url).pathname);

  await goOffline(context);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(products[2].title);
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
  await expect(page.locator('.viewer__poster')).toBeVisible();
  await expect(page.getByText("You're offline and this 3D model isn't saved on this device.")).toBeVisible();
});
