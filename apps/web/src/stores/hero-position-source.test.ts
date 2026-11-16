import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { readBlob, writeBlob } from '@/services/persistence/world-blob-store';
import { ensurePresence } from '@/services/inventory/inventory-sync';
import { fakePlaceHero, fakePresence, fakeStoredWorldOf } from '@/test-support/fake-player-server';
import { fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import { crossExitIfStanding } from '@/composables/use-board-crossing';
import { usePortal } from '@/composables/use-portal';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { useHeroInventoryStore } from './hero-inventory-store';
import { HERO_STORE_BLOB, savableHeroState } from './hero-store-blob';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
  replaceLocationRoute: vi.fn(async () => {}),
}));

const LEGACY_FIELD = 'positionByMapId';

function seedStandingIn(locationKey: 'silesia' | 'cave') {
  seedFakeSession('hero-pos');
  fakeStandIn(locationKey);
  const world = fakeStoredWorldOf(locationKey)!;
  return { mapId: world.mapId, projected: { ...world.heroCoordinates! } };
}

function otherGround(locationKey: string, not: IHexCoordinates): IHexCoordinates {
  const tile = fakeStoredWorldOf(locationKey)!.map.tiles.find(
    (candidate) =>
      candidate.terrain === 'ground' &&
      !candidate.hexobject &&
      coordinateKey(candidate.coordinates) !== coordinateKey(not),
  )!;
  return { ...tile.coordinates };
}

function storeLegacyHeroBlob(locationKey: string, positions: Record<string, IHexCoordinates>) {
  const [first] = Object.values(positions);
  writeBlob(
    HERO_STORE_BLOB,
    JSON.stringify({
      heroCoordinates: first,
      nav: {
        locationKey,
        locationMapId: null,
        [LEGACY_FIELD]: positions,
        returnStack: [],
      },
    }),
  );
}

describe('where the hero stands after a map load', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('REQ-1: equals the server projection even when the stored blob remembers another hex', () => {
    const { mapId, projected } = seedStandingIn('cave');
    const remembered = otherGround('cave', projected);
    storeLegacyHeroBlob('cave', { [mapId]: remembered });
    const hero = useHeroStore();
    hero.restoreFromExpedition();
    expect(hero.heroCoordinates).toBeNull();

    useWorldMapStore().bootstrapWorld();

    expect(useWorldMapStore().currentMapId).toBe(mapId);
    expect(hero.heroCoordinates).toEqual(projected);
  });
});

describe('where the hero stands after an arrival', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-pos');
    fakeStandIn('silesia');
    useWorldMapStore().loadLocationMap('silesia');
  });

  it('REQ-2: equals the server projection after crossing a board edge, whatever the blob remembers', async () => {
    const world = useWorldMapStore();
    const hero = useHeroStore();
    const north = fakeStoredWorldOf('silesia-north')!;
    const remembered = otherGround(
      'silesia-north',
      north.heroCoordinates ?? { columnIndex: -1, rowIndex: -1 },
    );
    storeLegacyHeroBlob('silesia', { [north.mapId]: remembered });
    hero.restoreFromExpedition();
    const exit = world.map!.tiles.find((tile) => tile.exit === 'N')!;
    await ensurePresence({ locationKey: 'silesia', mapId: world.currentMapId! });
    fakePlaceHero(exit.coordinates);
    hero.heroCoordinates = { ...exit.coordinates };

    expect(await crossExitIfStanding()).toBe(true);

    expect(world.currentLocationKey).toBe('silesia-north');
    expect(fakePresence()?.locationKey).toBe('silesia-north');
    expect(hero.heroCoordinates).toEqual(fakePresence()?.coordinates);
    expect(hero.heroCoordinates).not.toEqual(remembered);
  });

  it('REQ-2: equals the server projection after stepping through a portal, whatever the blob remembers', async () => {
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
    seedFakeSession('hero-pos', { will: 20, skills: { a_crest: 1, a_teleport: 6 } });
    const hero = useHeroStore();
    const world = useWorldMapStore();
    hero.hero.id = 'hero-pos';
    hero.loadKnowledge();
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(HEXOBJECT_KEYS.RETURN_SCROLL, 1);
    fakeStandIn('silesia');
    const camp = fakeStoredWorldOf('camping')!;
    const remembered = otherGround(
      'camping',
      camp.heroCoordinates ?? { columnIndex: -1, rowIndex: -1 },
    );
    storeLegacyHeroBlob('silesia', { [camp.mapId]: remembered });
    hero.restoreFromExpedition();
    world.goToLocation('silesia');
    const target = getHexNeighbors(hero.heroCoordinates!).find((at) => {
      const tile = world.map!.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
      return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
    })!;
    const portal = usePortal();
    expect((await portal.openPortal(target)).ok).toBe(true);

    expect((await portal.enterPortal()).ok).toBe(true);

    expect(world.currentLocationKey).toBe('camping');
    expect(fakePresence()?.locationKey).toBe('camping');
    expect(hero.heroCoordinates).toEqual(fakePresence()?.coordinates);
    expect(hero.heroCoordinates).not.toEqual(remembered);
  });
});

describe('a stored hero blob from before the server held the position', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-pos');
  });

  it('REQ-3: loads without error, and the old per-map positions are not saved again', () => {
    storeLegacyHeroBlob('silesia', { 'old-map': { columnIndex: 4, rowIndex: 2 } });
    const hero = useHeroStore();

    expect(() => hero.restoreFromExpedition()).not.toThrow();
    expect(hero.nav.locationKey).toBe('silesia');
    expect(LEGACY_FIELD in hero.nav).toBe(false);

    hero.setLocation('silesia', 'map-1');

    expect(readBlob('nav')).not.toContain(LEGACY_FIELD);
    expect(JSON.stringify(hero.$state)).not.toContain(LEGACY_FIELD);
  });

  it('the saved hero blob never holds where the hero stands', () => {
    const hero = useHeroStore();
    hero.heroCoordinates = { columnIndex: 3, rowIndex: 7 };

    const saved = savableHeroState(hero.$state);

    expect(saved).not.toHaveProperty('heroCoordinates');
    expect(saved).toHaveProperty('nav');
  });
});
