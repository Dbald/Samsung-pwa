import { CATEGORIES, type Catalog, type ProductRecord, type SiteConfig } from './types';

export interface ModelStats {
  bytes: number;
  triangles: number;
  /** Axis-aligned size in meters: [x (width), y (height), z (depth)]. */
  size: [number, number, number];
}

export interface ValidationContext {
  /** Whether a path relative to /assets exists. */
  assetExists: (path: string) => boolean;
  /** Measured runtime models, keyed by `assets.model`. Optional for fast unit checks. */
  modelStats?: Map<string, ModelStats>;
  /**
   * Release mode turns "not yet verified" warnings into errors. Preview builds
   * may ship pending content; a public release may not.
   */
  release?: boolean;
  /** Clock for freshness checks; injectable for tests. */
  now?: Date;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const TO_METERS = { in: 0.0254, cm: 0.01, mm: 0.001 } as const;

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));

export function isHttpsUrl(value: unknown): value is string {
  if (!isStr(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function toMeters(value: number, unit: keyof typeof TO_METERS): number {
  return value * TO_METERS[unit];
}

/** Validates the whole catalog. Never throws on bad input; reports instead. */
export function validateCatalog(raw: unknown, ctx: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pending = (msg: string) => (ctx.release ? errors : warnings).push(msg);

  if (!isObj(raw)) return { errors: ['catalog: expected an object with "site" and "products"'], warnings };
  const site = raw.site;
  if (!isObj(site)) errors.push('site: missing or not an object (catalog/site.json)');
  else validateSite(site, errors);

  const products = raw.products;
  if (!Array.isArray(products) || products.length === 0) {
    errors.push('products: expected at least one record in catalog/products/');
    return { errors, warnings };
  }

  const allowedHosts = isObj(site) && Array.isArray(site.allowedRetailerHosts) ? (site.allowedRetailerHosts as string[]) : [];
  const budgets = isObj(site) && isObj(site.budgets) ? (site.budgets as unknown as SiteConfig['budgets']) : null;
  const seen = { id: new Map<string, number>(), slug: new Map<string, number>(), legacy: new Map<string, number>() };

  products.forEach((p, i) => {
    const where = isObj(p) && isStr(p.id) ? `products[${p.id}]` : `products[${i}]`;
    if (!isObj(p)) {
      errors.push(`${where}: expected an object`);
      return;
    }
    const err = (msg: string) => errors.push(`${where}.${msg}`);
    const warn = (msg: string) => warnings.push(`${where}.${msg}`);
    const pend = (msg: string) => pending(`${where}.${msg}`);

    for (const key of ['id', 'slug'] as const) {
      const v = p[key];
      if (!isStr(v) || !ID_RE.test(v)) err(`${key}: must be lowercase letters, digits and dashes`);
      else if (seen[key].has(v)) err(`${key}: duplicate "${v}" (also used by products[${seen[key].get(v)}])`);
      else seen[key].set(v, i);
    }
    if (!Array.isArray(p.legacyPaths)) err('legacyPaths: expected an array (may be empty)');
    else
      for (const lp of p.legacyPaths) {
        if (!isStr(lp) || lp.startsWith('/') || lp.includes('..')) err(`legacyPaths: "${String(lp)}" must be a relative path`);
        else if (seen.legacy.has(lp)) err(`legacyPaths: "${lp}" is already redirected by products[${seen.legacy.get(lp)}]`);
        else seen.legacy.set(lp, i);
      }
    if (!isStr(p.category) || !(p.category in CATEGORIES))
      err(`category: "${String(p.category)}" is not one of ${Object.keys(CATEGORIES).join(', ')}`);
    for (const key of ['brand', 'title', 'sku', 'description', 'finish'] as const) if (!isStr(p[key])) err(`${key}: required text`);

    if (!isStr(p.finishSwatch) || !HEX_RE.test(p.finishSwatch)) err('finishSwatch: hex colour like #c9ccd1');
    if (!Array.isArray(p.variants)) err('variants: expected an array (may be empty)');
    else {
      const ids = new Set<string>();
      p.variants.forEach((v, k) => {
        const at = `variants[${k}]`;
        if (!isObj(v)) return err(`${at}: expected an object`);
        if (!isStr(v.id) || !ID_RE.test(v.id)) err(`${at}.id: lowercase letters, digits and dashes`);
        else if (ids.has(v.id)) err(`${at}.id: duplicate "${v.id}"`);
        else ids.add(v.id);
        if (!isStr(v.finish) || !isStr(v.sku)) err(`${at}: finish and sku are required`);
        if (!isStr(v.swatch) || !HEX_RE.test(v.swatch)) err(`${at}.swatch: hex colour like #2b2d31`);
        if (!Array.isArray(v.tint) || v.tint.length !== 3 || v.tint.some((n) => !isNum(n) || n < 0 || n > 1))
          err(`${at}.tint: three numbers between 0 and 1`);
        if (!isHttpsUrl(v.retailerUrl)) err(`${at}.retailerUrl: https URL required`);
        else if (!allowedHosts.includes(new URL(v.retailerUrl).hostname)) err(`${at}.retailerUrl: host is not in site.allowedRetailerHosts`);
        // Only finishes confirmed for this SKU family may be offered.
        if (!isHttpsUrl(v.sourceUrl) || !isDate(v.verifiedAt)) err(`${at}: offered finishes need an https sourceUrl and a verifiedAt date`);
      });
    }

    if (p.benefit !== null) {
      const b = p.benefit;
      if (!isObj(b) || !isStr(b.text) || !isHttpsUrl(b.sourceUrl) || !isDate(b.verifiedAt))
        err('benefit: needs text, an https sourceUrl and a YYYY-MM-DD verifiedAt, or null');
    } else pend('benefit: no verified everyday benefit yet');
    if (!Array.isArray(p.features) || p.features.some((f) => !isObj(f) || !isStr(f.title) || !isStr(f.text)))
      err('features: expected [{ title, text }]');

    const spec = p.specifications;
    let exteriorMeters: [number, number, number] | null = null;
    if (!isObj(spec)) err('specifications: required object');
    else {
      const ext = spec.exterior;
      if (ext === null) pend('specifications.exterior: dimensions not yet taken from an authoritative source');
      else if (!isObj(ext) || ![ext.width, ext.height, ext.depth].every((n) => isNum(n) && n > 0) || !isStr(ext.unit) || !(ext.unit in TO_METERS))
        err('specifications.exterior: needs positive width, height, depth and unit in|cm|mm');
      else {
        const u = ext.unit as keyof typeof TO_METERS;
        exteriorMeters = [toMeters(ext.width as number, u), toMeters(ext.height as number, u), toMeters(ext.depth as number, u)];
        if (!isHttpsUrl(spec.sourceUrl)) err('specifications.sourceUrl: dimensions need an https source');
        if (!isDate(spec.verifiedAt)) err('specifications.verifiedAt: dimensions need a YYYY-MM-DD verification date');
      }
      if (spec.clearances !== null) {
        const c = spec.clearances;
        if (!isObj(c) || !isStr(c.text) || !isHttpsUrl(c.sourceUrl) || !isDate(c.verifiedAt))
          err('specifications.clearances: needs text, an https sourceUrl and verifiedAt, or null');
      }
    }

    const a = p.assets;
    if (!isObj(a)) err('assets: required object');
    else {
      for (const key of ['model', 'poster', 'source'] as const) {
        if (!isStr(a[key])) err(`assets.${key}: required path`);
        else if (!ctx.assetExists(a[key] as string)) err(`assets.${key}: file "assets/${a[key]}" not found`);
      }
      if (isStr(a.model) && !a.model.endsWith('.glb')) err('assets.model: runtime models must be packaged as .glb');
      if (a.usdz !== null && (!isStr(a.usdz) || !ctx.assetExists(a.usdz))) err('assets.usdz: file not found (use null to let the viewer generate one)');
      if (!isStr(a.posterAlt)) err('assets.posterAlt: required text alternative');
      if (!Array.isArray(a.images) || a.images.some((im) => !isObj(im) || !isStr(im.src) || !isStr(im.alt) || !ctx.assetExists(im.src)))
        err('assets.images: each image needs an existing src and alt text');
      if (!Number.isInteger(a.assetVersion) || (a.assetVersion as number) < 1) err('assets.assetVersion: positive integer');
      if (typeof a.scaleVerified !== 'boolean') err('assets.scaleVerified: boolean');
      if (!['floor', 'wall', 'none'].includes(a.placementType as string)) err('assets.placementType: floor | wall | none');
      if (!isStr(a.cameraOrbit)) err('assets.cameraOrbit: approved framing required');
      if (a.tintMaterials !== null && (!Array.isArray(a.tintMaterials) || a.tintMaterials.some((m) => !isStr(m))))
        err('assets.tintMaterials: list of material names, or null for all');

      if (a.scaleVerified === true && !exteriorMeters) err('assets.scaleVerified: cannot be true without verified exterior dimensions');
      if (a.placementType !== 'none' && a.scaleVerified !== true)
        pend('assets.scaleVerified: model scale unverified, so "View in your space" stays hidden');

      const stats = isStr(a.model) ? ctx.modelStats?.get(a.model) : undefined;
      if (stats && budgets) {
        if (stats.bytes > budgets.maxModelBytes)
          warn(`assets.model: ${(stats.bytes / 1e6).toFixed(2)} MB exceeds the ${(budgets.maxModelBytes / 1e6).toFixed(1)} MB budget`);
        if (stats.triangles > budgets.maxTriangles) warn(`assets.model: ${stats.triangles} triangles exceeds the ${budgets.maxTriangles} budget`);
        if (a.scaleVerified === true && exteriorMeters) {
          const labels = ['width', 'height', 'depth'];
          stats.size.forEach((got, k) => {
            const want = exteriorMeters![k];
            const off = Math.abs(got - want) / want;
            if (off > budgets.scaleTolerance)
              err(`assets.scaleVerified: model ${labels[k]} ${got.toFixed(3)} m differs from spec ${want.toFixed(3)} m by ${(off * 100).toFixed(1)}%`);
          });
        }
      }
    }

    const c = p.commerce;
    if (!isObj(c)) err('commerce: required object');
    else {
      if (!isStr(c.retailerName)) err('commerce.retailerName: required');
      if (!['verified', 'unverified', 'invalid'].includes(c.retailerStatus as string)) err('commerce.retailerStatus: verified | unverified | invalid');
      if (c.retailerUrl !== null) {
        if (!isHttpsUrl(c.retailerUrl)) err(`commerce.retailerUrl: "${String(c.retailerUrl)}" is not an https URL`);
        else if (!allowedHosts.includes(new URL(c.retailerUrl).hostname))
          err(`commerce.retailerUrl: host "${new URL(c.retailerUrl).hostname}" is not in site.allowedRetailerHosts`);
      } else if (c.retailerStatus !== 'invalid') err('commerce.retailerUrl: null requires retailerStatus "invalid"');
      if (c.retailerStatus === 'verified' && !isDate(c.retailerCheckedAt)) err('commerce.retailerCheckedAt: verified links need a check date');
      if (c.retailerStatus === 'unverified') pend('commerce.retailerStatus: retailer destination not yet verified');
      if (c.retailerStatus === 'invalid') warn('commerce.retailerStatus: retailer action is disabled for this product');

      if (!['historical', 'current'].includes(c.demoStatus as string)) err('commerce.demoStatus: historical | current');
      if (c.price !== null) {
        if (!isNum(c.price) || c.price <= 0) err('commerce.price: positive number or null');
        if (!isStr(c.currency) || !/^[A-Z]{3}$/.test(c.currency)) err('commerce.currency: ISO 4217 code required with a price');
        if (!isStr(c.priceSource)) err('commerce.priceSource: say where the price came from');
        if (c.demoStatus === 'current') {
          if (!isDate(c.priceVerifiedAt)) err('commerce.priceVerifiedAt: current prices need a verification date');
          else if (isObj(site) && isNum(site.priceFreshnessDays) && isStale(c.priceVerifiedAt, site.priceFreshnessDays, ctx.now))
            warn('commerce.priceVerifiedAt: price is past its freshness period and will be hidden');
        }
      }
    }

    const g = p.governance;
    if (!isObj(g)) err('governance: required object');
    else {
      if (!isStr(g.assetOwner)) err('governance.assetOwner: required (use "Unknown" while under review)');
      if (!['pending', 'approved', 'rejected'].includes(g.approvalStatus as string)) err('governance.approvalStatus: pending | approved | rejected');
      if (g.approvalStatus === 'rejected') err('governance.approvalStatus: rejected records must be removed from the catalog');
      if (g.approvalStatus === 'pending') pend('governance.approvalStatus: content and asset rights awaiting owner approval');
      if (g.license !== null && !isStr(g.license)) err('governance.license: text or null');
    }
  });

  return { errors, warnings };
}

function validateSite(site: Raw, errors: string[]) {
  for (const key of ['name', 'shortName', 'tagline', 'lang', 'themeColor', 'backgroundColor'] as const)
    if (!isStr(site[key])) errors.push(`site.${key}: required text`);
  if (!Array.isArray(site.allowedRetailerHosts) || site.allowedRetailerHosts.some((h) => !isStr(h)))
    errors.push('site.allowedRetailerHosts: expected a list of host names');
  if (!isNum(site.priceFreshnessDays) || site.priceFreshnessDays <= 0) errors.push('site.priceFreshnessDays: positive number');
  const cache = site.cache;
  if (!isObj(cache) || ![cache.maxPages, cache.maxModels, cache.maxPosters].every((n) => Number.isInteger(n) && (n as number) > 0))
    errors.push('site.cache: maxPages, maxModels and maxPosters must be positive integers');
  const an = site.analytics;
  if (!isObj(an) || (an.endpoint !== null && !isHttpsUrl(an.endpoint) && !(isStr(an.endpoint) && an.endpoint.startsWith('/'))) || typeof an.requireConsent !== 'boolean')
    errors.push('site.analytics: endpoint must be null, a same-origin path or an https URL; requireConsent boolean');
  const b = site.budgets;
  if (!isObj(b) || ![b.maxModelBytes, b.maxTriangles, b.scaleTolerance].every((n) => isNum(n) && n > 0))
    errors.push('site.budgets: maxModelBytes, maxTriangles and scaleTolerance must be positive numbers');
}

export function isStale(date: string, days: number, now = new Date()): boolean {
  return now.getTime() - Date.parse(date) > days * 86_400_000;
}

/** Narrowing helper once validation passed. */
export function asCatalog(raw: unknown): Catalog {
  return raw as Catalog;
}

export function arEnabled(p: ProductRecord): boolean {
  return p.assets.placementType !== 'none' && p.assets.scaleVerified;
}
