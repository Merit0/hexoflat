import { describe, expect, it } from 'vitest';
import { MapRegistry } from '../../registry/world-map-registry';
import { buildStaticBoard } from '../build-static-board';
import { CAMPING_BOARD } from '../../content/boards/static/camping';
import { SILESIA_BOARD } from '../../content/boards/static/silesia';
import { hashStaticDrawing } from '../drawing-hash';

describe('MapRegistry static locations built through the pipeline', () => {
  it.each([
    ['camping', CAMPING_BOARD, 'ALL_REVEALED' as const],
    ['silesia', SILESIA_BOARD, 'FOG' as const],
  ])('%s is identical to the direct buildStaticBoard result', (key, drawing, fog) => {
    const created = MapRegistry.get(key as 'camping' | 'silesia').create({ seed: 'any' });
    const legacy = buildStaticBoard(drawing, fog);

    expect(created.map.toJSON()).toEqual(legacy.map.toJSON());
    expect(created.map.fogPolicy).toBe(fog);
    expect(created.descriptor).toEqual({
      kind: 'STATIC',
      id: drawing.id,
      drawingHash: hashStaticDrawing(drawing),
    });
  });

  it('does not depend on the seed', () => {
    const first = MapRegistry.get('silesia').create({ seed: 'a' });
    const second = MapRegistry.get('silesia').create({ seed: 'b' });
    expect(first.map.toJSON()).toEqual(second.map.toJSON());
  });
});
