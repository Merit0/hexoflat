import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { claimCampChest } from '../aggregates/claim-camp-chest';
import { executePlayerCommand } from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { emptyProgressState } from '../aggregates/progress-state';
import { createContainer } from '../containers';
import { lootTableOf, SKELETON_KING_TABLE_ID } from '../content/loot-tables.content';
import { emptyInventoryState, type InventoryStateItem } from '../inventory/inventory-state';
import { planClaim } from '../quests/quest-log';
import { QUESTS } from '../quests/quests.content';
import { questTokenOrigin } from '../quests/quest-token-origin';
import { locationTokenOrigin } from '../registry/location-token-origin';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { rollTraderGoods, traderView } from '../trade/trader-view';
import { TRADERS } from '../content/traders.content';
import { createServerWorld } from '../world';
import { isTokenType } from './game-tokens';
import { realmOfBoard, tierOfBoard, tokenOriginOfBoard } from './token-origin';

const HERO = 'hero-1';

function heldTokens(cells: (InventoryStateItem | null)[]) {
  return cells.filter((cell) => cell !== null && isTokenType(cell.key));
}

describe('LG5b step 3: realmOfBoard', () => {
  it('gives gloom under ground and idol on the earth', () => {
    expect(realmOfBoard({ boardKind: 'DUNGEON' })).toBe(ERarityKind.GLOOM);
    expect(realmOfBoard({ boardKind: 'STATIC' })).toBe(ERarityKind.IDOL);
    expect(locationTokenOrigin('cave').realm).toBe(ERarityKind.GLOOM);
    expect(locationTokenOrigin('camping').realm).toBe(ERarityKind.IDOL);
    expect(locationTokenOrigin('silesia').realm).toBe(ERarityKind.IDOL);
  });

  it('reads the tier of a recipe board and gives 1 to a board without one (D11)', () => {
    const recipe = (params: Record<string, unknown>) => ({
      kind: 'RECIPE' as const,
      recipeId: 'cave',
      version: 1,
      seed: 's',
      params,
      attempt: 0,
    });
    expect(tierOfBoard(recipe({ tier: 3 }))).toBe(3);
    expect(tierOfBoard(recipe({}))).toBe(1);
    expect(tierOfBoard(recipe({ tier: 7 }))).toBe(1);
    expect(tierOfBoard({ kind: 'STATIC', id: 'camping' })).toBe(1);
    expect(tierOfBoard(null)).toBe(1);
    expect(tokenOriginOfBoard({ boardKind: 'DUNGEON' }, recipe({ tier: 2 }))).toEqual({
      realm: ERarityKind.GLOOM,
      mapTier: 2,
    });
  });
});

describe('LG5b step 4: every creation point gives tokens', () => {
  it('a cave chest holds gloom tokens of the board tier, one item each', () => {
    let checked = 0;
    for (let seed = 0; seed < 40 && checked === 0; seed += 1) {
      const world = createServerWorld('cave', `map-${seed}`, `seed-${seed}`, HERO);
      for (const tile of world.map.tiles) {
        for (const drop of tile.hexobject?.container?.contents?.flat() ?? []) {
          if (!isTokenType(drop.itemKey)) continue;
          expect(drop.amount).toBe(1);
          expect(drop.token).toMatchObject({ rarity: ERarityKind.GLOOM, mapTier: 1 });
          expect(drop.token!.id.startsWith('chest:')).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a grave holds tokens of the origin written on the battle', () => {
    const grave = createContainer({
      id: '0,0',
      kind: 'grave',
      at: { q: 0, r: 0 },
      tables: Array.from({ length: 20 }, () => lootTableOf(SKELETON_KING_TABLE_ID)),
      seed: 'grave-seed',
      sourceId: 'battle-1',
      targetKey: '0,0',
      origin: { realm: ERarityKind.GLOOM, mapTier: 2 },
    });
    const gear = grave.contents!.flat().filter((drop) => isTokenType(drop.itemKey));
    expect(gear.length).toBeGreaterThan(0);
    for (const drop of gear) {
      expect(drop.token).toMatchObject({
        rarity: ERarityKind.GLOOM,
        mapTier: 2,
        type: drop.itemKey,
      });
      expect(drop.token!.id.startsWith('grave:battle-1.0-0:')).toBe(true);
    }
    expect(new Set(gear.map((drop) => drop.token!.id)).size).toBe(gear.length);
  });

  it('a quest chest takes the realm of the map the field was cloned from', () => {
    const field = {
      origin: 'silesia' as const,
      background: 'b',
      exit: { columnIndex: 0, rowIndex: 0 },
    };
    expect(questTokenOrigin({ field: { ...field, tiles: [], mapTier: 1 } })).toEqual({
      realm: ERarityKind.IDOL,
      mapTier: 1,
    });
    expect(questTokenOrigin({ field: { ...field, origin: 'cave', tiles: [] } }).realm).toBe(
      ERarityKind.GLOOM,
    );
  });

  it('the first camp chest gives idol tokens for the four tools and weapons', () => {
    const result = claimCampChest(emptyInventoryState(HERO), emptyProgressState(HERO), 0);
    if (!result.ok) throw new Error(result.reason);
    const tokens = heldTokens(result.inventory.stash.cells);
    expect(tokens).toHaveLength(4);
    for (const cell of tokens) {
      expect(cell!.token).toMatchObject({ rarity: ERarityKind.IDOL, type: cell!.key, mapTier: 1 });
    }
  });

  it('a quest reward gives idol tokens, one per piece', () => {
    const progress = emptyProgressState(HERO);
    progress.quests.active = [{ questId: 'woodcutter', progress: 10, state: 'ready' }];
    const plan = planClaim(progress, emptyInventoryState(HERO), 'woodcutter', {
      catalogue: QUESTS,
      atBoard: true,
    });
    if (!plan.ok) throw new Error('claim refused');
    const axes = heldTokens(plan.inventory!.bag);
    expect(axes).toHaveLength(5);
    expect(new Set(axes.map((cell) => cell!.token!.id)).size).toBe(5);
    for (const cell of axes) expect(cell!.token!.id.startsWith('quest:woodcutter.')).toBe(true);
  });

  it('shop goods carry tokens, and a stored trader without them gets the same ones on read', () => {
    const goods = rollTraderGoods(TRADERS.ilva, 'rng', 'ilva', 3);
    for (const good of goods) {
      if (good && isTokenType(good.key))
        expect(good.token?.id.startsWith('shop:ilva.3.g')).toBe(true);
    }
    const plain = goods.map((good) => (good ? { key: good.key, amount: good.amount } : null));
    const progress = emptyProgressState(HERO);
    progress.traders = {
      ilva: { serial: 3, trip: 0, paidRefreshes: 0, goods: plain, buyback: [] },
    };
    expect(traderView(progress, 'ilva', 'rng').goods.map((good) => good?.token)).toEqual(
      goods.map((good) => good?.token),
    );
  });

  it('a dev grant makes a token with a dev source id', () => {
    const outcome = executePlayerCommand(
      { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) },
      PLAYER_COMMAND_SCHEMAS.DEV_GRANT_ITEM.parse({
        type: 'DEV_GRANT_ITEM',
        payload: { heroId: HERO, revision: 0, key: HEXOBJECT_KEYS.SWORD, amount: 1 },
      }),
      { devGrantAllowed: true, inventory: { stashOpen: false, battleOpen: false } },
    );
    if (!outcome.ok) throw new Error(outcome.code);
    const [sword] = heldTokens(outcome.changed.inventory!.bag);
    expect(sword!.token!.id.startsWith('dev:hero-1.')).toBe(true);
  });
});
