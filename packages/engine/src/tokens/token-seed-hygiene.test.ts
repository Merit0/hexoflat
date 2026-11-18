import { describe, expect, it } from 'vitest';
import { claimCampChest } from '../aggregates/claim-camp-chest';
import { emptyProgressState } from '../aggregates/progress-state';
import { SKELETON_KING_TABLE_ID } from '../content/loot-tables.content';
import { emptyInventoryState } from '../inventory/inventory-state';
import { projectBattleForViewer } from '../battle/projection';
import type { BattleState } from '../battle/battle-state';
import { fight, setGraveTables, slay, warrior } from '../battle/collect-test-setup';
import { planClaim } from '../quests/quest-log';
import { AT_BOARD } from '../quests/quest-test-setup';
import { questRunId } from '../quests/quest-token-origin';
import { followTruth, startQuest } from '../quests/seeker-test-setup';
import { traderView } from '../trade/trader-view';
import { createServerWorld, worldTokenSecret } from '../world/server-world';
import { sourceIdContainsSeed } from './factory/token-factory';
import { isTokenType } from './game-tokens';
import type { ItemToken } from './token-schema';

const HERO = 'hero-1';
const EXPEDITION_SEED = '7c1f0a9e5b3d48e2a6c4f1b9d0e8a7c3';
const RNG_SEED = '2b8e4d1c9f0a7e6b5c3d2a1f0e9d8c7b';
const OTHER_RNG_SEED = '9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d';
const MAP_A = '1f2e3d4c-0000-4000-8000-00000000000a';
const MAP_B = '1f2e3d4c-0000-4000-8000-00000000000b';
const BATTLE_SEED = '5:3:skeleton-pack:battlefield:0';

function expectNoSeedIn(tokens: readonly ItemToken[], seeds: readonly string[]) {
  expect(tokens.length).toBeGreaterThan(0);
  for (const token of tokens)
    for (const seed of seeds) expect(sourceIdContainsSeed(token.id, seed), token.id).toBe(false);
}

function campChestTokens(rngSeed: string): ItemToken[] {
  const result = claimCampChest(emptyInventoryState(HERO), emptyProgressState(HERO), 0, rngSeed);
  if (!result.ok) throw new Error(result.reason);
  return result.inventory.stash.cells.flatMap((cell) => (cell?.token ? [cell.token] : []));
}

function graveTokens(secret: { seed: string; mapId: string }): ItemToken[] {
  const state: BattleState = fight([warrior('w1', { q: 2, r: 0 })], { seed: BATTLE_SEED });
  state.tokenSecret = secret;
  slay(state, 'w1');
  setGraveTables(
    state,
    0,
    Array.from({ length: 20 }, () => SKELETON_KING_TABLE_ID),
  );
  return state.collect!.graves.flatMap((grave) =>
    (grave.container?.contents ?? []).flat().flatMap((drop) => (drop.token ? [drop.token] : [])),
  );
}

function worldOf(mapId: string) {
  return createServerWorld('cave', mapId, EXPEDITION_SEED, HERO);
}

describe('LG5f a token id never carries a seed', () => {
  it('cave chest: chest:<mapId>.<c-r>, no world or expedition seed', () => {
    const worlds = Array.from({ length: 40 }, (_, index) =>
      worldOf(`1f2e3d4c-0000-4000-8000-${String(index).padStart(12, '0')}`),
    );
    for (const world of worlds) {
      const tokens = world.map.tiles.flatMap((tile) =>
        (tile.hexobject?.container?.contents ?? [])
          .flat()
          .flatMap((drop) => (drop.token ? [drop.token] : [])),
      );
      for (const token of tokens) {
        expect(token.id.startsWith(`chest:${world.mapId}.`)).toBe(true);
        expect(sourceIdContainsSeed(token.id, world.worldSeed)).toBe(false);
        expect(sourceIdContainsSeed(token.id, EXPEDITION_SEED)).toBe(false);
      }
    }
    expect(worlds.some((world) => world.map.tiles.some((tile) => tile.hexobject?.container))).toBe(
      true,
    );
  });

  it('grave: grave:<mapId>.<battleId>.<q-r>, no world seed and no battle seed', () => {
    const world = worldOf(MAP_A);
    const tokens = graveTokens(worldTokenSecret(world));
    for (const token of tokens) expect(token.id).toMatch(new RegExp(`^grave:${MAP_A}\\.b1\\.`));
    expectNoSeedIn(tokens, [world.worldSeed, EXPEDITION_SEED, BATTLE_SEED]);
  });

  it('Seeker chest: quest:<runId>.<c-r>, no run seed and no expedition seed', () => {
    const seed = `${EXPEDITION_SEED}:quest:4d9c2b1a-7e6f-4a5b-8c9d-0e1f2a3b4c5d`;
    const { run } = followTruth(startQuest('seeker-1', seed), 10);
    const tokens = (run.chest!.container!.contents ?? [])
      .flat()
      .flatMap((drop) => (drop.token ? [drop.token] : []));
    for (const token of tokens) expect(token.id.startsWith(`quest:${questRunId(run)}.`)).toBe(true);
    expect(questRunId(run)).toMatch(/^[0-9a-f]{12}$/);
    expectNoSeedIn(tokens, [run.seed, EXPEDITION_SEED]);
  });

  it('camp chest, quest reward and trader goods: no server secret', () => {
    expectNoSeedIn(campChestTokens(RNG_SEED), [RNG_SEED]);
    const progress = emptyProgressState(HERO);
    progress.quests.active = [{ questId: 'woodcutter', progress: 10, state: 'ready' }];
    const plan = planClaim(progress, emptyInventoryState(HERO), 'woodcutter', {
      ...AT_BOARD,
      rngSeed: RNG_SEED,
    });
    if (!plan.ok) throw new Error('claim refused');
    const rewards = plan.inventory!.bag.flatMap((cell) => (cell?.token ? [cell.token] : []));
    expectNoSeedIn(rewards, [RNG_SEED]);
    const goods = traderView(emptyProgressState(HERO), 'ilva', RNG_SEED).goods.flatMap((good) =>
      good?.token && isTokenType(good.key) ? [good.token] : [],
    );
    for (const token of goods) expect(sourceIdContainsSeed(token.id, RNG_SEED)).toBe(false);
  });

  it('the battle projection hides the token secret', () => {
    const state = fight([warrior('w1', { q: 2, r: 0 })], { seed: BATTLE_SEED });
    state.tokenSecret = worldTokenSecret(worldOf(MAP_A));
    expect(projectBattleForViewer(state, 'heroes')).not.toHaveProperty('tokenSecret');
  });
});

describe('LG5f grave ids differ between dungeon entries', () => {
  it('two entries into the same dungeon give different grave token ids for the same battle', () => {
    const first = graveTokens(worldTokenSecret(worldOf(MAP_A))).map((token) => token.id);
    const second = graveTokens(worldTokenSecret(worldOf(MAP_B))).map((token) => token.id);
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(first.filter((id) => second.includes(id))).toEqual([]);
  });
});

describe('LG5f token values follow the server secret', () => {
  it('camp chest: the same secret gives the same tokens, another secret other tokens', () => {
    const first = campChestTokens(RNG_SEED);
    expect(campChestTokens(RNG_SEED)).toEqual(first);
    const other = campChestTokens(OTHER_RNG_SEED);
    expect(other.map((token) => token.id)).toEqual(first.map((token) => token.id));
    expect(other).not.toEqual(first);
  });

  it('grave: the same secret gives the same tokens, another secret other tokens', () => {
    const secret = { seed: `${EXPEDITION_SEED}:${MAP_A}`, mapId: MAP_A };
    const first = graveTokens(secret);
    expect(graveTokens(secret)).toEqual(first);
    const other = graveTokens({ ...secret, seed: `${OTHER_RNG_SEED}:${MAP_A}` });
    expect(other.map((token) => token.id)).toEqual(first.map((token) => token.id));
    expect(other).not.toEqual(first);
  });
});
