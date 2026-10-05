import { describe, expect, it } from 'vitest';
import { validateCatalog, type ModelStats } from '../../src/catalog/validate';
import { assetExists } from '../../src/node/catalog-fs';
import { clone, fixtureProduct, real } from './fixtures';

const ctx = { assetExists: (p: string) => assetExists(p), now: new Date('2026-10-05T00:00:00Z') };
const withFixture = () => {
  const c = clone(real());
  c.site.allowedRetailerHosts.push('retailer.example');
  c.products.push(fixtureProduct());
  return c;
};

describe('catalog validation', () => {
  it('accepts the shipped catalog in preview mode, with pending items as warnings', () => {
    const { errors, warnings } = validateCatalog(real(), ctx);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('specifications.exterior'))).toBe(true);
  });

  it('blocks a public release while content is unverified', () => {
    const { errors } = validateCatalog(real(), { ...ctx, release: true });
    expect(errors.some((e) => e.includes('approvalStatus'))).toBe(true);
    expect(errors.some((e) => e.includes('scaleVerified'))).toBe(true);
  });

  it('accepts a fifth product from another brand without code changes', () => {
    const { errors } = validateCatalog(withFixture(), ctx);
    expect(errors).toEqual([]);
  });

  it('rejects malformed records with a useful path', () => {
    const c = withFixture() as unknown as { products: unknown[] };
    c.products.push('not a record', { id: 'Bad ID' });
    const { errors } = validateCatalog(c, ctx);
    expect(errors).toContain('products[5]: expected an object');
    expect(errors.some((e) => e.startsWith('products[Bad ID].id: must be lowercase'))).toBe(true);
  });

  it('catches duplicate ids, slugs and legacy paths', () => {
    const c = withFixture();
    c.products[4].id = c.products[0].id;
    c.products[4].slug = c.products[0].slug;
    c.products[4].legacyPaths = [...c.products[0].legacyPaths];
    const { errors } = validateCatalog(c, ctx);
    expect(errors.filter((e) => /duplicate|already redirected/.test(e))).toHaveLength(3);
  });

  it('catches missing assets', () => {
    const c = withFixture();
    c.products[4].assets.model = 'models/missing.glb';
    c.products[4].assets.poster = 'posters/missing.webp';
    const { errors } = validateCatalog(c, ctx);
    expect(errors).toContain('products[fx-oven-01].assets.model: file "assets/models/missing.glb" not found');
    expect(errors.some((e) => e.includes('assets.poster'))).toBe(true);
  });

  it('rejects non-https and non-allowlisted retailer URLs', () => {
    const c = withFixture();
    c.products[4].commerce.retailerUrl = 'http://retailer.example/x';
    c.products[3].commerce.retailerUrl = 'https://evil.example/x';
    const { errors } = validateCatalog(c, ctx);
    expect(errors.some((e) => e.includes('is not an https URL'))).toBe(true);
    expect(errors.some((e) => e.includes('"evil.example" is not in site.allowedRetailerHosts'))).toBe(true);
  });

  it('refuses scaleVerified without verified dimensions', () => {
    const c = clone(real());
    c.products[0].assets.scaleVerified = true;
    const { errors } = validateCatalog(c, ctx);
    expect(errors.some((e) => e.includes('cannot be true without verified exterior dimensions'))).toBe(true);
  });

  it('enforces the 1% scale tolerance against measured models', () => {
    const c = withFixture();
    const p = c.products[4];
    p.assets.scaleVerified = true;
    const meters = [29.75, 28.5, 24.5].map((n) => n * 0.0254) as [number, number, number];
    const ok: ModelStats = { bytes: 1000, triangles: 10, size: meters };
    const off: ModelStats = { ...ok, size: [meters[0] * 1.05, meters[1], meters[2]] };
    expect(validateCatalog(c, { ...ctx, modelStats: new Map([[p.assets.model, ok]]) }).errors).toEqual([]);
    const { errors } = validateCatalog(c, { ...ctx, modelStats: new Map([[p.assets.model, off]]) });
    expect(errors.some((e) => e.includes('model width') && e.includes('5.0%'))).toBe(true);
  });

  it('flags models over the transfer and triangle budgets', () => {
    const c = withFixture();
    const big: ModelStats = { bytes: 4_000_000, triangles: 200_000, size: [1, 1, 1] };
    const { warnings } = validateCatalog(c, { ...ctx, modelStats: new Map([['models/range.glb', big]]) });
    expect(warnings.some((w) => w.includes('MB exceeds'))).toBe(true);
    expect(warnings.some((w) => w.includes('triangles exceeds'))).toBe(true);
  });

  it('warns when a current price is past its freshness period', () => {
    const c = withFixture();
    c.products[4].commerce.priceVerifiedAt = '2026-06-01';
    const { warnings } = validateCatalog(c, ctx);
    expect(warnings.some((w) => w.includes('past its freshness period'))).toBe(true);
  });

  it('requires a retailer status of invalid when there is no URL', () => {
    const c = withFixture();
    c.products[4].commerce.retailerUrl = null;
    expect(validateCatalog(c, ctx).errors.some((e) => e.includes('retailerUrl: null requires'))).toBe(true);
    c.products[4].commerce.retailerStatus = 'invalid';
    expect(validateCatalog(c, ctx).errors).toEqual([]);
  });
});
