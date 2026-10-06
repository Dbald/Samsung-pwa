// Counter-depth 4-door Flex refrigerator: French doors with a Family Hub screen
// and dispenser, two lower doors, bar handles and a toe grille.
import { ModelBuilder, type Generator } from './lib';
import { barHandle } from './parts';

/** Nominal category size (36 × 70 × 28.75 in). */
export const nominal = { width: 0.912, height: 1.778, depth: 0.73 };

export const build: Generator = ({ width: W, height: H, depth: D }) => {
  const b = new ModelBuilder();
  const x0 = -W / 2;
  const x1 = W / 2;
  // Handles and trim fit inside the overall depth, so the model's bounds equal the spec.
  const front = D / 2 - 0.058;
  const door = 0.065;
  const toe = 0.075;
  const split = toe + (H - toe) * 0.47;
  const gap = 0.003;

  b.box('stainless-brushed', [x0 + 0.004, toe, -D / 2], [x1 - 0.004, H - 0.004, front - door], 0.008);
  b.box('black-plastic', [x0 + 0.02, 0, -D / 2 + 0.03], [x1 - 0.02, toe, front - 0.04], 0.004);
  for (let x = x0 + 0.06; x < x1 - 0.06; x += 0.03) b.box('dark-trim', [x, 0.02, front - 0.041], [x + 0.014, toe - 0.02, front - 0.038], 0.002, 1);

  // Upper French doors.
  b.box('stainless', [x0, split + gap, front - door], [-gap, H, front], 0.012);
  b.box('stainless', [gap, split + gap, front - door], [x1, H, front], 0.012);
  // Lower Flex doors.
  b.box('stainless', [x0, toe + gap, front - door], [-gap, split - gap, front], 0.012);
  b.box('stainless', [gap, toe + gap, front - door], [x1, split - gap, front], 0.012);

  // Family Hub screen on the right door, dispenser on the left.
  const screenW = Math.min(0.27, W / 2 - 0.12);
  const screenH = screenW * 1.75;
  const sx = W / 4 + 0.02;
  const sy = split + (H - split) * 0.55;
  b.box('screen', [sx - screenW / 2, sy - screenH / 2, front - 0.002], [sx + screenW / 2, sy + screenH / 2, front + 0.002], 0.006);
  const dx = -W / 4 - 0.02;
  const dy = split + (H - split) * 0.42;
  b.box('black-plastic', [dx - 0.1, dy - 0.17, front - 0.03], [dx + 0.1, dy + 0.17, front + 0.001], 0.02);
  b.box('display', [dx - 0.06, dy + 0.12, front + 0.001], [dx + 0.06, dy + 0.15, front + 0.0025], 0.002, 1);
  b.box('dark-trim', [dx - 0.08, dy - 0.15, front - 0.025], [dx + 0.08, dy - 0.13, front - 0.01], 0.004);

  // Handles: vertical on the French doors, horizontal on the Flex doors.
  const hLen = (H - split) * 0.62;
  const hy = split + (H - split - hLen) / 2;
  barHandle(b, [-0.035, hy, front], 'y', hLen, 0.045, 0.013);
  barHandle(b, [0.035, hy, front], 'y', hLen, 0.045, 0.013);
  const lw = W / 2 - 0.16;
  barHandle(b, [x0 + 0.08, split - 0.06, front], 'x', lw, 0.04, 0.012);
  barHandle(b, [0.08, split - 0.06, front], 'x', lw, 0.04, 0.012);
  return b.toDocument('refrigerator');
};
