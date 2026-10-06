// Over-the-range microwave: window door, bar handle, right-hand keypad and top vent.
import { ModelBuilder, type Generator } from './lib';
import { barHandle } from './parts';

/** Nominal category size (29.9 × 16.4 × 15.9 in). */
export const nominal = { width: 0.76, height: 0.417, depth: 0.404 };

export const build: Generator = ({ width: W, height: H, depth: D }) => {
  const b = new ModelBuilder();
  const x0 = -W / 2;
  const x1 = W / 2;
  // Handles and trim fit inside the overall depth, so the model's bounds equal the spec.
  const front = D / 2 - 0.039;
  const panel = 0.19;
  const vent = 0.045;

  b.box('stainless-brushed', [x0, 0.001, -D / 2], [x1, H, front - 0.02], 0.006);
  // Top vent grille.
  b.box('black-plastic', [x0 + 0.004, H - vent, front - 0.02], [x1 - 0.004, H - 0.004, front + 0.002], 0.003);
  for (let x = x0 + 0.04; x < x1 - 0.04; x += 0.022) b.box('dark-trim', [x, H - vent + 0.01, front + 0.001], [x + 0.01, H - 0.014, front + 0.004], 0.002, 1);
  // Door and window.
  const doorX1 = x1 - panel;
  b.box('stainless', [x0 + 0.002, 0.004, front - 0.025], [doorX1 - 0.002, H - vent - 0.004, front], 0.008);
  b.box('window', [x0 + 0.06, 0.06, front - 0.002], [doorX1 - 0.07, H - vent - 0.06, front + 0.001], 0.01);
  barHandle(b, [doorX1 - 0.035, 0.05, front], 'y', H - vent - 0.1, 0.03, 0.009);
  // Control panel: display and keypad.
  b.box('black-glass', [doorX1, 0.004, front - 0.025], [x1 - 0.002, H - vent - 0.004, front], 0.006);
  b.box('display', [doorX1 + 0.03, H - vent - 0.07, front], [x1 - 0.03, H - vent - 0.035, front + 0.0015], 0.002, 1);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 3; c++) {
      const x = doorX1 + 0.035 + c * 0.045;
      const y = H - vent - 0.11 - r * 0.045;
      b.box('dark-trim', [x, y, front], [x + 0.032, y + 0.026, front + 0.002], 0.003, 1);
    }
  // Cooktop lights on the underside.
  for (const x of [x0 + 0.15, x1 - 0.15]) b.cylinder('display', [x, 0, 0], 'y', 0.025, 0.0015, 18);
  return b.toDocument('microwave');
};
