import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import { ApiError } from '../api/client';
import { useUserStore } from './user-store';

const { fetchSessionMock, fetchHeroMock } = vi.hoisted(() => ({
  fetchSessionMock: vi.fn(),
  fetchHeroMock: vi.fn(),
}));

vi.mock('../api/Requests', () => ({
  fetchSession: fetchSessionMock,
  fetchHero: fetchHeroMock,
  login: vi.fn(),
  register: vi.fn(),
}));

const FAKE_HERO: IHero = {
  id: 'hero-1',
  name: 'Hero',
  currentHealth: 100,
  maxHealth: 100,
  attack: 1,
  defense: 1,
  coins: 0,
  kills: 0,
  currentEnergy: 1,
  maxEnergy: 1,
  imgPath: '',
  heroLocation: { columnIndex: 0, rowIndex: 0 },
  heroSteps: 0,
};

describe('useUserStore restoreSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    fetchSessionMock.mockReset();
    fetchHeroMock.mockReset();
  });

  it('succeeds and populates the store when fetchSession resolves', async () => {
    fetchSessionMock.mockResolvedValue({
      user: { id: 'user-1', username: 'merito', name: 'Merito' },
      accessToken: 'fresh-token',
    });
    fetchHeroMock.mockResolvedValue(FAKE_HERO);

    const store = useUserStore();

    const result = await store.restoreSession();

    expect(result).toBe(true);
    expect(store.isUserLoggedIn).toBe(true);
    expect(store.accessToken).toBe('fresh-token');
    expect(store.error).toBe('');
  });

  it('leaves the store logged-out without surfacing an error when fetchSession rejects with a 401', async () => {
    fetchSessionMock.mockRejectedValue(new ApiError(401, 'Unauthorized'));

    const store = useUserStore();

    const result = await store.restoreSession();

    expect(result).toBe(false);
    expect(store.isUserLoggedIn).toBe(false);
    expect(store.error).toBe('');
    expect(fetchHeroMock).not.toHaveBeenCalled();
  });
});
