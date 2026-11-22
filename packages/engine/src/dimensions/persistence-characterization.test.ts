import { describe, expect, it } from 'vitest';
import { upcastAggregate } from '../aggregates/registry';
import { emptyProgressState } from '../aggregates/progress-state';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { sampleToken } from '../tokens/token-test-setup';
import { itemTokenSchema } from '../tokens/token-schema';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { projectWorldForClient } from '../world/client-projection';
import { startQuest } from '../quests/seeker-test-setup';
import { parseQuestRun } from '../quests/quest-state';
import { projectQuestForClient } from '../quests/projection';

describe('D5 stored dimension characterization', () => {
  it('normalizes stock, buyback and listings without rerolling or changing prices', () => {
    const {
      dimension: _dimension,
      baseKey: _baseKey,
      ...legacy
    } = sampleToken({
      rarity: ERarityKind.GLOOM,
      mapTier: 4,
      generatorVersion: 4,
    });
    const progress = emptyProgressState('hero');
    const good = { key: 'sword', amount: 1, token: legacy };
    const raw = {
      ...progress,
      traders: {
        ilva: {
          serial: 8,
          trip: 2,
          paidRefreshes: 1,
          goods: [good],
          buyback: [{ ...good, unitPrice: 49 }],
        },
      },
      listings: [{ ...good, unitPrice: 73 }, ...progress.listings.slice(1)],
    };
    const before = structuredClone(raw);
    const loaded = upcastAggregate('progress', 11, raw, { heroId: 'hero' });
    const expected = itemTokenSchema.parse(legacy);
    expect(loaded.traders.ilva?.goods[0]?.token).toEqual(expected);
    expect(loaded.traders.ilva?.buyback[0]).toMatchObject({ unitPrice: 49, token: expected });
    expect(loaded.listings[0]).toMatchObject({ unitPrice: 73, token: expected });
    expect(upcastAggregate('progress', 11, loaded, { heroId: 'hero' })).toEqual(loaded);
    expect(raw).toEqual(before);
  });

  it('keeps an unrolled legacy chest unrolled during hydration and hides it from the client', () => {
    const world = createServerWorld('cave', 'legacy-cave', 'legacy-seed', 'hero');
    const saved = serializeWorld(world);
    delete saved.tokenOrigin;
    const chest = saved.map.tiles.find((tile) => tile.hexobject?.container)!;
    expect(chest).toBeDefined();
    chest.hexobject!.container = { ...chest.hexobject!.container!, contents: null };
    const loaded = deserializeWorld(structuredClone(saved), 0);
    const roundTrip = serializeWorld(loaded);
    expect(
      roundTrip.map.tiles.find((tile) => tile.hexobject?.container)?.hexobject?.container?.contents,
    ).toBeNull();
    expect(roundTrip.tokenOrigin).toEqual({ realm: 'gloom', mapTier: 1 });
    const publicWorld = projectWorldForClient(roundTrip);
    expect(publicWorld.map.tiles.every((tile) => !tile.hexobject?.container)).toBe(true);
    expect(publicWorld.worldSeed).not.toBe(world.worldSeed);
  });

  it('retains legacy quest loot and source tier while hiding unopened chest data', () => {
    const run = startQuest('seeker-1', 'private-quest-seed').run;
    const {
      dimension: _dimension,
      baseKey: _baseKey,
      ...legacy
    } = sampleToken({ rarity: ERarityKind.SPARK, mapTier: 3 });
    const raw = {
      ...run,
      tokenOrigin: undefined,
      field: {
        origin: 'silesia',
        mapTier: 3,
        background: 'b',
        exit: run.start,
        tiles: [{ hex: run.start }],
      },
      collect: {
        hero: run.start,
        ground: [{ hex: run.start, itemKey: 'sword', amount: 1, token: legacy }],
        seen: [],
      },
    };
    const loaded = parseQuestRun(raw);
    expect(loaded.tokenOrigin).toEqual({ realm: 'idol', mapTier: 3 });
    expect(loaded.collect!.ground[0].token).toEqual(itemTokenSchema.parse(legacy));
    expect(parseQuestRun(loaded)).toEqual(loaded);
    const view = projectQuestForClient(loaded);
    expect(view.dimension).toBe('earth');
    expect(view.collect!.ground[0].token).toEqual(loaded.collect!.ground[0].token);
    expect(view.collect!.ground[0].token).not.toBe(loaded.collect!.ground[0].token);
    const projected = JSON.stringify(projectQuestForClient(loaded));
    expect(projected).not.toContain('private-quest-seed');
    expect(projected).not.toContain('chestLootTableId');
    expect(projected).not.toContain('tokenSecret');
  });
});
