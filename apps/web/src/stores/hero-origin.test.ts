import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';
import { apiClient } from '@/api/client';
import { fakeWorldSnapshot } from '@/test-support/fake-battle-fixtures';
import { seedFakeSession } from '@/test-support/fake-session';
import { HERO_STORE_BLOB } from './hero-store-blob';
import { useHeroStore } from './hero-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
const { fetchHeroMock } = vi.hoisted(() => ({ fetchHeroMock: vi.fn() }));

vi.mock('@/api/Requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/Requests')>()),
  fetchHero: fetchHeroMock,
}));

const heroFrom = (origin: EDimension): IHero => ({
  id: 'hero-origin',
  name: 'Hero',
  currentHealth: 3,
  maxHealth: 3,
  attack: 1,
  defense: 1,
  kills: 0,
  currentEnergy: 0,
  maxEnergy: 0,
  imgPath: '',
  heroLocation: { columnIndex: 0, rowIndex: 0 },
  heroSteps: 0,
  origin,
});

describe('DA6-6: the hero of the client shows the origin the server sent', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-origin');
    const blobs = { [HERO_STORE_BLOB]: JSON.stringify({ hero: { origin: 'gloom' } }) };
    vi.spyOn(apiClient, 'get').mockImplementation((path: string) =>
      Promise.resolve(
        (path === '/expeditions/current'
          ? { expeditionId: 'exp-origin', blobs }
          : path === '/player/quest'
            ? { quest: null }
            : fakeWorldSnapshot()) as never,
      ),
    );
  });

  it.each(Object.values(EDimension))(
    '%s, also when the saved blob says otherwise',
    async (origin) => {
      fetchHeroMock.mockResolvedValue(heroFrom(origin));
      const store = useHeroStore();
      expect(await store.getHero()).toBe(true);
      expect(store.hero.origin).toBe(origin);
      store.resetHero();
      expect(store.hero.origin).toBe(EDimension.NOWHERE);
    },
  );
});
