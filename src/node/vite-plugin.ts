// Vite plugin that turns the catalog into a static multipage site.
//   dev:   renders pages on request and serves /assets/<path> straight from assets/
//   build: validates the catalog (errors fail the build), emits HTML, content-hashed
//          models/posters/icons, the web app manifest, service worker and host config.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type { Catalog } from '../catalog/types';
import {
  productPath,
  renderManifest,
  renderRedirectRules,
  renderSite,
  type RenderContext,
} from '../render/pages';
import { ASSETS_DIR, CATALOG_DIR, ROOT, formatReport, loadCatalog } from './catalog-fs';

const MIME: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.usdz': 'model/vnd.usdz+zip',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Files from assets/ that every build ships (models and posters come from records). */
const ICONS = ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

function catalogAssets(catalog: Catalog): string[] {
  const set = new Set(ICONS);
  for (const p of catalog.products) {
    set.add(p.assets.model).add(p.assets.poster);
    if (p.assets.usdz) set.add(p.assets.usdz);
    for (const im of p.assets.images) set.add(im.src);
  }
  return [...set];
}

export function contentSecurityPolicy(analyticsEndpoint: string | null): string {
  const connect = ["'self'", 'blob:', 'data:'];
  if (analyticsEndpoint?.startsWith('https://')) connect.push(new URL(analyticsEndpoint).origin);
  return [
    "default-src 'self'",
    "script-src 'self'",
    // model-viewer's shadow DOM applies inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function hostHeaders(base: string, csp: string): string {
  return `${base}*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), xr-spatial-tracking=(self), microphone=(), geolocation=()
${base}sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: ${base}
${base}manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: no-cache
${base}assets/*
  Cache-Control: public, max-age=31536000, immutable
${base}assets/models/*
  Content-Type: model/gltf-binary
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=31536000, immutable
`;
}

export function showroomPlugin(): Plugin {
  let config: ResolvedConfig;
  const appVersion = process.env.APP_VERSION ?? JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

  return {
    name: 'showroom',
    configResolved(resolved) {
      config = resolved;
    },

    configureServer(server) {
      const base = config.base;
      server.watcher.add([CATALOG_DIR, ASSETS_DIR]);
      server.watcher.on('change', (file) => {
        if (file.startsWith(CATALOG_DIR)) server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://dev.local');
        const path = decodeURIComponent(url.pathname);
        if (!path.startsWith(base)) return next();
        const rel = path.slice(base.length);

        if (rel.startsWith('assets/') && MIME[extname(rel)]) {
          try {
            res.setHeader('Content-Type', MIME[extname(rel)]);
            res.end(readFileSync(join(ASSETS_DIR, rel.slice('assets/'.length))));
          } catch {
            res.statusCode = 404;
            res.end();
          }
          return;
        }

        const { catalog, errors, warnings } = await loadCatalog();
        if (errors.length) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(formatReport({ errors, warnings }));
          return;
        }
        if (rel === 'manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(renderManifest(catalog.site, { base, asset: (p) => `${base}assets/${p}` }));
          return;
        }
        const ctx: RenderContext = {
          base,
          asset: (p) => `${base}assets/${p}`,
          headTags: '<script type="module" src="/src/client/main.ts"></script>',
          appVersion: `${appVersion}-dev`,
          now: new Date(),
        };
        const want = rel === '' ? 'index.html' : rel.endsWith('/') ? `${rel}index.html` : rel;
        const page = renderSite(catalog, ctx).find((p) => p.file === want);
        if (!page) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await server.transformIndexHtml(url.pathname, page.html));
      });
    },

    async generateBundle(_options, bundle) {
      const base = config.base;
      const { catalog, errors, warnings } = await loadCatalog();
      if (warnings.length) this.warn(`\n${formatReport({ errors: [], warnings })}`);
      if (errors.length) this.error(`\n${formatReport({ errors, warnings: [] })}\nFix catalog/ and rebuild.`);

      // Content-hashed asset files.
      const urls = new Map<string, string>();
      for (const rel of catalogAssets(catalog)) {
        const source = readFileSync(join(ASSETS_DIR, rel));
        const hash = createHash('sha256').update(source).digest('hex').slice(0, 10);
        const ext = extname(rel);
        const fileName = `assets/${rel.slice(0, -ext.length)}-${hash}${ext}`;
        this.emitFile({ type: 'asset', fileName, source });
        urls.set(rel, `${base}${fileName}`);
      }
      const asset = (rel: string) => {
        const url = urls.get(rel);
        if (!url) this.error(`Asset "${rel}" is referenced but was not emitted`);
        return url!;
      };

      const entry = Object.values(bundle).find(
        (c): c is Extract<typeof c, { type: 'chunk' }> => c.type === 'chunk' && c.isEntry && c.name === 'main',
      );
      if (!entry) this.error('Client entry chunk "main" not found');
      const css = [...(entry!.viteMetadata?.importedCss ?? [])];
      const headTags = [
        ...css.map((f) => `<link rel="stylesheet" href="${base}${f}">`),
        `<script type="module" src="${base}${entry!.fileName}"></script>`,
        ...entry!.imports.map((f) => `<link rel="modulepreload" href="${base}${f}">`),
      ].join('\n');

      const ctx: RenderContext = { base, asset, headTags, appVersion, now: new Date() };
      for (const page of renderSite(catalog, ctx)) this.emitFile({ type: 'asset', fileName: page.file, source: page.html });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: renderManifest(catalog.site, ctx) });
      this.emitFile({ type: 'asset', fileName: '_redirects', source: renderRedirectRules(catalog, base) });
      this.emitFile({ type: 'asset', fileName: '_headers', source: hostHeaders(base, contentSecurityPolicy(catalog.site.analytics.endpoint)) });
      this.emitFile({
        type: 'asset',
        fileName: 'catalog.json',
        source: JSON.stringify({ version: appVersion, products: catalog.products.map((p) => ({ id: p.id, url: `${base}${productPath(p)}` })) }),
      });

      const precache = [
        base,
        `${base}offline.html`,
        `${base}compare/`,
        `${base}manifest.webmanifest`,
        `${base}${entry!.fileName}`,
        ...entry!.imports.map((f) => `${base}${f}`),
        ...css.map((f) => `${base}${f}`),
        ...ICONS.map(asset),
        ...catalog.products.map((p) => asset(p.assets.poster)),
      ];
      // The version changes whenever any precached file changes, so updates are detected.
      const version = createHash('sha256').update(appVersion).update(precache.join('\n')).digest('hex').slice(0, 12);
      const swConfig = { version, base, precache, ...catalog.site.cache };
      const sw = readFileSync(join(ROOT, 'src/sw/sw.js'), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `self.__SW_CONFIG__ = ${JSON.stringify(swConfig)};\n${sw}` });
    },
  };
}
