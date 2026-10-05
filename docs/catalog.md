# Catalog maintenance

Every product is one JSON file in `catalog/products/`. File names set display order
(`01-…`, `02-…`). You don't copy page templates or change viewer code to add a product.
The unit test "accepts a fifth product from another brand" proves this.

## Add a product

1. **Assets.** Put the original export in `assets/source/models/`. Add an entry for it in
   a new record, then run `npm run assets -- <id>` to package it as a GLB in
   `assets/models/`. The script drops exporter placeholders, bakes transforms and puts the
   pivot at the bottom centre. When the record has verified exterior dimensions, it scales
   the model to meters from the spec height and prints the width and depth deviation.
2. **Poster.** Run `npm run posters -- <id>` to render `assets/posters/<name>.webp` from the
   approved framing (`assets.cameraOrbit`).
3. **Record.** Copy an existing record and fill in each field. Leave a field `null` until
   it is verified. **Never enter guessed values.**
4. **Check.** Run `npm run validate`. A release must also pass `npm run validate:release`.

## Record fields

| Group | Fields | Notes |
| --- | --- | --- |
| Identity | `id`, `slug`, `category`, `brand`, `title`, `sku`, `description`, `finish` | `id` and `slug` are unique, lowercase and dashed. The product URL is `/products/<slug>/`. |
| Legacy | `legacyPaths` | Old URLs that must redirect to this product. |
| Story | `benefit`, `features` | `benefit` is one verified everyday benefit with `sourceUrl` and `verifiedAt`, or `null`. |
| Specifications | `specifications.exterior` `{width,height,depth,unit}`, `sourceUrl`, `verifiedAt`, `clearances` | Exterior size and installation clearances are kept apart. |
| Assets | `model` (.glb), `usdz`, `source`, `poster`, `posterAlt`, `images`, `assetVersion`, `scaleVerified`, `placementType` (`floor`, `wall` or `none`), `cameraOrbit` | Paths are relative to `assets/`. |
| Commerce | `retailerName`, `retailerUrl`, `retailerStatus` (`verified`, `unverified` or `invalid`), `retailerCheckedAt`, `price`, `currency`, `priceVerifiedAt`, `priceSource`, `demoStatus` (`historical` or `current`) | |
| Governance | `assetOwner`, `license`, `attribution`, `approvalStatus` (`pending`, `approved` or `rejected`), `fallbackReason` | |

## What the validator enforces

Errors fail every build:
- malformed records, unknown categories, and duplicate ids, slugs or legacy paths
- missing model, poster, source or image files, and runtime models that aren't `.glb`
- retailer URLs that aren't https, or whose host is not in `site.allowedRetailerHosts`
- `scaleVerified: true` without verified dimensions, or with a measured model more than
  `site.budgets.scaleTolerance` (1%) away from the spec on any axis
- a current price without a verification date

Warnings in preview builds become errors under `validate:release`:
- an unverified benefit, dimensions, scale or retailer link
- content still pending owner approval

These are warnings in every mode:
- models over 3 MB or 150,000 triangles
- current prices past `priceFreshnessDays`
- retailer actions disabled because the link is `invalid`

## Display rules

- **Prices.** Historical prices are always labelled "Historical, not a current offer".
  Current prices show their check date and are hidden after `priceFreshnessDays`, both at
  build time and in the browser for cached pages.
- **Retailer.** `invalid` (or `retailerUrl: null`) disables the action and shows an
  explanation. `unverified` keeps the link with a caution note.
- **AR.** AR is offered only when `scaleVerified` is true and `placementType` is not
  `none`. The page says why when it isn't.
- **Dimensions.** Missing dimensions show "not yet verified". They are never estimated.

## Another brand

Change `catalog/site.json` (name, notice, theme colour, allowed retailer hosts), replace
`assets/icons/icon.svg` and run `npm run icons`, then add records. No code changes are
needed. Confirm asset and brand permissions before publishing.
