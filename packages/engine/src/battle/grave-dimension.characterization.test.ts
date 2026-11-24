import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { CAVE_CHEST_TABLE_ID } from '../content/loot-tables.content';
import { EDimension } from '../dimensions/dimensions';
import { locationDropContext } from '../registry/location-drop-context';
import type { DropContext } from '../tokens/drop-context';
import type { ItemToken } from '../tokens/token-schema';
import { BATTLE_CREATURES } from './battle-catalogue';
import {
  battleStateSchema,
  type BattleCreature,
  type BattleState,
  type Grave,
} from './battle-state';
import { fight, slay, TARGET, warrior } from './collect-test-setup';
import { createGraveContainer } from './grave-contents';

const BATTLE_IDS = Array.from({ length: 12 }, (_, index) => `da2-b3-${index}`);
const EARTH_KIND = 'da5a-earth-carrier';
const UNDERWORLD_KIND = 'da5a-underworld-carrier';

beforeAll(() => {
  const template = { ...BATTLE_CREATURES['skeleton-warrior'], lootTableId: CAVE_CHEST_TABLE_ID };
  BATTLE_CREATURES[EARTH_KIND] = { ...template, dimension: EDimension.EARTH };
  BATTLE_CREATURES[UNDERWORLD_KIND] = { ...template, dimension: EDimension.UNDERWORLD };
});

afterAll(() => {
  delete BATTLE_CREATURES[EARTH_KIND];
  delete BATTLE_CREATURES[UNDERWORLD_KIND];
});

function carrier(kind: string, id = 'e1'): BattleCreature {
  return { ...warrior(id, TARGET), kind };
}

function killed(kinds: string[], dropContext: DropContext, id: string): BattleState {
  const enemies = kinds.map((kind, index) => carrier(kind, `e${index + 1}`));
  const state = fight(enemies, { id });
  state.dropContext = dropContext;
  slay(state, ...enemies.map((enemy) => enemy.id));
  return state;
}

function tokensByTable(grave: Grave): ItemToken[][] {
  return (grave.container!.contents ?? []).map((list) =>
    list.flatMap((drop) => (drop.token ? [drop.token] : [])),
  );
}

function tokensOfKills(kind: string, dropContext: DropContext): ItemToken[] {
  return BATTLE_IDS.flatMap((id) =>
    tokensByTable(killed([kind], dropContext, id).collect!.graves[0]).flat(),
  );
}

describe('DA2 B3: the drop world of a grave', () => {
  it('B3: an EARTH carrier killed on an UNDERWORLD map drops idol tokens', () => {
    const tokens = tokensOfKills(EARTH_KIND, locationDropContext('cave'));
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toMatchObject({ dimension: EDimension.EARTH, tokenType: ETokenType.IDOL });
    }
  });

  it('B3: an UNDERWORLD carrier killed on an EARTH map drops gloom tokens', () => {
    const tokens = tokensOfKills(UNDERWORLD_KIND, locationDropContext('silesia'));
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toMatchObject({
        dimension: EDimension.UNDERWORLD,
        tokenType: ETokenType.GLOOM,
      });
    }
  });

  it('B3: the map tier comes from the map', () => {
    const tokens = tokensOfKills(EARTH_KIND, { tokenType: ETokenType.GLOOM, mapTier: 3 });
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) expect(token.mapTier).toBe(3);
  });

  it('B3: two bodies on one hex keep their own worlds, aligned with the tables', () => {
    const counts = [0, 0];
    for (const id of BATTLE_IDS) {
      const state = killed([EARTH_KIND, UNDERWORLD_KIND], locationDropContext('cave'), id);
      const [grave] = state.collect!.graves;
      expect(grave.dimensions).toEqual([EDimension.EARTH, EDimension.UNDERWORLD]);
      expect(grave.tables).toHaveLength(2);
      const [first, second] = tokensByTable(grave);
      expect(first.every((token) => token.dimension === EDimension.EARTH)).toBe(true);
      expect(second.every((token) => token.dimension === EDimension.UNDERWORLD)).toBe(true);
      counts[0] += first.length;
      counts[1] += second.length;
    }
    expect(Math.min(...counts)).toBeGreaterThan(0);
  });

  it('B3: the extra draws of Trophy belong to the carrier world too', () => {
    const state = fight([{ ...carrier(EARTH_KIND), trophyBonus: 2 }], { id: 'da5a-trophy' });
    state.dropContext = locationDropContext('cave');
    const extras = BATTLE_IDS.flatMap((id) => {
      state.id = id;
      const won = structuredClone(state);
      slay(won, 'e1');
      const [grave] = won.collect!.graves;
      expect(grave.trophyBonuses).toEqual([2]);
      const plain = createGraveContainer(won, { ...grave, trophyBonuses: undefined });
      const base = plain.contents![0].length;
      return grave.container!.contents![0].slice(base).flatMap((drop) => drop.token ?? []);
    });
    expect(extras.length).toBeGreaterThan(0);
    for (const token of extras) expect(token.dimension).toBe(EDimension.EARTH);
  });

  it('B3: an old grave without the list derives it from the fallen', () => {
    const state = killed([EARTH_KIND, UNDERWORLD_KIND], locationDropContext('cave'), 'da5a-old');
    const [grave] = state.collect!.graves;
    const old = JSON.parse(JSON.stringify(state)) as BattleState;
    delete old.collect!.graves[0].dimensions;
    delete old.collect!.graves[0].container;
    const loaded = battleStateSchema.parse(old);
    expect(loaded.collect!.graves[0].dimensions).toBeUndefined();
    expect(createGraveContainer(loaded, loaded.collect!.graves[0])).toEqual(grave.container);
  });

  it('B3: an old grave table without a matching body falls back to the map world, no error', () => {
    const tokens = BATTLE_IDS.flatMap((id) => {
      const state = killed([EARTH_KIND], locationDropContext('cave'), id);
      const [grave] = state.collect!.graves;
      const old: Grave = {
        hex: grave.hex,
        tables: [...grave.tables, CAVE_CHEST_TABLE_ID],
        examined: false,
      };
      const container = createGraveContainer(state, old);
      const [matched, orphan] = tokensByTable({ ...old, container });
      expect(matched.every((token) => token.dimension === EDimension.EARTH)).toBe(true);
      return orphan;
    });
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toMatchObject({
        dimension: EDimension.UNDERWORLD,
        tokenType: ETokenType.GLOOM,
      });
    }
  });

  it('B3: a saved battle keeps the list and refuses nowhere in it', () => {
    const state = killed([EARTH_KIND], locationDropContext('cave'), 'da5a-save');
    const raw = JSON.parse(JSON.stringify(state)) as BattleState;
    expect(battleStateSchema.parse(raw).collect!.graves[0].dimensions).toEqual([EDimension.EARTH]);
    raw.collect!.graves[0].dimensions = [EDimension.NOWHERE];
    expect(battleStateSchema.safeParse(raw).success).toBe(false);
  });
});
