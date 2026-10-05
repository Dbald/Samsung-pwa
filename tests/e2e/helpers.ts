import type { Page } from '@playwright/test';
import { readCatalogRaw } from '../../src/node/catalog-fs';
import type { ProductRecord } from '../../src/catalog/types';

export const products = readCatalogRaw().products as ProductRecord[];
export const productUrl = (p: ProductRecord) => `/products/${p.slug}/`;
export const flagship = products[0];

export async function events(page: Page): Promise<{ name: string; productId: string | null; eventId: string; elapsedMs?: number }[]> {
  return page.evaluate(() => (window.showroomEvents ?? []).map((e) => ({ ...e })));
}

/** Stops the browser leaving the test origin for the real retailer. */
export async function stubRetailers(page: Page) {
  await page.route(/^https:\/\/www\.samsung\.com\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Retailer stub</title><h1>Retailer stub</h1>' }),
  );
}
