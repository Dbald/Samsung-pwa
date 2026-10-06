import { getBounds } from '@gltf-transform/functions';
import { describe, expect, it } from 'vitest';
import type { Generator, Size } from '../../assets/source/generators/lib';
import * as dishwasher from '../../assets/source/generators/dishwasher';
import * as microwave from '../../assets/source/generators/microwave';
import * as range from '../../assets/source/generators/range';
import * as refrigerator from '../../assets/source/generators/refrigerator';

const generators: Record<string, { build: Generator; nominal: Size }> = { dishwasher, microwave, range, refrigerator };

function measure(build: Generator, size: Size) {
  const doc = build(size);
  const { min, max } = getBounds(doc.getRoot().getDefaultScene()!);
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) triangles += p.getIndices()!.getCount() / 3;
  return { size: [0, 1, 2].map((k) => max[k] - min[k]), min, triangles, materials: doc.getRoot().listMaterials().map((m) => m.getName()) };
}

describe.each(Object.entries(generators))('%s generator', (_name, gen) => {
  it('builds exactly to a requested size, so verified specs give an exact AR scale', () => {
    // An arbitrary, non-nominal size stands in for verified dimensions.
    const want = { width: gen.nominal.width * 1.07, height: gen.nominal.height * 0.96, depth: gen.nominal.depth * 1.03 };
    const { size, min } = measure(gen.build, want);
    [want.width, want.height, want.depth].forEach((w, k) => expect(Math.abs(size[k] - w) / w).toBeLessThan(0.01));
    expect(min[1]).toBeCloseTo(0, 2); // stands on the floor
  });

  it('stays inside the model budget and exposes a stainless finish material', () => {
    const { triangles, materials } = measure(gen.build, gen.nominal);
    expect(triangles).toBeLessThan(150_000);
    expect(materials).toContain('stainless');
  });
});
