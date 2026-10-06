import { expect, test } from '@playwright/test';
import { events, flagship, productUrl, products } from './helpers';

const FIXTURE = 'http://localhost:4174';
const fixtureProduct = `${FIXTURE}/products/refrigerator-fx-fridge/`;

test.describe('finish swatches (fixture catalog)', () => {
  test.use({ serviceWorkers: 'block' });

  test('choosing a finish updates the facts, retailer link, share link and 3D tint', async ({ page }) => {
    await page.goto(fixtureProduct);
    const group = page.getByRole('group', { name: /Finish/ });
    await expect(group.getByRole('radio')).toHaveCount(2);
    await expect(group.getByRole('radio', { name: 'Stainless Steel', exact: true })).toBeChecked();
    await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

    const color = (name: string) =>
      page.locator('model-viewer').evaluate(
        (el, n) =>
          (el as unknown as { model: { materials: { name: string; pbrMetallicRoughness: { baseColorFactor: number[] } }[] } }).model.materials.find((m) => m.name === n)!
            .pbrMetallicRoughness.baseColorFactor[0],
        name,
      );
    const baseColor = () => color('stainless');
    const before = await baseColor();
    const sides = await color('stainless-brushed');
    const glass = await color('screen');

    await group.getByRole('radio', { name: 'Black Stainless Steel' }).check();
    await expect(page.locator('[data-sku]')).toHaveText('FX-FRIDGE-BS');
    await expect(page.locator('[data-finish-name]')).toHaveText('Black Stainless Steel');
    await expect(page.getByRole('link', { name: /View at Example Retailer/ })).toHaveAttribute('href', 'https://retailer.example/fx-fridge-bs');
    await expect(page).toHaveURL(/\?finish=black-stainless$/);
    await expect(page.locator('[data-share-url]')).toHaveValue(`${fixtureProduct}?finish=black-stainless`);
    await expect.poll(baseColor).toBeCloseTo(before * 0.22, 3);
    await expect.poll(() => color('stainless-brushed')).toBeCloseTo(sides * 0.22, 3);
    // Only the finish materials change; glass, trim and the screen keep their colour.
    expect(await color('screen')).toBeCloseTo(glass, 5);
    expect((await events(page)).some((e) => e.name === 'finish_selected')).toBe(true);

    // Keyboard: arrow keys move between swatches, and the base finish restores the original colour.
    await group.getByRole('radio', { name: 'Black Stainless Steel' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(group.getByRole('radio', { name: 'Stainless Steel', exact: true })).toBeChecked();
    await expect.poll(baseColor).toBeCloseTo(before, 3);
    await expect(page).toHaveURL(fixtureProduct);
  });

  test('a shared finish link opens with that finish selected', async ({ page }) => {
    await page.goto(`${fixtureProduct}?finish=black-stainless`);
    await expect(page.getByRole('radio', { name: 'Black Stainless Steel' })).toBeChecked();
    await expect(page.locator('[data-sku]')).toHaveText('FX-FRIDGE-BS');
  });

  test('single-finish products show no swatches', async ({ page }) => {
    await page.goto(`${FIXTURE}/products/dishwasher-fx-dishwasher/`);
    await expect(page.getByRole('group', { name: /Finish/ })).toHaveCount(0);
  });
});

test('saved products follow the shopper to the header and the compare page', async ({ page }) => {
  await page.goto(productUrl(flagship));
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(page.locator('[data-saved-link]')).toBeHidden();
  await save.click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Saved appliances: 1' })).toBeVisible();
  expect((await events(page)).some((e) => e.name === 'product_saved')).toBe(true);

  // Save a second product from the catalog card.
  await page.goto('/');
  await expect(page.getByRole('button', { name: `Save ${flagship.title}` })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: `Save ${products[2].title}` }).click();
  await page.getByRole('link', { name: 'Saved appliances: 2' }).click();

  await expect(page).toHaveURL('/compare/');
  await expect(page.getByText('Comparing your 2 saved appliances.')).toBeVisible();
  const heads = page.locator('thead th[data-col]:visible');
  await expect(heads).toHaveCount(2);

  await page.getByRole('button', { name: `Remove ${products[2].title}` }).click();
  await expect(heads).toHaveCount(1);
  await page.getByRole('button', { name: `Remove ${flagship.title}` }).click();
  await expect(page.getByText('Showing every appliance.')).toBeVisible();
  await expect(heads).toHaveCount(products.length);
});

test('a shared comparison link shows exactly the listed products', async ({ page }) => {
  await page.goto(`/compare/?ids=${products[1].id},${products[3].id}`);
  await expect(page.locator('thead th[data-col]:visible')).toHaveCount(2);
  await expect(page.getByRole('columnheader', { name: new RegExp(products[1].title) })).toBeVisible();
  await expect(page.locator('td[data-col]:visible', { hasText: 'Not verified' }).first()).toBeVisible();
});

test('the comparison works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/compare/');
  await expect(page.locator('thead th[data-col]')).toHaveCount(products.length);
  await context.close();
});
