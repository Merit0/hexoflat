import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { emptyProgressState } from '../aggregates/progress-state';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { upcastJournalEvents } from '../dimensions/upcast-vocabulary';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState } from '../inventory/inventory-state';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { defaultFactory } from './factory/factory-test-setup';
import { currentItemTokenSchema, itemTokenSchema, type ItemToken } from './token-schema';
import { sampleToken } from './token-test-setup';
import { upcastUniqueInstance, upcastUniqueInstances } from './upcast-unique-instance';

function oldUnique(n = 0, key = 'lantern-eater'): Record<string, unknown> {
  const made = defaultFactory.createUnique(key, {
    seed: 'da4b-upcast',
    sourceId: 'test:da4b.upcast',
    n,
    mapTier: 4,
  });
  if (!made.ok) throw new Error(made.refusal.code);
  const old: Record<string, unknown> = structuredClone(made.value);
  delete old.instanceId;
  const { authoredAttributes } = TOKEN_UNIQUES.find((unique) => unique.key === key)!;
  old.attributes = authoredAttributes.map(({ attribute, min }) => ({ key: attribute, value: min }));
  return old;
}

const WIDE = TOKEN_UNIQUES.map((unique) => ({
  ...unique,
  authoredAttributes: [
    { attribute: 'heart', min: 1, max: 10 },
    { attribute: 'will', min: 1, max: 40 },
  ],
}));

describe('DA4b: unique tokens of old saves', () => {
  it('get an instance id and the authored layer, no generated layer, and nothing else changes', () => {
    const old = oldUnique();
    const before = structuredClone(old);
    const loaded = itemTokenSchema.parse(old);
    const { instanceId, ...rest } = loaded;
    expect(instanceId).toMatch(/^[0-9a-f]{32}$/);
    expect(rest).toEqual(before);
    expect(old).toEqual(before);
    expect(loaded.attributes).toEqual([{ key: 'heart', value: 1 }]);
  });

  it('roll every authored attribute inside its range from a seed derived from the token id', () => {
    const sheets = Array.from({ length: 50 }, (_, n) => {
      const first = upcastUniqueInstance(oldUnique(n), WIDE) as ItemToken;
      expect(upcastUniqueInstance(oldUnique(n), WIDE)).toEqual(first);
      expect(first.attributes.map((attribute) => attribute.key)).toEqual(['heart', 'will']);
      const [heart, will] = first.attributes.map((attribute) => attribute.value);
      expect(heart).toBeGreaterThanOrEqual(1);
      expect(heart).toBeLessThanOrEqual(10);
      expect(will).toBeGreaterThanOrEqual(1);
      expect(will).toBeLessThanOrEqual(40);
      return first;
    });
    expect(new Set(sheets.map((token) => token.instanceId)).size).toBe(50);
    expect(new Set(sheets.map((token) => JSON.stringify(token.attributes))).size).toBeGreaterThan(
      25,
    );
  });

  it('are read once: a token with an instance id is left alone', () => {
    const once = upcastUniqueInstance(oldUnique(), WIDE);
    expect(upcastUniqueInstance(once, WIDE)).toBe(once);
  });

  it('keep an owned attribute that the template does not author', () => {
    const old = { ...oldUnique(), attributes: [{ key: 'trophy', value: 2 }] };
    expect(itemTokenSchema.parse(old).attributes).toEqual([
      { key: 'trophy', value: 2 },
      { key: 'heart', value: 1 },
    ]);
  });

  it('keep their attributes when the template is gone', () => {
    const old: Record<string, unknown> = { ...oldUnique(), uniqueKey: 'forgotten-blade' };
    const loaded = itemTokenSchema.parse(old);
    expect(loaded.attributes).toEqual(old.attributes);
    expect(loaded.instanceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('the strict schema wants an instance id on a unique only', () => {
    const unique = itemTokenSchema.parse(oldUnique());
    expect(currentItemTokenSchema.safeParse(unique).success).toBe(true);
    expect(currentItemTokenSchema.safeParse(oldUnique()).success).toBe(false);
    expect(currentItemTokenSchema.safeParse({ ...unique, instanceId: 'x' }).success).toBe(false);
    const base = sampleToken();
    expect(currentItemTokenSchema.safeParse(base).success).toBe(true);
    expect(
      currentItemTokenSchema.safeParse({ ...base, instanceId: unique.instanceId }).success,
    ).toBe(false);
  });

  it('inventory v5 -> v6 reads the bag, the hands and the stash', () => {
    expect(AGGREGATES.inventory.schemaVersion).toBe(6);
    const cell = (id: string, token: Record<string, unknown>) => ({
      id,
      key: 'sword',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token,
    });
    const state = emptyInventoryState('hero');
    const base = sampleToken();
    const old: unknown = JSON.parse(
      JSON.stringify({
        ...state,
        bag: [cell('hero:0', oldUnique(0)), cell('hero:3', base), ...state.bag.slice(2)],
        equip: { ...state.equip, weapon: cell('hero:1', oldUnique(1, 'last-verdict')) },
        stash: {
          ...state.stash,
          cells: [cell('hero:2', oldUnique(2)), ...state.stash.cells.slice(1)],
        },
      }),
    );
    const step = AGGREGATES.inventory.upcasters[5](old, { heroId: 'hero' }) as typeof state;
    expect(step.bag[0]!.token!.instanceId).toBeDefined();
    const loaded = upcastAggregate('inventory', 5, old, { heroId: 'hero' });
    expect(loaded.bag[0]!.token).toEqual(itemTokenSchema.parse(oldUnique(0)));
    expect(loaded.bag[1]!.token).toEqual(base);
    expect(loaded.equip.weapon!.token).toEqual(itemTokenSchema.parse(oldUnique(1, 'last-verdict')));
    expect(loaded.stash.cells[0]!.token).toEqual(itemTokenSchema.parse(oldUnique(2)));
    expect(upcastAggregate('inventory', 6, loaded, { heroId: 'hero' })).toEqual(loaded);
  });

  it('progress listings, world ground items and journal events use the same reader', () => {
    const token = itemTokenSchema.parse(oldUnique());
    const progress = emptyProgressState('hero');
    const listing = { key: 'sword', amount: 1, unitPrice: 100, token: oldUnique() };
    const stored: unknown = JSON.parse(
      JSON.stringify({ ...progress, listings: [listing, ...progress.listings.slice(1)] }),
    );
    const version = AGGREGATES.progress.schemaVersion;
    expect(
      upcastAggregate('progress', version, stored, { heroId: 'hero' }).listings[0]!.token,
    ).toEqual(token);

    const world = createServerWorld('cave', 'da4b-map', 'da4b-seed', 'hero');
    const tile = world.map.tiles.find((entry) => !entry.hexobject)!;
    tile.hexobject = HexObjectFactory.create('sword', tile.coordinates, { token });
    const old: unknown = JSON.parse(
      JSON.stringify(serializeWorld(world)).replace(`"instanceId":"${token.instanceId}",`, ''),
    );
    expect(JSON.stringify(old)).not.toContain('instanceId');
    const restored = deserializeWorld(old, 0);
    const found = restored.map.tiles.find((entry) => entry.hexobject?.token?.id === token.id)!;
    expect(found.hexobject!.token).toEqual(token);

    const events = [{ type: 'X', payload: { token: oldUnique() } }];
    expect(upcastJournalEvents(events)).toEqual([{ type: 'X', payload: { token } }]);
    expect(upcastUniqueInstances({ look: { tier: 'unique' } })).toEqual({
      look: { tier: 'unique' },
    });
  });
});
