// Node-only helpers: read the catalog from disk and measure runtime models.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import type { Catalog } from '../catalog/types';
import { validateCatalog, type ModelStats, type ValidationResult } from '../catalog/validate';

export const ROOT = resolve(import.meta.dirname, '../..');
export const ASSETS_DIR = join(ROOT, 'assets');
/** CATALOG_DIR lets tests build the site from a fixture catalog. */
export const CATALOG_DIR = resolve(ROOT, process.env.CATALOG_DIR ?? 'catalog');

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path.slice(ROOT.length + 1)}: ${(e as Error).message}`);
  }
}

/** Loads catalog/site.json and catalog/products/*.json (file name order = display order). */
export function readCatalogRaw(dir = CATALOG_DIR): { site: unknown; products: unknown[] } {
  const productsDir = join(dir, 'products');
  const files = readdirSync(productsDir).filter((f) => f.endsWith('.json')).sort();
  return { site: readJson(join(dir, 'site.json')), products: files.map((f) => readJson(join(productsDir, f))) };
}

export function assetExists(path: string, assetsDir = ASSETS_DIR): boolean {
  const full = resolve(assetsDir, path);
  return full.startsWith(assetsDir) && existsSync(full) && statSync(full).isFile();
}

export async function measureModel(path: string): Promise<ModelStats> {
  const doc = await new NodeIO().read(path);
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const count = prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')?.getCount() ?? 0;
      if (prim.getMode() === 4) triangles += count / 3;
    }
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  return { bytes: statSync(path).size, triangles, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

export interface LoadedCatalog extends ValidationResult {
  catalog: Catalog;
  stats: Map<string, ModelStats>;
}

/** Reads, measures and validates. Callers decide whether warnings matter. */
export async function loadCatalog(opts: { release?: boolean } = {}): Promise<LoadedCatalog> {
  const raw = readCatalogRaw();
  const stats = new Map<string, ModelStats>();
  for (const p of raw.products as { assets?: { model?: unknown } }[]) {
    const model = p?.assets?.model;
    if (typeof model === 'string' && assetExists(model) && !stats.has(model)) stats.set(model, await measureModel(join(ASSETS_DIR, model)));
  }
  const result = validateCatalog(raw, { assetExists: (p) => assetExists(p), modelStats: stats, release: opts.release });
  return { ...result, catalog: raw as unknown as Catalog, stats };
}

export function formatReport({ errors, warnings }: ValidationResult): string {
  const lines: string[] = [];
  if (errors.length) lines.push(`✖ ${errors.length} catalog error(s):`, ...errors.map((e) => `  - ${e}`));
  if (warnings.length) lines.push(`⚠ ${warnings.length} warning(s):`, ...warnings.map((w) => `  - ${w}`));
  return lines.join('\n');
}
