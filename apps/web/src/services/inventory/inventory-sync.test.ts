import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { emptyInventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { setAuthToken } from '@/api/auth-token';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import type { PlayerCommandResponse, PlayerEnvelope } from '@/services/player/player-socket';
import { inventorySession, resetInventorySession } from './inventory-session';
import { inventoryStateFromStores, withStoreInventory } from './inventory-bridge';
import { moveItem } from './stash-transfer';

const sent: PlayerEnvelope[] = [];
let reply: (envelope: PlayerEnvelope) => PlayerCommandResponse | Error;
let takenOver: (() => void) | null = null;

vi.mock('@/services/player/player-socket', () => {
  class PlayerSocketError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  class PlayerSocket {
    connected = true;
    onTakenOver(listener: () => void) {
      takenOver = listener;
    }
    connect() {
      return Promise.resolve();
    }
    subscribe(heroId: string) {
      const inventory = emptyInventoryState(heroId);
      return Promise.resolve({
        heroId,
        aggregates: {
          inventory: { revision: 0, state: inventory },
          progress: { revision: 0, state: { claimedRewards: [] } },
        },
      });
    }
    send(envelope: PlayerEnvelope) {
      sent.push(envelope);
      const result = reply(envelope);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    }
    close() {}
  }
  return { PlayerSocket, PlayerSocketError };
});

const { startPlayerSession, endPlayerSession, settleInventorySync, claimCampChest } =
  await import('./inventory-sync');
const { PlayerSocketError } = await import('@/services/player/player-socket');

const HERO = '11111111-1111-4111-8111-111111111111';

function applied(envelope: PlayerEnvelope): PlayerCommandResponse {
  return {
    commandId: envelope.commandId,
    result: 'applied',
    events: [],
    aggregates: { inventory: { revision: envelope.expectedRevision + 1, state: {} } },
  };
}

async function live() {
  setActivePinia(createPinia());
  sent.length = 0;
  reply = applied;
  setAuthToken('token');
  inventorySession.claimedRewards = [];
  expect(await startPlayerSession(HERO)).toBe(true);
  useHeroInventoryStore().hydrate();
  return { inventory: useHeroInventoryStore(), stash: useHeroStashStore() };
}

describe('inventory sync with the server', () => {
  beforeEach(() => {
    endPlayerSession();
    resetInventorySession();
  });

  it('does not start without a login token', async () => {
    setActivePinia(createPinia());
    setAuthToken(null);
    expect(await startPlayerSession(HERO)).toBe(false);
    expect(inventorySession.status).toBe('offline');
  });

  it('loads the hero snapshot into the stores and goes live', async () => {
    const { inventory, stash } = await live();
    expect(inventorySession.status).toBe('live');
    expect(inventorySession.heroId).toBe(HERO);
    expect(inventory.items.every((item) => item.key === K.HAND)).toBe(true);
    expect(stash.chests).toBe(0);
  });

  it('mirrors a local move to the server with the revision it started from, in order', async () => {
    const { inventory } = await live();
    inventory.putToInventory(K.SWORD, 1);
    const index = inventoryStateFromStores(HERO).bag.findIndex((cell) => cell?.key === K.SWORD);
    moveItem({ container: 'bag', index }, { container: 'equip', slot: 'weapon' });
    await settleInventorySync();

    expect(sent.map((e) => e.command.type)).toEqual(['DEV_GRANT_ITEM', 'MOVE_ITEM']);
    expect(sent.map((e) => e.expectedRevision)).toEqual([0, 1]);
    expect(sent[0].command.payload).toMatchObject({ heroId: HERO, key: K.SWORD, amount: 1 });
    expect(sent[1].command.payload).toMatchObject({ heroId: HERO, revision: 1 });
    expect(new Set(sent.map((e) => e.commandId)).size).toBe(2);
  });

  it('sends nothing for a refused local command', async () => {
    await live();
    moveItem({ container: 'bag', index: 0 }, { container: 'stash', index: 0 });
    await settleInventorySync();
    expect(sent).toHaveLength(0);
  });

  it('puts the bag back to the server state when the server does not apply the command', async () => {
    const { inventory } = await live();
    reply = (envelope) => ({
      commandId: envelope.commandId,
      result: 'conflict',
      code: 'REVISION_CONFLICT',
      events: [],
      aggregates: {
        inventory: { revision: 7, state: { ...emptyInventoryState(HERO), revision: 7 } },
        progress: { revision: 3, state: { claimedRewards: ['camp-first-chest'] } },
      },
    });
    inventory.putToInventory(K.SWORD, 1);
    expect(inventory.countItem(K.SWORD)).toBe(1);
    await settleInventorySync();

    expect(inventory.countItem(K.SWORD)).toBe(0);
    expect(inventorySession.revision).toBe(7);
    expect(inventorySession.claimedRewards).toEqual(['camp-first-chest']);
    expect(useHeroToolStore().actionMessage).toBeTruthy();
  });

  it('drops the commands that were waiting behind a refused one', async () => {
    const { inventory } = await live();
    let first = true;
    reply = (envelope) => {
      if (first) {
        first = false;
        return {
          commandId: envelope.commandId,
          result: 'rejected',
          code: 'NOT_ENOUGH',
          events: [],
          aggregates: { inventory: { revision: 0, state: emptyInventoryState(HERO) } },
        };
      }
      return applied(envelope);
    };
    inventory.putToInventory(K.SWORD, 1);
    inventory.putToInventory(K.AXE, 1);
    await settleInventorySync();
    expect(sent).toHaveLength(1);
  });

  it('sends a world change (a pickup or a spent scroll) as the new whole inventory', async () => {
    const { inventory } = await live();
    inventory.putToInventory(K.HEALTH_BOTTLE, 2);
    await settleInventorySync();
    sent.length = 0;

    const state = {} as never;
    withStoreInventory(HERO, state, (s) => {
      s.inventory = {
        ...s.inventory!,
        revision: s.inventory!.revision + 3,
        bag: s.inventory!.bag.map((cell, i) => (i === 0 ? null : cell)),
      };
    });
    await settleInventorySync();

    expect(sent).toHaveLength(1);
    expect(sent[0].command.type).toBe('DEV_SET_INVENTORY');
    expect(sent[0].expectedRevision).toBe(1);
  });

  it('stops saving and says so when another tab takes the hero over', async () => {
    const { inventory } = await live();
    reply = () => new PlayerSocketError('SESSION_TAKEN_OVER');
    inventory.putToInventory(K.SWORD, 1);
    await settleInventorySync();
    expect(inventorySession.status).toBe('taken-over');
    expect(useHeroToolStore().actionMessage).toBeTruthy();

    sent.length = 0;
    inventory.putToInventory(K.AXE, 1);
    await settleInventorySync();
    expect(sent).toHaveLength(0);
    expect(takenOver).not.toBeNull();
  });

  it('opens the camp chest through the server and applies its answer', async () => {
    const { stash } = await live();
    reply = (envelope) => ({
      commandId: envelope.commandId,
      result: 'applied',
      events: [],
      aggregates: {
        inventory: {
          revision: 1,
          state: {
            ...emptyInventoryState(HERO),
            revision: 1,
            stash: {
              chests: 1,
              cells: emptyInventoryState(HERO).stash.cells.map((cell, i) =>
                i === 0 ? { id: `${HERO}:0`, key: K.SWORD, type: 'tool', amount: 1 } : cell,
              ),
            },
          },
        },
        progress: { revision: 1, state: { claimedRewards: ['camp-first-chest'] } },
      },
    });

    expect(await claimCampChest()).toEqual({ ok: true });
    expect(sent.map((e) => e.command.type)).toEqual(['CLAIM_CAMP_CHEST']);
    expect(stash.chests).toBe(1);
    expect(stash.cells[0]?.key).toBe(K.SWORD);

    sent.length = 0;
    expect(await claimCampChest()).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('reports a refused claim and an offline session', async () => {
    await live();
    reply = (envelope) => ({
      commandId: envelope.commandId,
      result: 'rejected',
      code: 'INVENTORY_STALE',
      events: [],
      aggregates: {},
    });
    expect(await claimCampChest()).toEqual({ ok: false, code: 'INVENTORY_STALE' });

    endPlayerSession();
    expect(await claimCampChest()).toEqual({ ok: false, code: 'OFFLINE' });
  });
});
