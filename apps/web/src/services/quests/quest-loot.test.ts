import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER } from '@hexoflat/engine/quests/treasure-field';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  offsetToAxial,
} from '@hexoflat/engine/utils/hex-utils';
import en from '@/locales/en/ui.json';
import { getByPath } from '@/i18n/locale-keys';
import { questRefusalText } from '@/composables/quest-messages';
import { i18n } from '@/i18n';
import { lootFlightRequest, finishLootFlights } from '@/services/loot/loot-flight-state';
import { buildQuestField, resolveFieldClick } from './quest-field-model';
import { questHoverObject } from './quest-hover-object';
import { runQuestCommand, type QuestTransport } from './quest-run-transport';
import { questRun } from './quest-run-projection';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/api/client', () => ({ apiClient: { get } }));

const START = axialToOffset(FIELD_CENTER);
const [stackHex, otherHex, farHex] = getHexNeighbors(START);

function collecting(overrides: Partial<QuestProjection> = {}): QuestProjection {
  return {
    offerId: 'seeker-1',
    phase: 'collect',
    outcome: null,
    start: START,
    position: START,
    path: [],
    opened: [],
    hintHex: null,
    chest: { hex: START, empty: true },
    collect: {
      ground: [{ hex: stackHex, itemKey: 'coins', amount: 7 }],
      seen: [START, stackHex, otherHex, farHex],
    },
    stepCost: 1,
    backCost: 3,
    ...overrides,
  };
}

const OPENED = {
  type: 'CONTAINER_OPENED',
  payload: {
    actorId: 'hero',
    containerId: 'chest',
    kind: 'quest-chest',
    hex: offsetToAxial(START),
    from: offsetToAxial(START),
    nothing: false,
    placed: [{ hex: offsetToAxial(stackHex), itemKey: 'coins', amount: 7 }],
    toBag: [{ itemKey: 'sword', amount: 1 }],
  },
};

describe('quest field while collecting', () => {
  it('shows the hero on the emptied chest and the stack with its quantity', () => {
    const model = buildQuestField(collecting());
    expect(model.chestEmpty).toBe(true);
    expect(model.position).toEqual(START);
    expect(model.ground).toEqual([{ hex: stackHex, itemKey: 'coins', amount: 7 }]);
    expect(model.hexes.some((cell) => coordinateKey(cell.hex) === coordinateKey(stackHex))).toBe(
      true,
    );
  });

  it('offers free steps on seen neighbours but not on the chest or a stack', () => {
    const model = buildQuestField(collecting());
    const stepOf = (hex: typeof START) =>
      model.hexes.find((cell) => coordinateKey(cell.hex) === coordinateKey(hex))?.step;
    expect(stepOf(otherHex)).toEqual({ cost: 0, back: false });
    expect(stepOf(stackHex)).toBeNull();
    expect(stepOf(START)).toBeNull();
  });

  it('resolves clicks: a seen neighbour walks, the chest, a stack and a far hex do nothing (objects use the tool hex)', () => {
    const run = collecting();
    expect(resolveFieldClick(run, stackHex)).toBeNull();
    expect(resolveFieldClick(run, otherHex)).toEqual({ kind: 'step', hex: otherHex });
    expect(resolveFieldClick(run, START)).toBeNull();
    expect(resolveFieldClick(run, { columnIndex: 0, rowIndex: 0 })).toBeNull();
  });

  it('hover: a stack and the emptied chest are the ordinary hexobjects with their quantity', () => {
    const model = buildQuestField(collecting());
    const stack = questHoverObject(model, stackHex);
    expect(stack?.hexobjectKey).toBe('coins');
    expect(stack?.quantity).toBe(7);
    expect(questHoverObject(model, START)?.hexobjectKey).toBe('chest-open');
  });
});

describe('quest refusals reuse the loot texts', () => {
  const reasons = [
    'STANDING_ON_TARGET',
    'CHEST_EMPTY',
    'CONTAINER_EMPTY',
    'NO_ROOM_FOR_LOOT',
    'BAG_FULL',
    'NOT_ADJACENT',
    'HEX_BLOCKED',
    'NO_LOOT_THERE',
  ];

  it.each(['en', 'uk'] as const)('every refusal has a specific %s text', (locale) => {
    i18n.global.locale.value = locale;
    const other = questRefusalText('SOMETHING_ELSE');
    for (const reason of reasons) {
      const text = questRefusalText(reason);
      expect(text).not.toBe(other);
      expect(text).not.toMatch(/^quest\.|^loot\./);
    }
  });

  it('uses the loot.reject keys for the loot reasons', () => {
    i18n.global.locale.value = 'en';
    expect(questRefusalText('CONTAINER_EMPTY')).toBe(
      String(getByPath(en, 'loot.reject.CONTAINER_EMPTY')),
    );
    expect(questRefusalText('STANDING_ON_TARGET')).toBe(
      String(getByPath(en, 'loot.reject.STANDING_ON_TARGET')),
    );
  });
});

describe('quest transport and loot flights', () => {
  const applyInventory = vi.fn();

  function transport(): QuestTransport {
    return {
      socket: {} as QuestTransport['socket'],
      heroId: 'hero',
      progressRevision: 1,
      applyProgress: vi.fn(),
      applyInventory,
      lost: vi.fn(),
    };
  }

  function withResponse(response: Record<string, unknown>) {
    const base = transport();
    base.socket = {
      sendQuest: vi.fn().mockResolvedValue({
        result: 'applied',
        events: [],
        aggregates: {},
        quest: null,
        ...response,
      }),
    } as unknown as QuestTransport['socket'];
    return base;
  }

  beforeEach(() => {
    get.mockReset();
    applyInventory.mockClear();
    questRun.value = null;
    finishLootFlights();
  });

  it('applies the chest event: projection, bag and a flight in one go', async () => {
    const quest = collecting();
    const inventory = { revision: 4, state: {} };
    const base = withResponse({ events: [OPENED], quest, aggregates: { inventory } });
    const answer = await runQuestCommand(base, 'QUEST_OPEN_CHEST', {});
    expect(answer.ok).toBe(true);
    expect(applyInventory).toHaveBeenCalledWith(inventory);
    expect(questRun.value).toEqual(quest);
    expect(lootFlightRequest.value?.flights).toHaveLength(2);
    expect(lootFlightRequest.value?.flights[0]).toMatchObject({ itemKey: 'coins', to: stackHex });
    expect(get).not.toHaveBeenCalled();
  });

  it('does not apply a delayed response after its map or session becomes stale', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => {
      resolve = done;
    });
    const base = transport();
    const applyProgress = vi.fn();
    base.applyProgress = applyProgress;
    base.socket = { sendQuest: () => pending } as unknown as QuestTransport['socket'];
    let current = true;
    base.isCurrent = () => current;
    const answer = runQuestCommand(base, 'QUEST_ENTER', { questId: 'seeker-1' });
    current = false;
    resolve({
      result: 'applied',
      quest: collecting(),
      events: [OPENED],
      aggregates: { inventory: {} },
    });
    expect(await answer).toEqual({ ok: false, code: 'STALE_CONTEXT', events: [] });
    expect(applyProgress).not.toHaveBeenCalled();
    expect(applyInventory).not.toHaveBeenCalled();
    expect(questRun.value).toBeNull();
    expect(lootFlightRequest.value).toBeNull();
  });

  it('does not mark a newer session offline when an old request rejects', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise((_, fail) => {
      reject = fail;
    });
    const base = transport();
    const lost = vi.fn();
    base.lost = lost;
    base.socket = { sendQuest: () => pending } as unknown as QuestTransport['socket'];
    let current = true;
    base.isCurrent = () => current;
    const answer = runQuestCommand(base, 'QUEST_ENTER', { questId: 'seeker-1' });
    current = false;
    reject(new Error('old socket closed'));
    expect(await answer).toEqual({ ok: false, code: 'STALE_CONTEXT', events: [] });
    expect(lost).not.toHaveBeenCalled();
  });

  it('a replayed answer that still carries a removed event name does not throw and plays no flight', async () => {
    get.mockResolvedValue({ quest: collecting() });
    const old = { type: 'CHEST_OPENED', payload: { hex: START } };
    const base = withResponse({ events: [old], quest: null, replayed: true });
    await expect(runQuestCommand(base, 'QUEST_OPEN_CHEST', {})).resolves.toBeDefined();
    expect(lootFlightRequest.value).toBeNull();
  });

  it('a replayed answer refetches the run exactly once and plays no flight', async () => {
    const fresh = collecting();
    get.mockResolvedValue({ quest: fresh });
    const base = withResponse({ events: [OPENED], quest: null, replayed: true });
    await runQuestCommand(base, 'QUEST_OPEN_CHEST', {});
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/player/quest');
    expect(questRun.value).toEqual(fresh);
    expect(lootFlightRequest.value).toBeNull();
  });

  it('a normal answer does not refetch', async () => {
    await runQuestCommand(withResponse({ quest: collecting() }), 'QUEST_PICKUP', {});
    expect(get).not.toHaveBeenCalled();
  });
});
