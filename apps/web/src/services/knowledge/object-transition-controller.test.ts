import { describe, expect, it, vi } from 'vitest';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { enterQuestDestination, runObjectTransition } from './object-transition-controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const coordinates = { columnIndex: 1, rowIndex: 2 };

describe('destination interaction lifetime', () => {
  it('reports successful quest entry through the ordinary hex action result', async () => {
    const events = await enterQuestDestination(
      {
        isCurrent: () => true,
        ensurePresence: () => Promise.resolve(),
        send: () => Promise.resolve({ ok: true, events: [{ type: 'QUEST_RESUMED', payload: {} }] }),
        refusalText: (reason) => reason,
      },
      coordinates,
      EHexActionType.OPEN,
    );
    expect(events.map((event) => event.type)).toEqual(['QUEST_RESUMED', 'HEX_ACTION_STARTED']);
  });

  it('blocks repeated entry for a hero/map while allowing another hero', async () => {
    const wait = deferred<string>();
    const execute = vi.fn(() => wait.promise);
    const first = runObjectTransition('hero:map', execute, () => 'ignored');
    expect(await runObjectTransition('hero:map', execute, () => 'ignored')).toBe('ignored');
    expect(
      await runObjectTransition(
        'other:map',
        () => Promise.resolve('other'),
        () => 'ignored',
      ),
    ).toBe('other');
    expect(execute).toHaveBeenCalledTimes(1);
    wait.resolve('entered');
    expect(await first).toBe('entered');
    expect(
      await runObjectTransition(
        'hero:map',
        () => Promise.resolve('again'),
        () => 'ignored',
      ),
    ).toBe('again');
  });

  it('releases the guard after a transport exception so entry can be retried', async () => {
    await expect(
      runObjectTransition(
        'retry:map',
        () => Promise.reject(new Error('offline')),
        () => false,
      ),
    ).rejects.toThrow('offline');
    expect(
      await runObjectTransition(
        'retry:map',
        () => Promise.resolve(true),
        () => false,
      ),
    ).toBe(true);
  });

  it('does not send quest entry when the map changes during presence synchronization', async () => {
    const presence = deferred<void>();
    let current = true;
    const send = vi.fn(() => Promise.resolve({ ok: true as const, events: [] }));
    const result = enterQuestDestination(
      {
        isCurrent: () => current,
        ensurePresence: () => presence.promise,
        send,
        refusalText: (reason) => reason,
      },
      coordinates,
      EHexActionType.OPEN,
    );
    current = false;
    presence.resolve();
    expect(await result).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it('translates an authoritative quest refusal into the common action warning', async () => {
    const events = await enterQuestDestination(
      {
        isCurrent: () => true,
        ensurePresence: () => Promise.resolve(),
        send: () => Promise.resolve({ ok: false, code: 'NOT_ACTIVE', events: [] }),
        refusalText: (reason) => `translated:${reason}`,
      },
      coordinates,
      EHexActionType.OPEN,
    );
    expect(events).toEqual([
      {
        type: 'HEX_ACTION_START_REJECTED',
        payload: { coordinates, actionType: EHexActionType.OPEN, message: 'translated:NOT_ACTIVE' },
      },
    ]);
  });

  it('ignores warning events from a quest response belonging to a previous map', async () => {
    const answer = deferred<{ ok: false; code: string; events: [] }>();
    let current = true;
    const send = vi.fn(() => answer.promise);
    const result = enterQuestDestination(
      {
        isCurrent: () => current,
        ensurePresence: () => Promise.resolve(),
        send,
        refusalText: (reason) => reason,
      },
      coordinates,
      EHexActionType.OPEN,
    );
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    current = false;
    answer.resolve({ ok: false, code: 'OFFLINE', events: [] });
    expect(await result).toEqual([]);
  });
});
