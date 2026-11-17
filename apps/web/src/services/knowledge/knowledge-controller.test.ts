import { describe, expect, it, vi } from 'vitest';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { StartHexActionCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import { actOnServerWorld, travelOnServer } from '@/services/world/served-world';
import { dispatchHexAction, type KnowledgeHost } from './knowledge-controller';
import { inventorySession } from '@/services/inventory/inventory-session';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';

vi.mock('@/services/inventory/inventory-sync', () => ({
  ensurePresence: vi.fn(() => Promise.resolve()),
  sendProgress: vi.fn(),
  sendQuestCommand: vi.fn(),
}));
vi.mock('@/services/world/served-world', () => ({
  actOnServerWorld: vi.fn(),
  installTravelledWorlds: vi.fn(),
  travelOnServer: vi.fn(),
  readCachedWorld: vi.fn(() => null),
}));

const GATE = { columnIndex: 2, rowIndex: 2 };
const TREE = { columnIndex: 3, rowIndex: 2 };
const EMPTY_RESULT = { ok: true, events: [], tileDiffs: [], effects: [] };

function host(): Omit<KnowledgeHost, 'state'> {
  const map = {
    tiles: [
      { coordinates: GATE, hexobject: HexObjectFactory.create(HEXOBJECT_KEYS.CAVE_ENTRANCE, GATE) },
      { coordinates: TREE, hexobject: HexObjectFactory.create(HEXOBJECT_KEYS.TREE, TREE) },
    ],
  } as unknown as HexMapModel;
  return {
    heroId: 'hero',
    map,
    context: {
      locationKey: 'silesia',
      mapId: 'silesia-map',
      coordinates: { columnIndex: 2, rowIndex: 3 },
    },
    engineContext: {},
    hero: { coordinates: { columnIndex: 2, rowIndex: 3 } },
    location: {},
    isCurrent: () => true,
    clientHint: () => ({}),
    applyWorldResult: vi.fn(),
    travelTo: vi.fn(),
  } as unknown as Omit<KnowledgeHost, 'state'>;
}

function command(coordinates: typeof GATE, actionType: EHexActionType): StartHexActionCommand {
  return {
    type: 'START_HEX_ACTION',
    payload: { heroId: 'hero', coordinates, actionType, toolKey: HEXOBJECT_KEYS.HAND, now: 0 },
  } as unknown as StartHexActionCommand;
}

describe('hex actions while a map transition is in flight', () => {
  it('still sends an ordinary action and ignores only a second transition', async () => {
    inventorySession.knowledge = { current: 10 } as KnowledgeState;
    let release!: () => void;
    vi.mocked(travelOnServer).mockReturnValue(
      new Promise((done) => {
        release = () => done(EMPTY_RESULT as never);
      }),
    );
    vi.mocked(actOnServerWorld).mockResolvedValue(EMPTY_RESULT as never);
    const target = host();
    const gate = dispatchHexAction(target, command(GATE, EHexActionType.ENTER));
    const again = await dispatchHexAction(target, command(GATE, EHexActionType.ENTER));
    expect(again.events).toEqual([]);
    expect(travelOnServer).toHaveBeenCalledTimes(1);
    await dispatchHexAction(target, command(TREE, EHexActionType.CUT));
    expect(actOnServerWorld).toHaveBeenCalledTimes(1);
    release();
    await gate;
  });
});
