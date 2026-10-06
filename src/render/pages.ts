// Generates readable, self-sufficient HTML from the catalog. Shopping information
// never depends on the 3D viewer or JavaScript: scripts only enhance these pages.
import { CATEGORIES, type Catalog, type ProductRecord, type SiteConfig } from '../catalog/types';
import { arEnabled, isStale, toMeters } from '../catalog/validate';

export interface RenderContext {
  /** Public base path, always ending in "/". */
  base: string;
  /** Resolves a path relative to /assets to its public URL (hashed in production). */
  asset: (path: string) => string;
  /** Tags for the client bundle, injected at the end of <head>. */
  headTags: string;
  appVersion: string;
  now: Date;
}

export interface ClientConfig {
  version: string;
  base: string;
  analytics: SiteConfig['analytics'];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const productPath = (p: ProductRecord) => `products/${p.slug}/`;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function layout(
  site: SiteConfig,
  ctx: RenderContext,
  opts: { title: string; description: string; page: string; productId?: string; main: string; noindex?: boolean },
): string {
  const config: ClientConfig = { version: ctx.appVersion, base: ctx.base, analytics: site.analytics };
  const notice = site.demoNotice
    ? `<p class="demo-notice"><strong>Concept demo.</strong> ${esc(site.demoNotice)}</p>`
    : '';
  return `<!doctype html>
<html lang="${esc(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
${opts.noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="${esc(site.themeColor)}">
<meta name="color-scheme" content="light dark">
<link rel="manifest" href="${ctx.base}manifest.webmanifest">
<link rel="icon" href="${ctx.asset('icons/icon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ctx.asset('icons/apple-touch-icon.png')}">
<script type="application/json" id="app-config">${JSON.stringify(config).replace(/</g, '\\u003c')}</script>
${ctx.headTags}
</head>
<body data-page="${opts.page}"${opts.productId ? ` data-product-id="${esc(opts.productId)}"` : ''}>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="${ctx.base}"><img src="${ctx.asset('icons/icon.svg')}" alt="" width="32" height="32"><span>${esc(site.name)}</span></a>
  <div class="site-header__actions">
    <a class="header-link" href="${ctx.base}compare/" data-saved-link hidden>Saved <span class="count" data-saved-count>0</span></a>
    <button type="button" class="btn btn--ghost install-btn" data-install hidden>Install app</button>
  </div>
</header>
<div class="net-status" data-net-status role="status" aria-live="polite" hidden></div>
${notice}
<main id="main" tabindex="-1">
${opts.main}
</main>
<footer class="site-footer">
  <p>${esc(site.name)} · version ${esc(ctx.appVersion)}</p>
  <p>3D views are visual previews. Check the retailer and the installation guide before you buy or install.</p>
</footer>
<dialog class="install-dialog" data-install-dialog aria-labelledby="install-title">
  <h2 id="install-title">Install ${esc(site.shortName)}</h2>
  <p data-install-steps>Open your browser menu and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</p>
  <form method="dialog"><button class="btn btn--primary">Close</button></form>
</dialog>
<div class="toast" data-update-toast role="status" hidden>
  <span>An updated version is ready.</span>
  <button type="button" class="btn btn--primary" data-update-reload>Reload</button>
</div>
</body>
</html>
`;
}

function priceBlock(p: ProductRecord, site: SiteConfig, now: Date): string {
  const c = p.commerce;
  if (c.price === null || !c.currency) return '';
  const amount = formatPrice(c.price, c.currency);
  if (c.demoStatus === 'historical')
    return `<p class="price price--historical"><span class="price__label">Historical price${c.priceSource ? `, ${esc(c.priceSource)}` : ''}</span>
      <span class="price__amount">${amount}</span><span class="price__note">Historical, not a current offer.</span></p>`;
  if (!c.priceVerifiedAt || isStale(c.priceVerifiedAt, site.priceFreshnessDays, now)) return '';
  const expires = new Date(Date.parse(c.priceVerifiedAt) + site.priceFreshnessDays * 86_400_000).toISOString();
  return `<p class="price" data-price-expires="${expires}"><span class="price__amount">${amount}</span>
    <span class="price__note">Price checked ${formatDate(c.priceVerifiedAt)} at ${esc(c.retailerName)}. The retailer's price applies.</span></p>`;
}

function retailerBlock(p: ProductRecord): string {
  const c = p.commerce;
  const label = `View at ${esc(c.retailerName)}`;
  if (c.retailerStatus === 'invalid' || !c.retailerUrl)
    return `<div class="retailer"><button type="button" class="btn btn--primary" disabled aria-describedby="retailer-note">${label}</button>
      <p class="retailer__note" id="retailer-note">The retailer listing for this product isn't available right now, so this link is turned off.</p></div>`;
  const note =
    c.retailerStatus === 'verified'
      ? `Listing checked ${formatDate(c.retailerCheckedAt!)}.`
      : c.demoStatus === 'historical'
        ? 'This is the 2020 listing. The retailer may have changed or retired the page.'
        : 'This listing has not been checked yet.';
  return `<div class="retailer">
    <a class="btn btn--primary" href="${esc(c.retailerUrl)}" rel="noopener" data-retailer aria-describedby="retailer-note">${label}<span class="visually-hidden"> (opens the retailer's site)</span></a>
    <p class="retailer__note" id="retailer-note">${esc(note)} <span data-retailer-offline hidden>Connect to the internet to continue to the retailer.</span></p></div>`;
}

function dimensionsBlock(p: ProductRecord): string {
  const s = p.specifications;
  const ext = s.exterior;
  let out: string;
  if (!ext)
    out = `<p class="pending">Exterior dimensions haven't been verified against an authoritative source yet, so none are shown. Check the retailer listing.</p>`;
  else {
    const rows = (['width', 'height', 'depth'] as const)
      .map((k) => {
        const cm = toMeters(ext[k], ext.unit) * 100;
        return `<tr><th scope="row">${k[0].toUpperCase()}${k.slice(1)}</th><td>${ext[k]} ${ext.unit}</td><td>${cm.toFixed(1)} cm</td></tr>`;
      })
      .join('');
    out = `<table class="dims"><caption>Exterior dimensions. Source: <a href="${esc(s.sourceUrl!)}" rel="noopener">specification sheet</a>, checked ${formatDate(s.verifiedAt!)}.</caption>
      <thead><tr><th scope="col">Measure</th><th scope="col">Listed</th><th scope="col">Metric</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const clear = s.clearances
    ? `<h3>Installation clearances</h3><p>${esc(s.clearances.text)} <a href="${esc(s.clearances.sourceUrl)}" rel="noopener">Installation guide</a>, checked ${formatDate(s.clearances.verifiedAt)}.</p>`
    : `<p class="pending">Installation clearances are separate from exterior size. Use the manufacturer's installation guide.</p>`;
  return `<section class="panel" aria-labelledby="dims-h"><h2 id="dims-h">Dimensions</h2>${out}${clear}</section>`;
}

function viewerBlock(p: ProductRecord, ctx: RenderContext): string {
  const a = p.assets;
  const ar = arEnabled(p);
  const placementHint =
    a.placementType === 'wall'
      ? 'Point your camera at the wall where the appliance would hang, then move slowly until it appears.'
      : 'Point your camera at the floor, then move slowly until the appliance appears.';
  const arNote = ar
    ? `<p class="viewer__ar-note" data-ar-note hidden>${placementHint} This is a visual preview. It doesn't check fit, clearances or room measurements.</p>`
    : `<p class="viewer__ar-note">In-room preview isn't available for this product yet.${p.governance.fallbackReason ? ` ${esc(p.governance.fallbackReason)}` : ''}</p>`;
  return `<section class="viewer" data-viewer
    data-model="${ctx.asset(a.model)}"${a.usdz ? ` data-usdz="${ctx.asset(a.usdz)}"` : ''}
    data-poster="${ctx.asset(a.poster)}" data-orbit="${esc(a.cameraOrbit)}" data-placement="${a.placementType}"
    data-ar="${ar}" data-title="${esc(p.title)}" aria-labelledby="viewer-h">
  <h2 id="viewer-h" class="visually-hidden">Product view</h2>
  <div class="viewer__stage" data-stage>
    <img class="viewer__poster" src="${ctx.asset(a.poster)}" alt="${esc(a.posterAlt)}" width="800" height="800" fetchpriority="high">
    <div class="viewer__progress" data-progress role="progressbar" aria-label="Loading 3D model" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><span></span></div>
  </div>
  <p class="viewer__status" data-status role="status" aria-live="polite"></p>
  <div class="viewer__controls">
    <button type="button" class="btn btn--secondary" data-action="load">Inspect in 3D</button>
    <button type="button" class="btn btn--secondary" data-action="reset" hidden>Reset view</button>
    <button type="button" class="btn btn--secondary" data-action="retry" hidden>Try again</button>
    <button type="button" class="btn btn--secondary" data-action="ar" hidden>View in your space</button>
  </div>
  <p class="viewer__hint" data-hint hidden>Drag or use arrow keys to rotate. Pinch, scroll or use +/− to zoom.</p>
  ${arNote}
</section>`;
}

function saveButton(p: ProductRecord, compact = false): string {
  const label = compact ? `Save ${esc(p.title)}` : '';
  return `<button type="button" class="btn btn--ghost save-btn${compact ? ' save-btn--compact' : ''}" data-save="${esc(p.id)}" aria-pressed="false"${
    label ? ` aria-label="${label}"` : ''
  } hidden><span aria-hidden="true" class="save-btn__icon">♡</span><span class="save-btn__text">Save</span></button>`;
}

/** Swatches for verified finishes. Without JavaScript the base finish facts remain correct. */
function finishesBlock(p: ProductRecord): string {
  if (!p.variants.length) return '';
  const base = p.commerce.retailerUrl ?? '';
  const option = (id: string, finish: string, sku: string, swatch: string, tint: string, retailer: string, checked: boolean) =>
    `<label class="swatch" title="${esc(finish)}"><input type="radio" name="finish" value="${esc(id)}"${checked ? ' checked' : ''}
      data-variant-finish="${esc(finish)}" data-variant-sku="${esc(sku)}" data-variant-tint="${tint}" data-variant-retailer="${esc(retailer)}">
      <span class="swatch__chip" style="--swatch:${swatch}" aria-hidden="true"></span><span class="visually-hidden">${esc(finish)}</span></label>`;
  return `<fieldset class="finishes" data-finishes data-tint-materials="${esc(JSON.stringify(p.assets.tintMaterials))}">
    <legend>Finish: <span data-finish-legend>${esc(p.finish)}</span></legend>
    <div class="finishes__list">
      ${option('', p.finish, p.sku, p.finishSwatch, '', base, true)}
      ${p.variants.map((v) => option(v.id, v.finish, v.sku, v.swatch, v.tint.join(','), v.retailerUrl, false)).join('\n      ')}
    </div>
    <p class="finishes__note">Available as ${[p.finish, ...p.variants.map((v) => v.finish)].map(esc).join(', ')}. Photos show ${esc(p.finish)}; the 3D view shows the selected finish.</p>
  </fieldset>`;
}

function verificationBlock(p: ProductRecord): string {
  const s = p.specifications;
  const c = p.commerce;
  const g = p.governance;
  const item = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  return `<section class="panel panel--quiet" aria-labelledby="sources-h"><h2 id="sources-h">About this information</h2><dl class="facts">
    ${item('Specifications', s.verifiedAt ? `Checked ${formatDate(s.verifiedAt)}` : 'Not yet verified')}
    ${item('Retailer link', c.retailerStatus === 'verified' ? `Checked ${formatDate(c.retailerCheckedAt!)}` : c.retailerStatus === 'invalid' ? 'Unavailable' : 'Not yet verified')}
    ${item('3D model', `Version ${p.assets.assetVersion}. ${p.assets.scaleVerified ? 'Scale checked against the specifications' : 'Scale not yet checked; the model shows general form only'}.`)}
    ${item('Content approval', g.approvalStatus === 'approved' ? 'Approved' : 'Pending owner review')}
    ${g.attribution ? item('Model credit', esc(g.attribution)) : ''}
  </dl></section>`;
}

export function renderProduct(catalog: Catalog, p: ProductRecord, ctx: RenderContext): string {
  const { site } = catalog;
  const category = CATEGORIES[p.category];
  const benefit = p.benefit
    ? `<p class="benefit"><strong>Everyday benefit:</strong> ${esc(p.benefit.text)}</p>`
    : '';
  const features = p.features.length
    ? `<section class="panel" aria-labelledby="features-h"><h2 id="features-h">Features</h2><ul class="features">${p.features
        .map((f) => `<li><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`)
        .join('')}</ul></section>`
    : '';
  const main = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${ctx.base}#catalog" data-back>← All appliances</a></nav>
<article class="product" data-product-id="${esc(p.id)}">
  <div class="product__media">${viewerBlock(p, ctx)}</div>
  <div class="product__info">
    <p class="eyebrow">${esc(p.brand)} · ${category}</p>
    <h1>${esc(p.title)}</h1>
    <dl class="facts facts--inline">
      <div><dt>Model</dt><dd data-sku>${esc(p.sku)}</dd></div>
      <div><dt>Finish</dt><dd data-finish-name>${esc(p.finish)}</dd></div>
    </dl>
    ${finishesBlock(p)}
    <p class="lede">${esc(p.description)}</p>
    ${benefit}
    ${priceBlock(p, site, ctx.now)}
    ${retailerBlock(p)}
    <div class="product__actions">${saveButton(p)}</div>
  </div>
</article>
<div class="product__details">
  ${dimensionsBlock(p)}
  ${features}
  <section class="panel handoff" aria-labelledby="handoff-h" data-handoff>
    <h2 id="handoff-h">Continue on your phone</h2>
    <div class="handoff__qr" data-qr aria-hidden="true"></div>
    <p class="handoff__qr-text" data-qr-text hidden>Scan this code with your phone camera to open this product.</p>
    <label class="handoff__label" for="share-url">Link to this product</label>
    <div class="handoff__copy">
      <input id="share-url" data-share-url readonly value="${ctx.base}${productPath(p)}">
      <button type="button" class="btn btn--secondary" data-copy>Copy link</button>
    </div>
    <p class="handoff__status" data-copy-status role="status" aria-live="polite"></p>
  </section>
  ${verificationBlock(p)}
</div>`;
  return layout(site, ctx, {
    title: `${p.title} (${p.sku}) | ${site.name}`,
    description: `${p.description} Inspect it in 3D and continue to ${p.commerce.retailerName}.`,
    page: 'product',
    productId: p.id,
    main,
  });
}

export function renderCatalog(catalog: Catalog, ctx: RenderContext): string {
  const { site, products } = catalog;
  const cards = products
    .map((p) => {
      const price = priceBlock(p, site, ctx.now);
      return `<li class="card">
  <a class="card__link" href="${ctx.base}${productPath(p)}">
    <img class="card__img" src="${ctx.asset(p.assets.poster)}" alt="" width="800" height="800" loading="lazy" decoding="async">
    <span class="eyebrow">${CATEGORIES[p.category]}</span>
    <span class="card__title">${esc(p.title)}</span>
  </a>
  <p class="card__meta">${esc(p.sku)} · ${esc(p.finish)}${p.variants.length ? ` · ${p.variants.length + 1} finishes` : ''}</p>
  ${price}
  ${saveButton(p, true)}
</li>`;
    })
    .join('\n');
  const main = `<section class="hero" aria-labelledby="hero-h">
  <h1 id="hero-h">See the appliance before you choose it</h1>
  <p class="lede">${esc(site.tagline)}</p>
  <a class="btn btn--primary" href="#catalog">Browse appliances</a>
</section>
<section class="catalog" id="catalog" aria-labelledby="catalog-h" tabindex="-1">
  <div class="catalog__head">
    <h2 id="catalog-h">Kitchen appliances</h2>
    <a class="btn btn--ghost" href="${ctx.base}compare/">Compare appliances</a>
  </div>
  <ul class="grid">
${cards}
  </ul>
</section>`;
  return layout(site, ctx, { title: site.name, description: site.tagline, page: 'catalog', main });
}

function dimsText(p: ProductRecord, k: 'width' | 'height' | 'depth'): string {
  const ext = p.specifications.exterior;
  return ext ? `${ext[k]} ${ext.unit} (${(toMeters(ext[k], ext.unit) * 100).toFixed(1)} cm)` : '<span class="pending">Not verified</span>';
}

/**
 * Side-by-side comparison. Every product is rendered so the page works without
 * JavaScript and offline; the client narrows it to `?ids=` or the saved list.
 */
export function renderCompare(catalog: Catalog, ctx: RenderContext): string {
  const { site, products } = catalog;
  const col = (p: ProductRecord, body: string, head = false) =>
    head ? `<th scope="col" data-col="${esc(p.id)}">${body}</th>` : `<td data-col="${esc(p.id)}">${body}</td>`;
  const row = (label: string, cell: (p: ProductRecord) => string) =>
    `<tr><th scope="row">${label}</th>${products.map((p) => col(p, cell(p))).join('')}</tr>`;
  const retailer = (p: ProductRecord) =>
    p.commerce.retailerUrl && p.commerce.retailerStatus !== 'invalid'
      ? `<a href="${esc(p.commerce.retailerUrl)}" rel="noopener">View at ${esc(p.commerce.retailerName)}</a>`
      : 'Unavailable';
  const price = (p: ProductRecord) => {
    const html = priceBlock(p, site, ctx.now);
    return html || '<span class="pending">Not shown</span>';
  };
  const main = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${ctx.base}#catalog">← All appliances</a></nav>
<section aria-labelledby="compare-h">
  <h1 id="compare-h">Compare appliances</h1>
  <p class="lede" data-compare-intro>Showing every appliance. Save products to compare only those.</p>
  <div class="compare-scroll" role="region" aria-labelledby="compare-h" tabindex="0">
    <table class="compare">
      <caption class="visually-hidden">Appliance comparison. Each column is one product.</caption>
      <thead><tr><td></td>${products
        .map((p) =>
          col(
            p,
            `<a class="compare__product" href="${ctx.base}${productPath(p)}"><img src="${ctx.asset(p.assets.poster)}" alt="" width="160" height="160" loading="lazy"><span>${esc(p.title)}</span></a>
            <button type="button" class="btn btn--ghost compare__remove" data-remove="${esc(p.id)}" hidden>Remove<span class="visually-hidden"> ${esc(p.title)}</span></button>`,
            true,
          ),
        )
        .join('')}</tr></thead>
      <tbody>
        ${row('Category', (p) => CATEGORIES[p.category])}
        ${row('Model', (p) => esc(p.sku))}
        ${row('Finishes', (p) => [p.finish, ...p.variants.map((v) => v.finish)].map(esc).join('<br>'))}
        ${row('Width', (p) => dimsText(p, 'width'))}
        ${row('Height', (p) => dimsText(p, 'height'))}
        ${row('Depth', (p) => dimsText(p, 'depth'))}
        ${row('Price', price)}
        ${row('In-room preview', (p) => (arEnabled(p) ? 'Available on supported phones' : 'Not yet available'))}
        ${row('Retailer', retailer)}
      </tbody>
    </table>
  </div>
  <p class="pending" data-compare-empty hidden>None of the selected products are in the catalog. <a href="${ctx.base}compare/">Show all appliances</a>.</p>
</section>`;
  return layout(site, ctx, {
    title: `Compare appliances | ${site.name}`,
    description: 'Compare kitchen appliances side by side.',
    page: 'compare',
    main,
  });
}

export function renderOffline(catalog: Catalog, ctx: RenderContext): string {
  const main = `<section class="message" aria-labelledby="offline-h">
  <h1 id="offline-h">You're offline</h1>
  <p>This page hasn't been saved for offline use. Pages and product images you viewed recently are still available.</p>
  <ul class="recent" data-recent></ul>
  <p><a class="btn btn--primary" href="${ctx.base}">Go to the catalog</a></p>
</section>`;
  return layout(catalog.site, ctx, { title: `Offline | ${catalog.site.name}`, description: 'Offline', page: 'offline', main, noindex: true });
}

export function renderNotFound(catalog: Catalog, ctx: RenderContext): string {
  const main = `<section class="message" aria-labelledby="nf-h">
  <h1 id="nf-h">We couldn't find that page</h1>
  <p>The product may have moved. Browse the current catalog instead.</p>
  <p><a class="btn btn--primary" href="${ctx.base}">Browse appliances</a></p>
</section>`;
  return layout(catalog.site, ctx, { title: `Page not found | ${catalog.site.name}`, description: 'Not found', page: 'not-found', main, noindex: true });
}

/** Static fallback for hosts without redirect rules; `_redirects` handles it server-side where supported. */
export function renderRedirect(target: string): string {
  const t = esc(target);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moved</title><meta name="robots" content="noindex"><link rel="canonical" href="${t}">
<meta http-equiv="refresh" content="0; url=${t}"></head>
<body><p>This page has moved to <a href="${t}">${t}</a>.</p></body></html>
`;
}

export function renderManifest(site: SiteConfig, ctx: Pick<RenderContext, 'base' | 'asset'>): string {
  return JSON.stringify(
    {
      id: ctx.base,
      name: site.name,
      short_name: site.shortName,
      description: site.tagline,
      lang: site.lang,
      start_url: ctx.base,
      scope: ctx.base,
      display: 'standalone',
      orientation: 'any',
      theme_color: site.themeColor,
      background_color: site.backgroundColor,
      categories: ['shopping'],
      icons: [
        { src: ctx.asset('icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: ctx.asset('icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
        { src: ctx.asset('icons/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: ctx.asset('icons/icon.svg'), sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  );
}

export interface SitePage {
  /** Output path relative to the site root. */
  file: string;
  html: string;
}

/** Every HTML document the site serves, including legacy redirect stubs. */
export function renderSite(catalog: Catalog, ctx: RenderContext): SitePage[] {
  const pages: SitePage[] = [
    { file: 'index.html', html: renderCatalog(catalog, ctx) },
    { file: 'offline.html', html: renderOffline(catalog, ctx) },
    { file: '404.html', html: renderNotFound(catalog, ctx) },
    { file: 'compare/index.html', html: renderCompare(catalog, ctx) },
    { file: 'AR.html', html: renderRedirect(ctx.base) },
  ];
  for (const p of catalog.products) {
    pages.push({ file: `${productPath(p)}index.html`, html: renderProduct(catalog, p, ctx) });
    for (const legacy of p.legacyPaths) pages.push({ file: legacy, html: renderRedirect(`${ctx.base}${productPath(p)}`) });
  }
  return pages;
}

/** Netlify / Cloudflare Pages style redirect rules for the legacy URLs. */
export function renderRedirectRules(catalog: Catalog, base: string): string {
  const lines = [`${base}AR.html ${base} 301`, `${base}index.php ${base} 301`];
  for (const p of catalog.products) for (const legacy of p.legacyPaths) lines.push(`${base}${legacy} ${base}${productPath(p)} 301`);
  return `${lines.join('\n')}\n`;
}
