import type { MaterialName, ModelBuilder, Vec3 } from './lib';

/** Bar handle with two standoffs, running along `axis` from `start` for `length`. */
export function barHandle(b: ModelBuilder, start: Vec3, axis: 'x' | 'y', length: number, standoff = 0.035, radius = 0.011, material: MaterialName = 'stainless') {
  const [x, y, z] = start;
  b.cylinder(material, [x, y, z + standoff], axis, radius, length, 20);
  const inset = Math.min(0.04, length * 0.12);
  for (const t of [inset, length - inset]) {
    const p: Vec3 = axis === 'x' ? [x + t, y, z] : [x, y + t, z];
    b.cylinder(material, p, 'z', radius * 0.75, standoff, 14);
  }
}
