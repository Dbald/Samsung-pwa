// Slide-in electric range: glass cooktop with no backguard, front controls,
// window oven door and storage drawer.
import { ModelBuilder, type Generator } from './lib';
import { barHandle } from './parts';

/** Nominal category size (30 × 36 × 28 in). */
export const nominal = { width: 0.762, height: 0.914, depth: 0.71 };

export const build: Generator = ({ width: W, height: H, depth: D }) => {
  const b = new ModelBuilder();
  const x0 = -W / 2;
  const x1 = W / 2;
  // Handles and trim fit inside the overall depth, so the model's bounds equal the spec.
  const front = D / 2 - 0.052;
  const glass = 0.012;
  const controls = 0.1;
  const toe = 0.03;

  // Slide-in sides are hidden by cabinets in a real kitchen.
  b.box('dark-trim', [x0 + 0.012, toe, -D / 2], [x1 - 0.01, H - glass, front - 0.05], 0.004);
  b.box('black-plastic', [x0 + 0.02, 0, -D / 2 + 0.02], [x1 - 0.02, toe, front - 0.06], 0.003);
  // The cooktop is the full width; the body below is slightly narrower.
  b.box('black-glass', [x0, H - glass, -D / 2 + 0.01], [x1, H, front + 0.004], 0.004);
  const top = H + 0.0004;
  const z = (f: number) => -D / 2 + 0.01 + (front - 0.01 - (-D / 2 + 0.01)) * f;
  for (const [x, f, r] of [
    [x0 + 0.2, 0.68, 0.11],
    [x0 + 0.2, 0.26, 0.085],
    [x1 - 0.2, 0.68, 0.085],
    [x1 - 0.2, 0.26, 0.11],
    [0, 0.47, 0.06],
  ] as const) {
    b.ring('enamel-grey', [x, top, z(f)], r - 0.004, r);
    b.ring('enamel-grey', [x, top, z(f)], r * 0.55 - 0.003, r * 0.55);
  }
  // Front control panel with knobs and a centre display.
  b.box('stainless-brushed', [x0, H - glass - controls, front - 0.05], [x1, H - glass, front], 0.006);
  for (const cx of [x0 + 0.08, x0 + 0.17, x1 - 0.17, x1 - 0.08]) {
    b.cylinder('stainless', [cx, H - glass - controls / 2, front], 'z', 0.024, 0.03, 28);
    b.box('dark-trim', [cx - 0.003, H - glass - controls / 2 + 0.005, front + 0.03], [cx + 0.003, H - glass - controls / 2 + 0.02, front + 0.032], 0.001, 1);
  }
  b.box('display', [-0.08, H - glass - controls / 2 - 0.015, front], [0.08, H - glass - controls / 2 + 0.015, front + 0.0015], 0.002, 1);
  // Oven door with window and bar handle.
  const doorTop = H - glass - controls - 0.006;
  const doorBottom = 0.19;
  b.box('stainless', [x0 + 0.003, doorBottom, front - 0.05], [x1 - 0.003, doorTop, front], 0.008);
  b.box('window', [x0 + 0.1, doorBottom + 0.09, front - 0.002], [x1 - 0.1, doorTop - 0.12, front + 0.001], 0.012);
  barHandle(b, [x0 + 0.06, doorTop - 0.05, front], 'x', W - 0.12, 0.04, 0.012);
  // Storage drawer.
  b.box('stainless', [x0 + 0.003, toe + 0.004, front - 0.05], [x1 - 0.003, doorBottom - 0.006, front], 0.008);
  b.box('black-plastic', [-0.12, doorBottom - 0.04, front - 0.004], [0.12, doorBottom - 0.022, front + 0.002], 0.006);
  return b.toDocument('range');
};
