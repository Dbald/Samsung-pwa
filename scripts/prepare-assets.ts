// Packages each record's source glTF export as a runtime GLB in assets/models/.
//   - drops empty camera/light placeholder nodes left by the Blender exporter
//   - bakes transforms, dedups and prunes unused data
//   - moves the pivot to the bottom-centre of the product (floor contact point)
//   - when verified exterior dimensions exist, scales to meters from the spec height
//     and reports width/depth deviation (validate-catalog enforces the tolerance)
// Source exports stay in assets/source/ and are never deployed.
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { dedup, flatten, getBounds, prune, transformMesh } from '@gltf-transform/functions';
import type { ProductRecord } from '../src/catalog/types';
import { toMeters } from '../src/catalog/validate';
import { ASSETS_DIR, readCatalogRaw } from '../src/node/catalog-fs';

const io = new NodeIO();
const products = readCatalogRaw().products as ProductRecord[];
const only = process.argv.slice(2);

for (const p of products) {
  if (only.length && !only.includes(p.id)) continue;
  const doc = await io.read(join(ASSETS_DIR, p.assets.source));
  const root = doc.getRoot();

  for (const node of root.listNodes()) if (!node.getMesh() && !node.getCamera() && node.listChildren().length === 0) node.dispose();
  for (const cam of root.listCameras()) cam.dispose();
  await doc.transform(flatten());

  // Bake each node's world transform into its mesh so the asset has a clean hierarchy.
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    transformMesh(mesh, node.getWorldMatrix());
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }

  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  let { min, max } = getBounds(scene);
  const ext = p.specifications.exterior;
  const scale = ext ? toMeters(ext.height, ext.unit) / (max[1] - min[1]) : 1;
  const offset = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
  const m = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, offset[0] * scale, offset[1] * scale, offset[2] * scale, 1] as const;
  for (const mesh of root.listMeshes()) transformMesh(mesh, m as unknown as Parameters<typeof transformMesh>[1]);

  await doc.transform(dedup(), prune());
  const out = join(ASSETS_DIR, p.assets.model);
  mkdirSync(dirname(out), { recursive: true });
  await io.write(out, doc);

  ({ min, max } = getBounds(scene));
  const size = [0, 1, 2].map((k) => max[k] - min[k]);
  const line = [`${p.id}: ${p.assets.model}`, `${(statSync(out).size / 1e6).toFixed(2)} MB`, `size ${size.map((n) => n.toFixed(3)).join(' × ')}${ext ? ' m' : ' (unscaled units)'}`];
  if (ext) {
    const want = [ext.width, ext.height, ext.depth].map((n) => toMeters(n, ext.unit));
    line.push(`deviation ${size.map((n, k) => `${((Math.abs(n - want[k]) / want[k]) * 100).toFixed(1)}%`).join(' / ')}`);
  }
  console.log(line.join('  '));
}
