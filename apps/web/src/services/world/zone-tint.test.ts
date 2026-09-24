import { describe, expect, it } from 'vitest';
import { assembleGeneratedBoard } from '@hexoflat/engine/boards/assemble-generated-board';
import { CAVE_PRESET } from '@hexoflat/engine/content/boards/presets/cave';
import { computeZoneLegend, computeZoneTints } from './zone-tint';

describe('computeZoneTints / computeZoneLegend', () => {
  it('gives every zone of the built layout a tint and a legend entry with its real chunk id', () => {
    const { descriptor } = assembleGeneratedBoard('zone-tint-test', CAVE_PRESET);

    const legend = computeZoneLegend(descriptor);
    expect(legend.length).toBeGreaterThan(0);
    for (const entry of legend) {
      expect(entry.chunkId).not.toBe('?');
    }

    const tints = computeZoneTints(descriptor);
    expect(tints.size).toBeGreaterThan(0);
  });

  it('returns nothing for a STATIC descriptor', () => {
    expect(computeZoneTints({ kind: 'STATIC', id: 'silesia' })).toEqual(new Map());
    expect(computeZoneLegend({ kind: 'STATIC', id: 'silesia' })).toEqual([]);
  });

  it('returns nothing for a null descriptor', () => {
    expect(computeZoneTints(null)).toEqual(new Map());
    expect(computeZoneLegend(null)).toEqual([]);
  });
});
