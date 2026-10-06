import { readCatalogRaw } from '../../src/node/catalog-fs';
import type { ProductRecord, SiteConfig } from '../../src/catalog/types';

export const real = () => readCatalogRaw() as { site: SiteConfig; products: ProductRecord[] };
export const clone = <T>(v: T): T => structuredClone(v);

/** A fifth, different-brand product built purely from data. */
export function fixtureProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: 'fx-oven-01',
    slug: 'wall-oven-fx-oven-01',
    legacyPaths: [],
    category: 'range',
    brand: 'Fixture Brand',
    title: '30 in. Fixture Wall Oven',
    sku: 'FX-OVEN-01',
    description: 'A fixture record used to prove the catalog is data driven.',
    finish: 'Black Stainless',
    finishSwatch: '#3a3c40',
    variants: [
      {
        id: 'white',
        finish: 'White Glass',
        sku: 'FX-OVEN-01W',
        swatch: '#f2f2ef',
        tint: [0.95, 0.95, 0.93],
        retailerUrl: 'https://retailer.example/fx-oven-01w',
        sourceUrl: 'https://retailer.example/fx-oven-01w/specs',
        verifiedAt: '2026-09-01',
      },
    ],
    benefit: { text: 'Preheats while you prep.', sourceUrl: 'https://retailer.example/fx-oven-01', verifiedAt: '2026-09-01' },
    features: [{ title: 'Convection', text: 'Fan-assisted baking.' }],
    specifications: {
      exterior: { width: 29.75, height: 28.5, depth: 24.5, unit: 'in' },
      sourceUrl: 'https://retailer.example/fx-oven-01/specs',
      verifiedAt: '2026-09-01',
      clearances: null,
    },
    assets: {
      model: 'models/range.glb',
      usdz: null,
      source: 'source/models/range.gltf',
      poster: 'posters/range.webp',
      posterAlt: 'Fixture oven',
      images: [],
      assetVersion: 1,
      scaleVerified: false,
      placementType: 'floor',
      cameraOrbit: '0deg 75deg auto',
      tintMaterials: null,
    },
    commerce: {
      retailerName: 'Example Retailer',
      retailerUrl: 'https://retailer.example/fx-oven-01',
      retailerStatus: 'verified',
      retailerCheckedAt: '2026-09-01',
      price: 1999,
      currency: 'USD',
      priceVerifiedAt: '2026-09-20',
      priceSource: 'Example Retailer product page',
      demoStatus: 'current',
    },
    governance: { assetOwner: 'Fixture Brand', license: 'Licensed for demo', attribution: null, approvalStatus: 'approved', fallbackReason: null },
    ...overrides,
  };
}
