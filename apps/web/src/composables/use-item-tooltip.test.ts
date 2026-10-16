import { describe, expect, it } from 'vitest';
import { computeTooltipPosition } from './use-item-tooltip';

const size = { width: 360, height: 300 };
const viewport = { width: 1280, height: 720 };

describe('computeTooltipPosition', () => {
  it('places the tooltip to the right of the cell with a 16px gap', () => {
    const rect = { left: 100, right: 176, top: 300, height: 76 };
    expect(computeTooltipPosition(rect, size, viewport)).toEqual({ left: 192, top: 188 });
  });

  it('flips to the left when there is no room on the right', () => {
    const rect = { left: 1000, right: 1076, top: 300, height: 76 };
    const { left } = computeTooltipPosition(rect, size, viewport);
    expect(left).toBe(1000 - 16 - 360);
  });

  it('never leaves the left edge when it fits on neither side', () => {
    const rect = { left: 200, right: 276, top: 300, height: 76 };
    const { left } = computeTooltipPosition(rect, size, { width: 400, height: 720 });
    expect(left).toBe(24);
  });

  it('keeps 24px from the top and bottom of the window', () => {
    const near = { left: 100, right: 176, top: 0, height: 76 };
    expect(computeTooltipPosition(near, size, viewport).top).toBe(24);
    const far = { left: 100, right: 176, top: 700, height: 76 };
    expect(computeTooltipPosition(far, size, viewport).top).toBe(720 - 24 - 300);
  });
});
