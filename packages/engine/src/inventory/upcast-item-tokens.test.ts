import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { itemTokenSchema } from '../tokens/token-schema';
import {
  inventoryStateSchema,
  type InventoryState,
  type InventoryStateItem,
} from './inventory-state';
import { inventoryV1Fixture, V1_HERO } from './inventory-v1-fixture';
import { upcastInventoryTokens, upcastSourceId } from './upcast-item-tokens';

function cellsOf(state: InventoryState): (InventoryStateItem | null)[] {
  return [...state.bag, ...Object.values(state.equip), ...state.stash.cells];
}

function stored(): unknown {
  return JSON.parse(JSON.stringify(inventoryV1Fixture()));
}

const upcast = () => upcastAggregate('inventory', 1, stored(), { heroId: V1_HERO });

describe('inventory upcast v1 -> v2 (LG5a, D2, D5)', () => {
  it('declares inventory schema version 3', () => {
    expect(AGGREGATES.inventory.schemaVersion).toBe(3);
  });

  it('gives a valid v2 document with the same item count', () => {
    const v2 = upcast();
    expect(inventoryStateSchema.safeParse(v2).success).toBe(true);
    expect(cellsOf(v2).filter(Boolean)).toHaveLength(6);
  });

  it('turns every old gear key into an idol base token of the same type, tier 1', () => {
    const v2 = upcast();
    const gear = [v2.equip.weapon, v2.equip.shield, v2.bag[0], v2.stash.cells[0]];
    expect(gear.map((cell) => cell?.token?.type)).toEqual(['sword', 'shield', 'axe', 'pickaxe']);
    for (const cell of gear) {
      const token = cell!.token!;
      expect(itemTokenSchema.safeParse(token).success).toBe(true);
      expect(token).toMatchObject({ origin: 'base', rarity: ERarityKind.IDOL, mapTier: 1 });
      expect(cell!.key).toBe(token.type);
      expect(cell!.amount).toBe(1);
    }
  });

  it('names the source after the hero and the slot', () => {
    const v2 = upcast();
    expect(v2.equip.weapon!.token!.id).toBe(`${upcastSourceId(V1_HERO, 'equip.weapon')}:0`);
    expect(v2.bag[0]!.token!.id).toBe(`${upcastSourceId(V1_HERO, 'bag.0')}:0`);
    expect(v2.stash.cells[0]!.token!.id).toBe(`${upcastSourceId(V1_HERO, 'stash.0')}:0`);
  });

  it('keeps the stacks, ids, revision and id sequence unchanged', () => {
    const v1 = inventoryV1Fixture();
    const v2 = upcast();
    expect(v2.bag[1]).toEqual(v1.bag[1]);
    expect(v2.bag[2]).toEqual(v1.bag[2]);
    expect(cellsOf(v2).map((cell) => cell?.id ?? null)).toEqual(
      cellsOf(v1).map((cell) => cell?.id ?? null),
    );
    expect(v2).toMatchObject({ revision: v1.revision, idSeq: v1.idSeq });
  });

  it('is deterministic', () => {
    expect(upcast()).toEqual(upcast());
  });

  it('is idempotent: running it again gives the same document', () => {
    const once = upcastInventoryTokens(stored(), { heroId: V1_HERO });
    const twice = upcastInventoryTokens(JSON.parse(JSON.stringify(once)), { heroId: V1_HERO });
    expect(twice).toEqual(once);
  });

  it('gives another hero other tokens for the same slots', () => {
    const other = upcastAggregate(
      'inventory',
      1,
      JSON.parse(JSON.stringify(inventoryV1Fixture('hero-2'))),
      {
        heroId: 'hero-2',
      },
    );
    expect(other.equip.weapon!.token!.id).not.toBe(upcast().equip.weapon!.token!.id);
  });

  it('leaves a gear cell with more than one piece as it is', () => {
    const raw = stored() as InventoryState;
    raw.bag[5] = { id: `${V1_HERO}:9`, key: 'sword', type: raw.equip.weapon!.type, amount: 2 };
    const v2 = upcastAggregate('inventory', 1, raw, { heroId: V1_HERO });
    expect(v2.bag[5]).toEqual(raw.bag[5]);
  });
});

describe('inventory cell schema (D1)', () => {
  const tokenCell = () => upcast().equip.weapon!;

  it('refuses an unknown field next to a token (strict branch)', () => {
    const state = upcast();
    (state.equip.weapon as unknown as Record<string, unknown>).extra = 1;
    expect(inventoryStateSchema.safeParse(state).success).toBe(false);
  });

  it('refuses a token whose type differs from the cell key', () => {
    const state = upcast();
    state.equip.weapon = { ...tokenCell(), key: 'axe' };
    expect(inventoryStateSchema.safeParse(state).success).toBe(false);
  });

  it('refuses a token cell with more than one piece', () => {
    const state = upcast();
    state.equip.weapon = { ...tokenCell(), amount: 2 };
    expect(inventoryStateSchema.safeParse(state).success).toBe(false);
  });

  it('refuses a broken token instead of dropping it', () => {
    const state = upcast();
    state.equip.weapon = { ...tokenCell(), token: { ...tokenCell().token!, price: -1 } };
    expect(inventoryStateSchema.safeParse(state).success).toBe(false);
  });

  it('keeps the token through a JSON round trip', () => {
    const state = upcast();
    const again = inventoryStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(again.equip.weapon!.token).toEqual(state.equip.weapon!.token);
  });
});
