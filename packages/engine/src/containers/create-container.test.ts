import { locationDropContext } from '../registry/location-drop-context';
import { DEFAULT_DROP_CONTEXT } from '../tokens/drop-context';
import { EDimension } from '../dimensions/dimensions';
import { describe, expect, it } from 'vitest';
import { SEEKER_CHEST_TABLE_IDS, lootTableOf } from '../content/loot-tables.content';
import { rollLootLists } from '../loot';
import { createContainer } from './create-container';

const AT = { q: 2, r: -1 };

describe('CH-P6 createContainer', () => {
  it('rolls the contents at creation with the stream the opening used, and starts full', () => {
    const tables = [lootTableOf('skeleton-warrior-loot'), lootTableOf('skeleton-king-loot')];
    const made = createContainer({
      id: '2,-1',
      kind: 'grave',
      at: AT,
      tables,
      seed: 's',
      sourceId: 'b1',
      targetKey: '2,-1',
      dropContext: locationDropContext('cave'),
    });
    expect(made.status).toBe('full');
    expect(made.at).toEqual(AT);
    const rawDrops = made.contents!.map((list) =>
      list.map(({ token, ...drop }) => {
        if (token) expect(token.dimension).toBe(EDimension.UNDERWORLD);
        return drop;
      }),
    );
    expect(rawDrops).toEqual(
      rollLootLists(tables, {
        seed: 's',
        sourceId: 'b1',
        targetKey: '2,-1',
        dimension: EDimension.UNDERWORLD,
      }),
    );
  });

  it('no table gives an empty list of lists, never null', () => {
    const made = createContainer({
      id: 'x',
      kind: 'chest',
      at: AT,
      tables: [],
      seed: 's',
      sourceId: 'm',
      targetKey: 'x',
      dropContext: DEFAULT_DROP_CONTEXT,
    });
    expect(made.contents).toEqual([]);
  });

  it.each(SEEKER_CHEST_TABLE_IDS)('10 000 creations from %s are never empty', (tableId) => {
    for (let index = 0; index < 10_000; index += 1) {
      const made = createContainer({
        id: 'c',
        kind: 'quest-chest',
        at: AT,
        tables: [lootTableOf(tableId)],
        seed: `seed-${index}`,
        sourceId: `run-${index}`,
        targetKey: `${index},0`,
        dropContext: DEFAULT_DROP_CONTEXT,
      });
      expect(made.contents![0].length).toBeGreaterThan(0);
    }
  });
});
