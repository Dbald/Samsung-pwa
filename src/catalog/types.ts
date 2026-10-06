// Shared catalog contract. Every page, the service worker precache list and the
// release checks are derived from records of this shape (see docs/catalog.md).

export const CATEGORIES = {
  refrigerator: 'Refrigerator',
  microwave: 'Microwave',
  range: 'Range',
  dishwasher: 'Dishwasher',
} as const;

export type Category = keyof typeof CATEGORIES;

/** How the product is anchored in AR. `none` disables AR for the record. */
export type PlacementType = 'floor' | 'wall' | 'none';

export type DemoStatus = 'historical' | 'current';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type LinkStatus = 'verified' | 'unverified' | 'invalid';

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
  unit: 'in' | 'cm' | 'mm';
}

export interface Benefit {
  text: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface Feature {
  title: string;
  text: string;
}

/**
 * An additional finish of the same product. Only finishes confirmed for the SKU
 * family belong here: each needs its own SKU, retailer listing and source.
 */
export interface FinishVariant {
  /** Lowercase id used in the `?finish=` URL parameter. */
  id: string;
  finish: string;
  sku: string;
  /** Hex colour for the swatch chip. */
  swatch: string;
  /** Linear RGB multiplier applied to the model's finish materials in the 3D view. */
  tint: [number, number, number];
  retailerUrl: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface ProductRecord {
  id: string;
  slug: string;
  /** Old URLs (relative to the site base) that must keep working via redirects. */
  legacyPaths: string[];
  category: Category;
  brand: string;
  title: string;
  sku: string;
  description: string;
  finish: string;
  /** Hex colour for the base finish swatch. */
  finishSwatch: string;
  /** Additional verified finishes; empty when the product has one finish. */
  variants: FinishVariant[];
  benefit: Benefit | null;
  features: Feature[];
  specifications: {
    /** Exterior product dimensions. `null` until taken from an authoritative source. */
    exterior: Dimensions | null;
    sourceUrl: string | null;
    verifiedAt: string | null;
    /** Installation clearances, sourced separately from exterior dimensions. */
    clearances: { text: string; sourceUrl: string; verifiedAt: string } | null;
  };
  assets: {
    /** Runtime GLB, relative to /assets. */
    model: string;
    /** Optional approved Apple AR file, relative to /assets. */
    usdz: string | null;
    /** Original export used by `npm run assets`, relative to /assets. Never deployed. */
    source: string;
    poster: string;
    posterAlt: string;
    /** Approved extra images, relative to /assets. */
    images: { src: string; alt: string }[];
    /** Bump when the source asset or its preparation changes. */
    assetVersion: number;
    /** True only after the exported model was measured against `specifications.exterior`. */
    scaleVerified: boolean;
    placementType: PlacementType;
    /** Approved default framing, in model-viewer camera-orbit syntax. */
    cameraOrbit: string;
    /** Material names recoloured by finish variants; `null` recolours every material. */
    tintMaterials: string[] | null;
  };
  commerce: {
    retailerName: string;
    retailerUrl: string | null;
    retailerStatus: LinkStatus;
    retailerCheckedAt: string | null;
    price: number | null;
    currency: string | null;
    priceVerifiedAt: string | null;
    priceSource: string | null;
    demoStatus: DemoStatus;
  };
  governance: {
    assetOwner: string;
    license: string | null;
    attribution: string | null;
    approvalStatus: ApprovalStatus;
    /** Why a fallback (image instead of 3D, no AR, …) is in effect, if any. */
    fallbackReason: string | null;
  };
}

export interface SiteConfig {
  name: string;
  shortName: string;
  tagline: string;
  /** Shown site-wide when the catalog is a portfolio piece rather than a live offer. */
  demoNotice: string | null;
  lang: string;
  themeColor: string;
  backgroundColor: string;
  /** Hosts that `commerce.retailerUrl` may point at. */
  allowedRetailerHosts: string[];
  /** Days a `current` price stays displayable after `priceVerifiedAt`. */
  priceFreshnessDays: number;
  /** Max product pages / models kept by the service worker. */
  cache: { maxPages: number; maxModels: number; maxPosters: number };
  analytics: {
    /** POST endpoint for events; `null` keeps events in-page (window.showroomEvents). */
    endpoint: string | null;
    /** When true, nothing is sent until the page calls `showroom.grantConsent()`. */
    requireConsent: boolean;
  };
  budgets: { maxModelBytes: number; maxTriangles: number; scaleTolerance: number };
}

export interface Catalog {
  site: SiteConfig;
  products: ProductRecord[];
}
