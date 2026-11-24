import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { emptyProgressState } from '../aggregates/progress-state';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { upcastJournalEvents } from '../dimensions/upcast-vocabulary';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { emptyInventoryState } from '../inventory/inventory-state';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { defaultFactory } from './factory/factory-test-setup';
import { currentItemTokenSchema, itemTokenSchema, type ItemToken } from './token-schema';
import { sampleToken } from './token-test-setup';
import { upcastTokenSprite, upcastTokenSprites } from './upcast-token-sprite';

const GLOOM = sampleToken({ tokenType: ETokenType.GLOOM, sprite: null });
const OWN = sampleToken({ id: 'test:own:0', sprite: 'idol-sword-01' });

function unique(): ItemToken {
  const made = defaultFactory.createUnique('last-verdict', {
    seed: 'upcast-sprite',
    sourceId: 'test:upcast.sprite',
    n: 0,
    mapTier: 1,
    ownedUniques: [],
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

const UNIQUE = unique();

function oldSave(token: ItemToken, sprite: string): Record<string, unknown> {
  return { ...structuredClone(token), sprite };
}

describe('DA4 O10: stored sprite keys of old saves', () => {
  it.each([
    ['a sprite of another token type', GLOOM, 'idol-sword-01'],
    ['the placeholder', GLOOM, '_placeholder'],
    ['a sprite of another item type', GLOOM, 'gloom-axe-01'],
  ])('%s becomes null and nothing else changes', (_name, token, sprite) => {
    const old = oldSave(token, sprite);
    const before = structuredClone(old);
    expect(upcastTokenSprite(old)).toEqual(token);
    expect(itemTokenSchema.parse(old)).toEqual(token);
    expect(old).toEqual(before);
  });

  it('keeps an own sprite key', () => {
    expect(upcastTokenSprite(OWN)).toBe(OWN);
    expect(itemTokenSchema.parse(OWN).sprite).toBe('idol-sword-01');
  });

  it.each(['_placeholder', 'unique-last-verdict', 'last-verdict'])(
    'drops the sprite %s of a unique token',
    (sprite) => {
      const loaded = itemTokenSchema.parse(oldSave(UNIQUE, sprite));
      expect(loaded).toEqual(UNIQUE);
      expect(loaded).not.toHaveProperty('sprite');
    },
  );

  it('the strict schema refuses a stored fallback, a unique with a sprite, a base without one', () => {
    expect(currentItemTokenSchema.safeParse(oldSave(GLOOM, 'idol-sword-01')).success).toBe(false);
    expect(currentItemTokenSchema.safeParse(oldSave(GLOOM, '_placeholder')).success).toBe(false);
    expect(currentItemTokenSchema.safeParse(oldSave(UNIQUE, 'last-verdict')).success).toBe(false);
    expect(currentItemTokenSchema.safeParse({ ...UNIQUE, sprite: null }).success).toBe(false);
    expect(currentItemTokenSchema.safeParse({ ...GLOOM, sprite: undefined }).success).toBe(false);
    expect(currentItemTokenSchema.safeParse(GLOOM).success).toBe(true);
  });

  it('the reader still refuses a malformed sprite', () => {
    expect(itemTokenSchema.safeParse(oldSave(GLOOM, 'idol-sword-01.png')).success).toBe(false);
  });

  it('is idempotent over a whole document and leaves other sprite fields alone', () => {
    const doc = {
      look: { sprite: '_placeholder' },
      list: [
        { token: oldSave(GLOOM, 'idol-sword-01') },
        { token: oldSave(UNIQUE, '_placeholder') },
      ],
    };
    const once = upcastTokenSprites(doc);
    expect(once).toEqual({
      look: { sprite: '_placeholder' },
      list: [{ token: GLOOM }, { token: UNIQUE }],
    });
    expect(upcastTokenSprites(once)).toEqual(once);
  });

  it('inventory v4 -> v5 normalizes the bag, the hands and the stash', () => {
    expect(AGGREGATES.inventory.schemaVersion).toBe(5);
    const cell = (id: string, token: Record<string, unknown>) => ({
      id,
      key: 'sword',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token,
    });
    const state = emptyInventoryState('hero');
    const stashToken = { ...GLOOM, id: 'test:stash:0' };
    const old: unknown = JSON.parse(
      JSON.stringify({
        ...state,
        bag: [cell('hero:0', oldSave(GLOOM, 'idol-sword-01')), ...state.bag.slice(1)],
        equip: { ...state.equip, weapon: cell('hero:1', oldSave(UNIQUE, '_placeholder')) },
        stash: {
          ...state.stash,
          cells: [
            cell('hero:2', oldSave(stashToken, '_placeholder')),
            ...state.stash.cells.slice(1),
          ],
        },
      }),
    );
    const step = AGGREGATES.inventory.upcasters[4](old, { heroId: 'hero' }) as typeof state;
    expect(step.bag[0]!.token).toEqual(GLOOM);
    const loaded = upcastAggregate('inventory', 4, old, { heroId: 'hero' });
    expect(loaded.bag[0]!.token).toEqual(GLOOM);
    expect(loaded.equip.weapon!.token).toEqual(UNIQUE);
    expect(loaded.stash.cells[0]!.token).toEqual(stashToken);
  });

  it('progress listings, world ground items and journal events are normalized too', () => {
    const progress = emptyProgressState('hero');
    const listing = { key: 'sword', amount: 1, unitPrice: 100 };
    const loaded = upcastAggregate(
      'progress',
      AGGREGATES.progress.schemaVersion,
      JSON.parse(
        JSON.stringify({
          ...progress,
          listings: [
            { ...listing, token: oldSave(GLOOM, 'idol-sword-01') },
            ...progress.listings.slice(1),
          ],
        }),
      ),
      { heroId: 'hero' },
    );
    expect(loaded.listings[0]!.token).toEqual(GLOOM);

    const world = createServerWorld('cave', 'da4-map', 'da4-seed', 'hero');
    const tile = world.map.tiles.find((entry) => !entry.hexobject)!;
    tile.hexobject = HexObjectFactory.create('sword', tile.coordinates, { token: GLOOM });
    const stored: unknown = JSON.parse(
      JSON.stringify(serializeWorld(world)).replaceAll('"sprite":null', '"sprite":"idol-sword-01"'),
    );
    const restored = deserializeWorld(stored, 0);
    const found = restored.map.tiles.find((entry) => entry.hexobject?.token?.id === GLOOM.id)!;
    expect(found.hexobject!.token).toEqual(GLOOM);

    expect(
      upcastJournalEvents([{ type: 'X', payload: { token: oldSave(GLOOM, '_placeholder') } }]),
    ).toEqual([{ type: 'X', payload: { token: GLOOM } }]);
  });
});
