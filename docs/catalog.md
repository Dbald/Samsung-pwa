# Catalog maintenance

Every product is one JSON file in `catalog/products/`. File names set display order
(`01-…`, `02-…`). You don't copy page templates or change viewer code to add a product.
The unit test "accepts a fifth product from another brand" proves this.

## Add a product

1. **Assets.** `assets.source` is either a parametric generator in
   `assets/source/generators/` (preferred) or an original glTF export in
   `assets/source/models/`. Run `npm run assets -- <id>` to package it as a GLB in
   `assets/models/`.
   - **Generators** build the model at the verified exterior size when one exists, and
     at the category's nominal size otherwise. The model is generated in this repository,
     so it has no third-party rights. Parts use named PBR materials (`stainless`,
     `black-glass`, `window`, `display` and others) so finishes can recolour only the
     right parts.
   - **Exports** are cleaned up: exporter placeholders are dropped, transforms baked and
     the pivot moved to the bottom centre. With verified dimensions, the export is scaled
     to meters from the spec height and the width and depth deviation is printed.
2. **Poster.** Run `npm run posters -- <id>` to render `assets/posters/<name>.webp` from the
   approved framing (`assets.cameraOrbit`).
3. **Record.** Copy an existing record and fill in each field. Leave a field `null` until
   it is verified. **Never enter guessed values.**
4. **Check.** Run `npm run validate`. A release must also pass `npm run validate:release`.

## Record fields

| Group | Fields | Notes |
| --- | --- | --- |
| Identity | `id`, `slug`, `category`, `brand`, `title`, `sku`, `description`, `finish`, `finishSwatch` | `id` and `slug` are unique, lowercase and dashed. The product URL is `/products/<slug>/`. |
| Finishes | `variants[]`: `id`, `finish`, `sku`, `swatch`, `tint`, `retailerUrl`, `sourceUrl`, `verifiedAt` | Only finishes confirmed for the SKU family. Each one shows as a swatch. |
| Legacy | `legacyPaths` | Old URLs that must redirect to this product. |
| Story | `benefit`, `features` | `benefit` is one verified everyday benefit with `sourceUrl` and `verifiedAt`, or `null`. |
| Specifications | `specifications.exterior` `{width,height,depth,unit}`, `sourceUrl`, `verifiedAt`, `clearances` | Exterior size and installation clearances are kept apart. `depth` is the **overall depth including handles**, because that is what the model's bounds and the 1% check measure. |
| Assets | `model` (.glb), `usdz`, `source`, `poster`, `posterAlt`, `images`, `assetVersion`, `scaleVerified`, `placementType` (`floor`, `wall` or `none`), `cameraOrbit`, `tintMaterials` | Paths are relative to `assets/`. `tintMaterials` names the materials a finish recolours (`null` recolours all). |
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

## Finish variants

Add a variant only when the retailer or manufacturer lists that finish for the same model
family. For example:

```json
"variants": [
  {
    "id": "black-stainless",
    "finish": "Black Stainless Steel",
    "sku": "RF22N9781SG/AA",
    "swatch": "#3a3c40",
    "tint": [0.22, 0.22, 0.24],
    "retailerUrl": "https://www.samsung.com/…",
    "sourceUrl": "https://www.samsung.com/…",
    "verifiedAt": "2026-10-06"
  }
]
```

On the page, the swatches update the model number, finish and retailer link, and recolour
`tintMaterials` in the 3D view. The choice is kept in `?finish=`, so copied links and the
desktop QR code open the same finish. Photos keep showing the base finish, and the page
says so.

## Another brand

Change `catalog/site.json` (name, notice, theme colour, allowed retailer hosts), replace
`assets/icons/icon.svg` and run `npm run icons`, then add records. No code changes are
needed. Confirm asset and brand permissions before publishing.
