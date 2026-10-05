import { describe, expect, it } from 'vitest';
import type { Catalog } from '../../src/catalog/types';
import { renderCatalog, renderProduct, renderRedirectRules, renderSite, type RenderContext } from '../../src/render/pages';
import { clone, fixtureProduct, real } from './fixtures';

const ctx: RenderContext = { base: '/', asset: (p) => `/assets/${p}`, headTags: '', appVersion: 'test', now: new Date('2026-10-05T00:00:00Z') };
const catalog = (): Catalog => {
  const c = clone(real()) as Catalog;
  c.site.allowedRetailerHosts.push('retailer.example');
  c.products.push(fixtureProduct());
  return c;
};

describe('page rendering', () => {
  it('renders every product, including a fifth fixture, from data alone', () => {
    const c = catalog();
    const files = renderSite(c, ctx).map((p) => p.file);
    for (const p of c.products) expect(files).toContain(`products/${p.slug}/index.html`);
    expect(files).toContain('pages/fridge.html');
    expect(renderCatalog(c, ctx)).toContain('30 in. Fixture Wall Oven');
  });

  it('labels historical prices and never presents them as offers', () => {
    const c = catalog();
    const html = renderProduct(c, c.products[0], ctx);
    expect(html).toContain('Historical, not a current offer.');
    expect(html).toContain('$3,499.00');
    expect(html).toContain('View at Samsung US');
  });

  it('shows a fresh current price with its expiry and hides a stale one', () => {
    const c = catalog();
    const fx = c.products[4];
    expect(renderProduct(c, fx, ctx)).toContain('data-price-expires="2026-10-20T00:00:00.000Z"');
    fx.commerce.priceVerifiedAt = '2026-01-01';
    expect(renderProduct(c, fx, ctx)).not.toContain('$1,999.00');
  });

  it('shows verified dimensions with their source and never guesses missing ones', () => {
    const c = catalog();
    const fx = renderProduct(c, c.products[4], ctx);
    expect(fx).toMatch(/<th scope="row">Width<\/th><td>29.75 in<\/td><td>75.6 cm<\/td>/);
    expect(fx).toContain('checked September 1, 2026');
    const fridge = renderProduct(c, c.products[0], ctx);
    expect(fridge).toContain("haven't been verified");
    expect(fridge).not.toContain('class="dims"');
  });

  it('disables the retailer action with an explanation when the link is invalid', () => {
    const c = catalog();
    const fx = c.products[4];
    fx.commerce.retailerStatus = 'invalid';
    fx.commerce.retailerUrl = null;
    const html = renderProduct(c, fx, ctx);
    expect(html).toMatch(/<button type="button" class="btn btn--primary" disabled[^>]*>View at Example Retailer/);
    expect(html).toContain('this link is turned off');
  });

  it('only offers AR when scale is verified', () => {
    const c = catalog();
    expect(renderProduct(c, c.products[0], ctx)).toContain('data-ar="false"');
    expect(renderProduct(c, c.products[0], ctx)).toContain("In-room preview isn't available");
    c.products[4].assets.scaleVerified = true;
    expect(renderProduct(c, c.products[4], ctx)).toContain('data-ar="true"');
  });

  it('escapes catalog text', () => {
    const c = catalog();
    c.products[4].title = '<script>alert(1)</script>';
    const html = renderProduct(c, c.products[4], ctx);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('writes redirect rules for every legacy URL under the base path', () => {
    const rules = renderRedirectRules(catalog(), '/showroom/');
    expect(rules).toContain('/showroom/pages/fridge.html /showroom/products/refrigerator-rf22n9781sr/ 301');
    expect(rules).toContain('/showroom/AR.html /showroom/ 301');
  });
});
