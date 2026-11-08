import { describe, expect, it } from 'vitest';
import { inventoryBaseMetrics, inventoryCellMetrics } from './use-inventory-cell-size';

const grid = { columns: 7, rows: 12 };

describe('inventoryBaseMetrics', () => {
  it('uses the same breakpoints as the Inventory grid', () => {
    expect(inventoryBaseMetrics(1400)).toEqual({ cell: 76, gap: 4 });
    expect(inventoryBaseMetrics(1100)).toEqual({ cell: 64, gap: 5 });
    expect(inventoryBaseMetrics(900)).toEqual({ cell: 56, gap: 4 });
  });
});

describe('inventoryCellMetrics', () => {
  it('grows with the panel exactly as the Inventory fit does, which has no upper limit', () => {
    const m = inventoryCellMetrics({
      panelWidth: 1160,
      panelHeight: 9000,
      viewportWidth: 1400,
      ...grid,
    });
    expect(m.cell).toBeCloseTo(152);
    expect(m.gap).toBeCloseTo(8);
    expect(m.pad).toBeCloseTo(24);
  });

  it('is the base size when the panel is exactly as big as the Inventory grid', () => {
    const m = inventoryCellMetrics({
      panelWidth: 580,
      panelHeight: 980 + 46 + 22,
      viewportWidth: 1400,
      ...grid,
    });
    expect(m).toEqual({ cell: 76, gap: 4, pad: 12 });
  });

  it('shrinks with the width, as the Inventory fit does', () => {
    const wide = inventoryCellMetrics({
      panelWidth: 580,
      panelHeight: 2000,
      viewportWidth: 1400,
      ...grid,
    });
    const narrow = inventoryCellMetrics({
      panelWidth: 290,
      panelHeight: 2000,
      viewportWidth: 1400,
      ...grid,
    });
    expect(wide.cell).toBeCloseTo(76);
    expect(narrow.cell).toBeCloseTo(38);
    expect(narrow.pad).toBeCloseTo(6);
  });

  it('shrinks with the height left under the tabs and above the hint', () => {
    const tall = inventoryCellMetrics({
      panelWidth: 2000,
      panelHeight: 1200,
      viewportWidth: 1400,
      ...grid,
    });
    const short = inventoryCellMetrics({
      panelWidth: 2000,
      panelHeight: 600,
      viewportWidth: 1400,
      ...grid,
    });
    expect(short.cell).toBeLessThan(tall.cell);
    expect(short.cell).toBeCloseTo((76 * (600 - 46 - 22)) / (12 * 76 + 11 * 4 + 24));
  });

  it('seven columns of cells never overflow the panel width', () => {
    const m = inventoryCellMetrics({
      panelWidth: 420,
      panelHeight: 900,
      viewportWidth: 1400,
      ...grid,
    });
    expect(7 * m.cell + 6 * m.gap + 2 * m.pad).toBeLessThanOrEqual(420 + 0.001);
  });

  it('never collapses to nothing in a tiny panel', () => {
    const m = inventoryCellMetrics({ panelWidth: 1, panelHeight: 1, viewportWidth: 1400, ...grid });
    expect(m.cell).toBeGreaterThan(0);
  });
});
