# Release 1 status

This tracks the build against the *Samsung PWA Assessment and Upgrade PRD* (v1.1,
5 October 2026). Release 1 is a **preview**. Code and automated checks are in place, but
the catalog content is not yet release-verified. `npm run validate:release` fails on
purpose until the decisions below are made.

## Requirements

| Req | Status | Where | Remaining |
| --- | --- | --- | --- |
| F01 Shared catalog and navigation | Done | `catalog/`, `src/render/pages.ts`, `src/node/vite-plugin.ts` | None. All four records open directly and through navigation, and Back and refresh work. There is no horizontal scroll at 320, 390, 768 or 1440 px, and the four 2020 URLs and `AR.html` redirect (tested). |
| F02 Reliable product inspection | Done | `src/client/viewer/` | The poster shows first. 3D loads near the viewport or on tap (Data Saver), with progress, reset, error and retry states. Blocked and corrupt models fall back to the poster plus details (tested). Auto-rotate is off. |
| F03 Useful product information | Partly done | `renderProduct` | The layout handles verified dimensions, clearances, the benefit and features. **None of that data is verified yet**, so the pages show "not yet verified" instead of guessing. Historical prices are labelled. |
| F04 AR placement and return | Built, not yet active | `model-viewer-adapter.ts` | WebXR, Scene Viewer and Quick Look are wired up with fixed scale, floor or wall placement, guidance and failure messages. AR is hidden until scale is verified. Use `?ar-test` for the Stage 1 device spike. **Needs testing on physical Android and iPhone devices.** |
| F05 Scale and placement accuracy | Tooling done | `scripts/prepare-assets.ts`, validator | Scaling and the 1% check run as soon as `specifications.exterior` is filled in. The microwave uses `wall` placement, which must be checked on a device. |
| F06 Retailer and phone handoff | Done | `retailerBlock`, `handoff.ts` | The action reads "View at {retailer}" and is tracked without delaying navigation. Desktop shows a QR code and there is a copy link (tested). Retailer URLs are **unverified**: the build environment cannot reach samsung.com. |
| F07 Installation and offline | Done in automation | `manifest.webmanifest`, `src/sw/sw.js`, `pwa.ts` | The manifest, maskable icons, install button and iOS instructions are in place. Offline, the shell, recent pages and posters work, and uncached models, AR and the retailer show unavailable states (tested). **Install still needs checking on real Android and iOS devices.** |
| F08 Cache updates and freshness | Done | `sw.js`, `vite-plugin.ts` | Asset URLs are hashed, caches are versioned and bounded, and an update prompt replaces hard refreshes. Pages are network-first. Prices expire on the client too. |
| F09 Accessibility | Automated checks pass | `tests/e2e/journey.spec.ts` | axe reports no serious or critical findings (WCAG 2.2 AA tags), and the keyboard path to the retailer works without 3D. Primary targets are at least 44 px and reduced motion is respected. **VoiceOver and TalkBack passes are still needed.** |
| F10 Reusable catalog maintenance | Done | `docs/catalog.md`, unit tests | A fifth product from another brand validates and renders from data alone. Missing assets, duplicate IDs, unverified scale and bad URLs are all caught. |

## Asset audit (prototype models)

Each figure is the packaged GLB from `npm run validate`. All four fit the 3 MB and
150k-triangle budgets.

| Product | GLB | Triangles | Notes |
| --- | --- | --- | --- |
| Refrigerator RF22N9781SR | 1.23 MB | 9,756 | Good silhouette, but the material is flat grey and there is no Family Hub screen. A `lightfridge` variant and an older `fridge.glb` are kept in `assets/source/` for review. |
| Microwave ME18H704SFS | 0.02 MB | 108 | A generic box model. It needs **wall / over-the-range** placement testing. |
| Range NE58R9431SS | 0.54 MB | 9,768 | A generic range with a white body, which **does not match** the stainless finish. Appearance is not validated against the SKU. |
| Dishwasher DW80K7050US | 0.01 MB | 36 | A generic box with no visible top controls. |

All four sources are Blender exports in arbitrary units, so **none can be scale-verified
until authoritative dimensions are recorded**. Rights and ownership are unknown, and there
is no license file. The 2020 prototype hotlinked product photos whose filenames
referenced other SKUs (microwave ME16H702SES, range NE58K9430SS). Those images were
removed, and the catalog now uses posters rendered from the models.

## Budgets (measured from the build, gzip)

- Product page without 3D: about 2.7 KB HTML, 2.6 KB CSS, 4.4 KB JS and a 10–18 KB poster.
  That's under 30 KB against the 500 KB budget.
- Viewer chunk, loaded only on demand: about 291 KB. The QR code chunk, desktop only, is about 7 KB.
- Core Web Vitals, first-interactive time and frame rate still need measuring on the
  midrange Android at 10 Mbps / 100 ms RTT, as the PRD specifies.

## Device matrix (to run before release)

- [ ] iPhone Safari: browse, 3D, Quick Look launch and return, Add to Home Screen
- [ ] AR-capable Android with Chrome: WebXR or Scene Viewer launch, placement, exit and return, install
- [ ] Samsung Internet on a representative Galaxy device: same checks
- [ ] Latest and previous Chrome, Edge, Firefox and Safari on desktop: browse, 3D, QR handoff
- [ ] A ten-minute product-switching session checking memory and thermals
- [ ] VoiceOver and TalkBack through the full shopping flow

## Decisions needed before a public release

**Devin**
- [ ] Historical portfolio refresh or current sales catalog? This sets `demoStatus` and the site notice.
- [ ] Brand presentation, and whether the Samsung name and the 2020 models may be shown.
  The old logo is archived in `assets/source/` and not deployed.

**Product owner**
- [ ] Approve the four SKUs, or replace them with current ones.
- [ ] Specification sources. Fill in `specifications.exterior`, `sourceUrl` and `verifiedAt`, then run `npm run assets`.
- [ ] Retailer destinations. Check each URL, then set `retailerStatus` and `retailerCheckedAt`.
- [ ] Whether prices appear at all.
- [ ] One verified everyday benefit per product.

**Developer**
- [ ] Confirm `<model-viewer>` (4.3.1, pinned) after the Stage 1 AR spike with `?ar-test`.
- [ ] Hosting. `_headers` and `_redirects` are ready for Netlify or Cloudflare Pages.
- [ ] Analytics provider and consent policy (`site.analytics`).
- [ ] Cache freshness rules (`priceFreshnessDays`, `cache.*`).
