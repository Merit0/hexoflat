import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { inventorySession, resetInventorySession } from '@/services/inventory/inventory-session';
import { readBlob, removeBlob, writeBlob } from '@/services/persistence/world-blob-store';

const get = vi.fn();
const patch = vi.fn();
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiClient: {
    get: (...a: unknown[]) => get(...a) as unknown,
    patch: (...a: unknown[]) => patch(...a) as unknown,
  },
}));

const { flushExpedition, onExpeditionTakenOver, startExpeditionSync, stopExpeditionSync } =
  await import('./expedition-sync');

describe('expedition sync (D4a)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
    patch.mockReset();
    patch.mockResolvedValue({ revision: 1 });
    resetInventorySession();
    inventorySession.status = 'live';
    inventorySession.sessionToken = 'secret';
  });
  afterEach(() => {
    stopExpeditionSync();
    onExpeditionTakenOver(null);
    vi.useRealTimers();
  });

  it('loads the server copy of the world before anyone reads it', async () => {
    get.mockResolvedValue({ blobs: { index: '{"silesia":"m1"}' } });
    await startExpeditionSync();
    expect(readBlob('index')).toBe('{"silesia":"m1"}');
    expect(patch).not.toHaveBeenCalled();
  });

  it('sends a change a moment later with the session secret, one request for many changes', async () => {
    get.mockResolvedValue({ blobs: {} });
    await startExpeditionSync();
    writeBlob('nav', '{"a":1}');
    writeBlob('nav', '{"a":2}');
    writeBlob('map:11111111-1111-4111-8111-111111111111', '{}');
    expect(patch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(patch).toHaveBeenCalledTimes(1);
    const [path, body, options] = patch.mock.calls[0] as [
      string,
      { put: Record<string, string>; remove: string[] },
      { headers: Record<string, string> },
    ];
    expect(path).toBe('/expeditions/current');
    expect(body.put).toEqual({ nav: '{"a":2}', 'map:11111111-1111-4111-8111-111111111111': '{}' });
    expect(body.remove).toEqual([]);
    expect(options.headers['X-Player-Session']).toBe('secret');
  });

  it('sends a removal as a removal, and a key written then removed only as a removal', async () => {
    get.mockResolvedValue({ blobs: { index: '{}' } });
    await startExpeditionSync();
    removeBlob('index');
    writeBlob('nav', '1');
    removeBlob('nav');
    await flushExpedition();
    expect(patch.mock.calls[0][1]).toEqual({ put: {}, remove: ['index', 'nav'] });
  });

  it('flushes at once on request and has nothing to send when nothing changed', async () => {
    get.mockResolvedValue({ blobs: {} });
    await startExpeditionSync();
    writeBlob('nav', '1');
    await flushExpedition();
    expect(patch).toHaveBeenCalledTimes(1);
    await flushExpedition();
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('keeps what failed to send and sends it with the next flush', async () => {
    get.mockResolvedValue({ blobs: {} });
    await startExpeditionSync();
    patch.mockRejectedValueOnce(new ApiError(500, 'boom'));
    writeBlob('nav', '1');
    await flushExpedition();
    await flushExpedition();
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[1][1]).toEqual({ put: { nav: '1' }, remove: [] });
  });

  it('stops sending and tells the session when another tab took the hero over', async () => {
    get.mockResolvedValue({ blobs: {} });
    const taken = vi.fn(() => {
      inventorySession.status = 'taken-over';
    });
    onExpeditionTakenOver(taken);
    await startExpeditionSync();
    patch.mockRejectedValueOnce(new ApiError(409, 'conflict'));
    writeBlob('nav', '1');
    await flushExpedition();
    expect(taken).toHaveBeenCalledTimes(1);
    expect(inventorySession.sessionToken).toBeNull();
    writeBlob('nav', '2');
    await flushExpedition();
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('does not send anything while the session is not live', async () => {
    get.mockResolvedValue({ blobs: {} });
    await startExpeditionSync();
    inventorySession.status = 'offline';
    writeBlob('nav', '1');
    await flushExpedition();
    expect(patch).not.toHaveBeenCalled();
  });

  it('forgets the copy when the session ends, so the next hero starts from nothing', async () => {
    get.mockResolvedValue({ blobs: { index: '{}' } });
    await startExpeditionSync();
    stopExpeditionSync();
    expect(readBlob('index')).toBeNull();
    writeBlob('nav', '1');
    await flushExpedition();
    expect(patch).not.toHaveBeenCalled();
  });
});
