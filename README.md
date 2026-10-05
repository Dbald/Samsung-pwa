# Kitchen Appliance Showroom

A reusable 3D appliance showroom, delivered as an installable web app. Shoppers browse a
catalog, read verified product details, inspect the appliance in 3D, preview it in their
room where the device supports it, and continue to the retailer.

This is the Release 1 rebuild of the 2020 A-Frame prototype described in the
*Samsung PWA Assessment and Upgrade PRD* (v1.1). The four historical Samsung listings are
kept as a **concept demo** until their data, assets and rights are verified. See
[docs/release-status.md](docs/release-status.md) for what is done and what still needs a
decision.

## Quick start

```sh
npm ci
npm run dev          # http://localhost:5173, pages render live from catalog/
npm run check        # validate, typecheck, unit tests, build, browser tests
npm run preview      # serve dist/ with the production headers and redirects
```

Node 20.19+ is required. The browser tests use Playwright's Chromium
(`npx playwright install chromium` the first time).

## How it works

- **One catalog.** `catalog/site.json` holds site settings; each product is one JSON file in
  `catalog/products/`. Every page, redirect, the manifest and the service worker precache
  list are generated from it. A malformed record fails the build with a message naming the
  record and field.
- **Readable HTML first.** Product facts, prices and the retailer link are static HTML.
  They don't depend on JavaScript or WebGL succeeding.
- **3D on demand.** A poster renders immediately. `<model-viewer>` is loaded as a separate
  chunk when the viewer comes into view, or on tap when Data Saver is on. The viewer sits
  behind a small adapter (`src/client/viewer/`), so the renderer can be swapped without
  touching product data.
- **AR only when it can be trusted.** "View in your space" appears only when the record's
  scale is verified against authoritative dimensions *and* the device supports WebXR,
  Scene Viewer or Quick Look. Add `?ar-test` to a product URL to try the AR launch path on
  a device before scale is verified. The page labels it as test mode.
- **Installable and offline-aware.** The app includes a web app manifest, maskable icons,
  and a service worker that precaches the shell and posters. It keeps the last 8 product
  pages and 2 models and versions every cache. Updates show a "Reload" prompt rather
  than mixing versions.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with live catalog rendering |
| `npm run build` | Typecheck and production build to `dist/` (fails on catalog errors) |
| `npm run preview` | Serve `dist/` with `_headers` and `_redirects` applied |
| `npm run validate` | Catalog and asset checks (pending verification = warnings) |
| `npm run validate:release` | Same checks with release rules (anything unverified fails) |
| `npm run assets` | Package source glTF exports into runtime GLBs in `assets/models/` |
| `npm run posters` | Render product posters from the GLBs |
| `npm run icons` | Rasterize the app icon |
| `npm test` / `npm run test:e2e` | Unit tests / browser tests against the build |

## Layout

```
catalog/            site.json + one JSON record per product
assets/models/      runtime GLBs (deployed, content-hashed)
assets/posters/     rendered posters (deployed)
assets/icons/       app icons
assets/source/      original exports and the 2020 logo, never deployed
src/catalog/        record types and validation
src/render/         HTML, manifest and redirect generation
src/client/         browser code: viewer, analytics, handoff, PWA
src/sw/sw.js        service worker
src/node/           Vite plugin, catalog loading and model measurement
scripts/            asset, poster, icon, validation and preview tooling
tests/              unit (Vitest) and browser (Playwright) tests
docs/               catalog, deployment, analytics and release status
```

## Documentation

- [Adding or updating a product](docs/catalog.md)
- [Deployment, hosting and rollback](docs/deployment.md)
- [Analytics contract](docs/analytics.md)
- [Release status, asset audit and open decisions](docs/release-status.md)
