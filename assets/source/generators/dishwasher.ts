// Built-in dishwasher with top (hidden) controls and a pocket handle.
import { ModelBuilder, type Generator } from './lib';

/** Nominal category size used until verified dimensions exist (24 × 34 × 24 in). */
export const nominal = { width: 0.598, height: 0.864, depth: 0.61 };

export const build: Generator = ({ width: W, height: H, depth: D }) => {
  const b = new ModelBuilder();
  const x0 = -W / 2;
  const x1 = W / 2;
  // Handles and trim fit inside the overall depth, so the model's bounds equal the spec.
  const front = D / 2 - 0.002;
  const door = 0.04;
  const toe = 0.1;

  b.box('stainless-brushed', [x0 + 0.004, toe, -D / 2], [x1 - 0.004, H - 0.002, front - door], 0.006);
  b.box('black-plastic', [x0 + 0.01, 0, -D / 2 + 0.02], [x1 - 0.01, toe, front - 0.06], 0.004);
  // Door with the control strip along its top edge.
  b.box('stainless', [x0, toe + 0.004, front - door], [x1, H - 0.018, front], 0.008);
  b.box('black-glass', [x0 + 0.002, H - 0.02, front - door], [x1 - 0.002, H - 0.003, front - 0.002], 0.004);
  for (let i = 0; i < 6; i++) {
    const cx = x0 + 0.14 + i * 0.06;
    b.box('dark-trim', [cx - 0.012, H - 0.0025, front - 0.03], [cx + 0.012, H - 0.0005, front - 0.014], 0.001, 1);
  }
  b.box('display', [x1 - 0.12, H - 0.0025, front - 0.03], [x1 - 0.05, H - 0.0008, front - 0.014], 0.001, 1);
  // Pocket handle recess and status light.
  b.box('black-plastic', [-0.17, H - 0.075, front - 0.004], [0.17, H - 0.04, front + 0.002], 0.008);
  b.box('display', [x1 - 0.06, H - 0.07, front], [x1 - 0.048, H - 0.064, front + 0.0015], 0.001, 1);
  return b.toDocument('dishwasher');
};
