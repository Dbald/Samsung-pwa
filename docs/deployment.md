# Deployment

The site is fully static. `npm run build` writes everything to `dist/`:

| File | Purpose |
| --- | --- |
| `index.html`, `products/<slug>/index.html` | Catalog and product pages |
| `offline.html`, `404.html` | Offline fallback and not-found pages |
| `pages/*.html`, `AR.html` | Redirect stubs for the 2020 URLs, for hosts without redirect rules |
| `_redirects` | 301 rules for those URLs (Netlify and Cloudflare Pages format) |
| `_headers` | CSP, security headers, caching and MIME types (Netlify and Cloudflare Pages format) |
| `manifest.webmanifest`, `sw.js` | Install metadata and service worker (served `no-cache`) |
| `assets/…` | Content-hashed JS, CSS, models, posters and icons (served `immutable`) |
| `catalog.json` | Product ids and URLs for monitoring scripts |

## Host requirements

- HTTPS. It's required for service workers, the clipboard and AR.
- Serve `.glb` as `model/gltf-binary` and `.webmanifest` as `application/manifest+json`.
- Apply the headers in `dist/_headers`. The Content Security Policy permits only
  same-origin scripts. Inline styles are allowed because `<model-viewer>` uses them, and
  `blob:` is allowed for generated Quick Look files. If you set an analytics endpoint on
  another origin, the build adds that origin to `connect-src`.
- Serve `404.html` for unknown paths.

Netlify and Cloudflare Pages read `_headers` and `_redirects` directly. Other hosts
(S3/CloudFront, Vercel, nginx) need the same rules ported to their config. The redirect
stubs keep old links working either way.

To serve from a sub-path, such as GitHub Pages, build with `BASE_PATH=/repo-name/ npm run build`.

The old `index.php` redirect is replaced by these host rules.

## Preview and release

1. CI (`.github/workflows/ci.yml`) runs validation, typecheck, unit tests, the build and
   browser tests on every push, then uploads `dist/` as the `site-preview` artifact.
   Connect the chosen host's branch previews for a live URL.
2. Before a public release, run `npm run validate:release`. It fails until data, scale,
   retailer links and approvals are verified.
3. Test on the device matrix in [release-status.md](release-status.md). Desktop automation
   cannot certify native AR handoffs.
4. Deploy, and keep the previous deploy for rollback.

## Rollback

Re-publish the previous deploy, using the host's rollback or the previous CI artifact.
Asset URLs are content-hashed and the service worker cache name is derived from the
precache list. Rolling back produces a new worker version, and clients pick it up through
the normal update prompt. They never mix old and new files.

## After launch

During the first week, check model failures (`viewer_error`) and broken handoffs daily.
Recheck retailer destinations and product data at the agreed maintenance interval, and
update `retailerCheckedAt`, `verifiedAt` and `priceVerifiedAt` when you do.
