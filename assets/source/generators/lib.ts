// Small mesh kit for parametric appliance models. Units are meters; +Y is up and
// the appliance front faces +Z (the default camera side). Parts are merged into
// one primitive per material, so a model stays at a handful of draw calls.
import { Document, type Material } from '@gltf-transform/core';

export type Vec3 = [number, number, number];

export interface MaterialSpec {
  color: Vec3;
  metallic: number;
  roughness: number;
  emissive?: Vec3;
}

/** Shared material library. Finishes usually recolour `stainless` and `stainless-brushed`. */
export const MATERIALS = {
  stainless: { color: [0.74, 0.75, 0.77], metallic: 0.85, roughness: 0.32 },
  'stainless-brushed': { color: [0.62, 0.63, 0.65], metallic: 0.8, roughness: 0.45 },
  'black-glass': { color: [0.015, 0.016, 0.02], metallic: 0, roughness: 0.06 },
  'black-plastic': { color: [0.03, 0.03, 0.035], metallic: 0, roughness: 0.55 },
  'dark-trim': { color: [0.12, 0.12, 0.13], metallic: 0.3, roughness: 0.5 },
  'enamel-grey': { color: [0.18, 0.18, 0.19], metallic: 0, roughness: 0.4 },
  window: { color: [0.02, 0.025, 0.03], metallic: 0.1, roughness: 0.04 },
  display: { color: [0.02, 0.06, 0.08], metallic: 0, roughness: 0.2, emissive: [0.15, 0.55, 0.75] },
  screen: { color: [0.015, 0.02, 0.03], metallic: 0, roughness: 0.05, emissive: [0.03, 0.05, 0.08] },
} satisfies Record<string, MaterialSpec>;

export type MaterialName = keyof typeof MATERIALS;

interface Geometry {
  positions: number[];
  normals: number[];
  indices: number[];
}

export class ModelBuilder {
  private parts = new Map<MaterialName, Geometry>();

  private geo(material: MaterialName): Geometry {
    let g = this.parts.get(material);
    if (!g) this.parts.set(material, (g = { positions: [], normals: [], indices: [] }));
    return g;
  }

  /**
   * Axis-aligned box with rounded edges of radius `r`. Grid lines are placed only at
   * the start and end of each rounding band, so flat faces stay cheap.
   */
  box(material: MaterialName, min: Vec3, max: Vec3, r = 0.004, seg = 3): this {
    const g = this.geo(material);
    const size = [0, 1, 2].map((k) => max[k] - min[k]);
    const rad = Math.max(0, Math.min(r, ...size.map((s) => s / 2 - 1e-5)));
    const lo = min.map((v) => v + rad);
    const hi = max.map((v) => v - rad);
    const coords = (k: number) => {
      const out: number[] = [];
      for (let i = 0; i <= seg; i++) out.push(min[k] + (rad * i) / seg);
      for (let i = 0; i <= seg; i++) out.push(max[k] - rad + (rad * i) / seg);
      return out;
    };
    const axes = [coords(0), coords(1), coords(2)];
    // Each face: fixed axis `a` at side `s` (0 = min, 1 = max), spanning axes u, v.
    const faces: [number, 0 | 1, number, number][] = [
      [0, 1, 1, 2], [0, 0, 2, 1], [1, 1, 2, 0], [1, 0, 0, 2], [2, 1, 0, 1], [2, 0, 1, 0],
    ];
    for (const [a, s, u, v] of faces) {
      const base = g.positions.length / 3;
      const us = axes[u];
      const vs = axes[v];
      for (const pv of vs)
        for (const pu of us) {
          const p: Vec3 = [0, 0, 0];
          p[a] = s ? max[a] : min[a];
          p[u] = pu;
          p[v] = pv;
          const c = [0, 1, 2].map((k) => Math.min(hi[k], Math.max(lo[k], p[k])));
          let n = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
          const len = Math.hypot(n[0], n[1], n[2]);
          if (len < 1e-9) {
            n = [0, 0, 0];
            n[a] = s ? 1 : -1;
          } else n = n.map((x) => x / len);
          const q = rad > 0 && len > 1e-9 ? c.map((x, k) => x + n[k] * rad) : p;
          g.positions.push(q[0], q[1], q[2]);
          g.normals.push(n[0], n[1], n[2]);
        }
      const w = us.length;
      for (let j = 0; j < vs.length - 1; j++)
        for (let i = 0; i < w - 1; i++) {
          const i0 = base + j * w + i;
          g.indices.push(i0, i0 + 1, i0 + w + 1, i0, i0 + w + 1, i0 + w);
        }
    }
    return this;
  }

  /** Capped cylinder from `start` along a principal `axis` for `length` meters. */
  cylinder(material: MaterialName, start: Vec3, axis: 'x' | 'y' | 'z', radius: number, length: number, segments = 24): this {
    const g = this.geo(material);
    const ax = { x: 0, y: 1, z: 2 }[axis];
    // (u, v) chosen so u × v = axis, keeping the winding outward-facing.
    const [u, v] = { x: [1, 2], y: [2, 0], z: [0, 1] }[axis];
    const point = (angle: number, t: number): Vec3 => {
      const p: Vec3 = [...start];
      p[ax] += t * length;
      p[u] += Math.cos(angle) * radius;
      p[v] += Math.sin(angle) * radius;
      return p;
    };
    const side = g.positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const n: Vec3 = [0, 0, 0];
      n[u] = Math.cos(a);
      n[v] = Math.sin(a);
      for (const t of [0, 1]) {
        g.positions.push(...point(a, t));
        g.normals.push(...n);
      }
    }
    for (let i = 0; i < segments; i++) {
      const k = side + i * 2;
      g.indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    for (const t of [0, 1]) {
      const centre = g.positions.length / 3;
      const n: Vec3 = [0, 0, 0];
      n[ax] = t ? 1 : -1;
      const c: Vec3 = [...start];
      c[ax] += t * length;
      g.positions.push(...c);
      g.normals.push(...n);
      for (let i = 0; i <= segments; i++) {
        g.positions.push(...point((i / segments) * Math.PI * 2, t));
        g.normals.push(...n);
      }
      for (let i = 0; i < segments; i++)
        if (t) g.indices.push(centre, centre + 1 + i, centre + 2 + i);
        else g.indices.push(centre, centre + 2 + i, centre + 1 + i);
    }
    return this;
  }

  /** Flat ring in the XZ plane, facing up: burner outlines on a cooktop. */
  ring(material: MaterialName, centre: Vec3, inner: number, outer: number, segments = 48): this {
    const g = this.geo(material);
    const base = g.positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      for (const r of [inner, outer]) {
        g.positions.push(centre[0] + Math.cos(a) * r, centre[1], centre[2] + Math.sin(a) * r);
        g.normals.push(0, 1, 0);
      }
    }
    for (let i = 0; i < segments; i++) {
      const k = base + i * 2;
      g.indices.push(k, k + 3, k + 1, k, k + 2, k + 3);
    }
    return this;
  }

  /** Writes the parts into a glTF document with one node, mesh and PBR material per part. */
  toDocument(name: string): Document {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const scene = doc.createScene(name);
    const mesh = doc.createMesh(name);
    for (const [matName, g] of this.parts) {
      const spec: MaterialSpec = MATERIALS[matName];
      const material: Material = doc
        .createMaterial(matName)
        .setBaseColorFactor([...spec.color, 1])
        .setMetallicFactor(spec.metallic)
        .setRoughnessFactor(spec.roughness);
      if (spec.emissive) material.setEmissiveFactor(spec.emissive);
      const prim = doc
        .createPrimitive()
        .setMaterial(material)
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.positions)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.normals)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.indices)).setBuffer(buffer));
      mesh.addPrimitive(prim);
    }
    scene.addChild(doc.createNode(name).setMesh(mesh));
    doc.getRoot().setDefaultScene(scene);
    return doc;
  }
}

/** Overall size in meters: width (x), height (y), depth (z). */
export interface Size {
  width: number;
  height: number;
  depth: number;
}

export type Generator = (size: Size) => Document;
