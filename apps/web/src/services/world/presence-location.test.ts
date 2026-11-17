import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { inventorySession } from '@/services/inventory/inventory-session';
import { ensurePresence, settleInventorySync } from '@/services/inventory/inventory-sync';
import { fakeStoredWorldOf, sentCommands } from '@/test-support/fake-player-server';
import { seedFakeSession } from '@/test-support/fake-session';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { heldLocationKey, onHeroElsewhere } from './presence-location';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
  replaceLocationRoute: vi.fn(async () => {}),
}));

function seedStandingIn(locationKey: 'silesia' | 'cave') {
  seedFakeSession('hero-1');
  const world = fakeStoredWorldOf(locationKey)!;
  const coordinates = { ...(world.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 }) };
  seedFakeSession('hero-1', { presence: { locationKey, mapId: world.mapId, coordinates } });
}

describe('the place the server holds for the hero', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sentCommands.length = 0;
    onHeroElsewhere(null);
  });

  it('reports the hero elsewhere and keeps his place when the server refuses an entry to another location', async () => {
    seedStandingIn('silesia');
    const seen = vi.fn();
    onHeroElsewhere(seen);
    await ensurePresence({ locationKey: 'cave', mapId: fakeStoredWorldOf('cave')!.mapId });
    await settleInventorySync();
    expect(seen).toHaveBeenCalledWith('silesia');
    expect(inventorySession.presence?.locationKey).toBe('silesia');
  });

  it('enters quietly while the server has no place for the hero yet', async () => {
    seedFakeSession('hero-1');
    const seen = vi.fn();
    onHeroElsewhere(seen);
    await ensurePresence({ locationKey: 'camping', mapId: fakeStoredWorldOf('camping')!.mapId });
    expect(seen).not.toHaveBeenCalled();
    expect(heldLocationKey()).toBe('camping');
  });

  it('sends a new hero refused at the cave back to the camp', async () => {
    seedFakeSession('hero-1');
    const seen = vi.fn();
    onHeroElsewhere(seen);
    await ensurePresence({ locationKey: 'cave', mapId: fakeStoredWorldOf('cave')!.mapId });
    expect(seen).toHaveBeenCalledWith('camping');
    expect(heldLocationKey()).toBeNull();
  });

  it('opens the world where the server holds the hero, not where the last local note says', () => {
    seedStandingIn('cave');
    const hero = useHeroStore();
    hero.nav.locationKey = 'camping';
    useWorldMapStore().bootstrapWorld();
    expect(useWorldMapStore().currentLocationKey).toBe('cave');
  });
});
