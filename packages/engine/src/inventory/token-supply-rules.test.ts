import { describe, expect, it } from 'vitest';
import { sampleToken } from '../tokens/token-test-setup';
import { devTokenMint, grantToDraft, type IInventoryDraft } from './apply-stock';
import { emptyInventoryState, inventoryStateSchema, mintItem } from './inventory-state';
import { upcastTokenIdentities } from './upcast-token-identities';

function draft(): IInventoryDraft {
  return { current: emptyInventoryState('hero'), events: [] };
}

describe('authoritative token supply', () => {
  it('rejects invalid and oversized grants without unbounded token validation', () => {
    for (const amount of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      const bag = draft();
      const before = structuredClone(bag.current);
      expect(
        grantToDraft(bag, 'sword', amount, 'loot', {
          mint: devTokenMint(bag.current!),
        }),
      ).toBe(false);
      expect(bag.current).toEqual(before);
    }
  });
  it('refuses missing gear supply without mutating inventory', () => {
    const bag = draft();
    const before = structuredClone(bag.current);
    expect(grantToDraft(bag, 'sword', 1, 'loot')).toBe(false);
    expect(bag.current).toEqual(before);
    expect(bag.events[0].payload).toMatchObject({ reason: 'TOKEN_SOURCE_REQUIRED' });
  });

  it('refuses a mismatched type and duplicate supplied tokens atomically', () => {
    const bag = draft();
    expect(grantToDraft(bag, 'shield', 1, 'pickup', { tokens: [sampleToken()] })).toBe(false);
    expect(
      grantToDraft(bag, 'sword', 2, 'reward', { tokens: [sampleToken(), sampleToken()] }),
    ).toBe(false);
    expect(bag.current!.bag.every((cell) => cell === null)).toBe(true);
  });

  it('preserves the token on pickup and refuses a second pickup of the same identity', () => {
    const bag = draft();
    const token = sampleToken();
    expect(grantToDraft(bag, 'sword', 1, 'pickup', { tokens: [token] })).toBe(true);
    expect(bag.current!.bag[0]!.token).toEqual(token);
    expect(grantToDraft(bag, 'sword', 1, 'pickup', { tokens: [token] })).toBe(false);
    expect(bag.current!.bag.filter(Boolean)).toHaveLength(1);
  });

  it('repairs legacy duplicate identities without rerolling stats, and is idempotent', () => {
    const inventory = emptyInventoryState('hero');
    inventory.bag[0] = { ...mintItem(inventory, 'sword', 1), token: sampleToken() };
    inventory.bag[1] = { ...mintItem(inventory, 'sword', 1), token: sampleToken() };
    expect(inventoryStateSchema.safeParse(inventory).success).toBe(false);
    const repaired = inventoryStateSchema.parse(
      upcastTokenIdentities(inventory, { heroId: 'hero' }),
    );
    expect(repaired.bag[0]!.token!.id).not.toBe(repaired.bag[1]!.token!.id);
    expect({ ...repaired.bag[1]!.token!, id: sampleToken().id }).toEqual(sampleToken());
    expect(upcastTokenIdentities(repaired, { heroId: 'hero' })).toEqual(repaired);
    expect(inventory.bag[0].token!.id).toBe(inventory.bag[1].token!.id);
  });
});
