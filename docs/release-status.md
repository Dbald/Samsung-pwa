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
| P1 Shopping tools (issue #5) | Done | `finishes.ts`, `saved.ts`, `compare.ts` | Finish swatches recolour the 3D model and update the model number, retailer link and shared link. They appear only for verified variants, and the real catalog has none yet. Saving and comparing work offline and without accounts (tested against the fixture catalog). |
| F10 Reusable catalog maintenance | Done | `docs/catalog.md`, unit tests | A fifth product from another brand validates and renders from data alone. Missing assets, duplicate IDs, unverified scale and bad URLs are all caught. |

## Models

All four products now use models generated in this repository
(`assets/source/generators/`), replacing the 2020 Blender exports (issue #3). The
generated models have no third-party rights and use named PBR materials. Once verified
dimensions are entered, they are rebuilt at those exact dimensions. Until then they use
nominal category sizes, which are never shown to shoppers.

| Product | GLB | Triangles | Product-type features modelled | 2020 export it replaces |
| --- | --- | --- | --- | --- |
| Refrigerator RF22N9781SR | 0.27 MB | 9,084 | 4-door Flex layout, Family Hub screen, dispenser, bar handles, toe grille | 1.23 MB, 9,756 tris, flat grey, no screen |
| Microwave ME18H704SFS | 0.23 MB | 8,352 | Window door, bar handle, keypad and display, top vent, cooktop lights | 0.02 MB, 108 tris, generic box |
| Range NE58R9431SS | 0.19 MB | 6,844 | Slide-in glass cooktop with elements, front knobs and display, window door, drawer | 0.54 MB, 9,768 tris, white body |
| Dishwasher DW80K7050US | 0.09 MB | 3,804 | Top control strip, pocket handle, status light, toe kick | 0.01 MB, 36 tris, plain box |

These are faithful *category* models, not photogrammetry of the exact SKUs. For example,
button layouts are representative. Before a current sales catalog launches, compare each
one against approved product imagery, or replace it with a manufacturer asset. The 2020
exports stay in `assets/source/models/` for reference. The microwave still needs **wall /
over-the-range** placement testing on a device.

The 2020 prototype hotlinked product photos whose filenames referenced other SKUs
(microwave ME16H702SES, range NE58K9430SS). Those images were removed, and the catalog now
uses posters rendered from the models.

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
- [ ] Which additional finishes each SKU is offered in (for example black stainless), with sources. These turn on the swatches.

**Developer**
- [ ] Confirm `<model-viewer>` (4.3.1, pinned) after the Stage 1 AR spike with `?ar-test`.
- [ ] Hosting. `_headers` and `_redirects` are ready for Netlify or Cloudflare Pages.
- [ ] Analytics provider and consent policy (`site.analytics`).
- [ ] Cache freshness rules (`priceFreshnessDays`, `cache.*`).
