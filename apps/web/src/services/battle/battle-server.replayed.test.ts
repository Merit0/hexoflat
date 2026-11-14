import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const send = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: { get: (...args: unknown[]): unknown => get(...args) },
}));
vi.mock('@/services/inventory/inventory-sync', () => ({
  sendWorldCommand: (...args: unknown[]): unknown => send(...args),
}));

import { sendBattle } from './battle-server';

describe('a replayed battle answer', () => {
  beforeEach(() => {
    get.mockReset();
    send.mockReset();
  });

  it('reads the battle view from the server exactly once and applies nothing else', async () => {
    const view = { phase: 'ended', collect: { graves: [], items: [] } };
    get.mockResolvedValue({ battleView: view, serverNowMs: 1 });
    send.mockResolvedValue({
      ok: true,
      replayed: true,
      steps: [],
      events: [{ type: 'GRAVE_LOOTED', payload: {} }],
    });
    const reply = await sendBattle({ kind: 'hero', action: { kind: 'move', hex: { q: 0, r: 0 } } });
    expect(get).toHaveBeenCalledTimes(1);
    expect(reply.steps).toEqual([{ battle: view, events: [] }]);
  });

  it('does not read again for a fresh answer', async () => {
    send.mockResolvedValue({ ok: true, steps: [], events: [] });
    await sendBattle({ kind: 'sync' });
    expect(get).not.toHaveBeenCalled();
  });
});
