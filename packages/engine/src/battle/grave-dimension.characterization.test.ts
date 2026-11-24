import { describe, expect, it } from 'vitest';
import { CAVE_CHEST_TABLE_ID } from '../content/loot-tables.content';
import { EDimension } from '../dimensions/dimensions';
import { locationDropContext } from '../registry/location-drop-context';
import type { ItemToken } from '../tokens/token-schema';
import { BATTLE_CREATURES } from './battle-catalogue';
import type { BattleCreature, BattleState } from './battle-state';
import { fight, slay, TARGET, warrior } from './collect-test-setup';
import { createGraveContainer } from './grave-contents';

const BATTLE_IDS = Array.from({ length: 12 }, (_, index) => `da2-b3-${index}`);

function earthCarrier(id: string): BattleCreature {
  return { ...warrior(id, TARGET), kind: 'hero' };
}

function graveTokens(state: BattleState): ItemToken[] {
  const grave = state.collect!.graves[0];
  const kind = state.creatures.find((creature) => creature.side === 'enemies')!.kind;
  const tableId = BATTLE_CREATURES[kind].lootTableId;
  expect(grave.tables).toEqual(tableId ? [tableId] : []);
  const container = createGraveContainer(state, { ...grave, tables: [CAVE_CHEST_TABLE_ID] });
  return (container.contents ?? []).flat().flatMap((drop) => (drop.token ? [drop.token] : []));
}

function tokensOfKills(
  carrier: (id: string) => BattleCreature,
  location: 'cave' | 'silesia',
): ItemToken[] {
  return BATTLE_IDS.flatMap((id) => {
    const state = fight([carrier('e1')], { id });
    state.dropContext = locationDropContext(location);
    slay(state, 'e1');
    return graveTokens(state);
  });
}

describe('DA2 B3: the drop world of a grave', () => {
  it('CURRENT (B3): an EARTH carrier killed on an UNDERWORLD map drops gloom tokens', () => {
    expect(BATTLE_CREATURES.hero.dimension).toBe(EDimension.EARTH);
    const tokens = tokensOfKills(earthCarrier, 'cave');
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token.dimension).toBe(EDimension.UNDERWORLD);
      expect(token.tokenType).toBe('gloom');
    }
  });

  it('CURRENT (B3): an UNDERWORLD carrier killed on an EARTH map drops idol tokens', () => {
    expect(BATTLE_CREATURES['skeleton-warrior'].dimension).toBe(EDimension.UNDERWORLD);
    const tokens = tokensOfKills((id) => warrior(id, TARGET), 'silesia');
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token.dimension).toBe(EDimension.EARTH);
      expect(token.tokenType).toBe('idol');
    }
  });
});
