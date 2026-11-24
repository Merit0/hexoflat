import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';
import { apiClient } from '@/api/client';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { readBlob, writeBlob } from '@/services/persistence/world-blob-store';
import { ensurePresence } from '@/services/inventory/inventory-sync';
import { fakePlaceHero, fakePresence, fakeStoredWorldOf } from '@/test-support/fake-player-server';
import { fakeWorldSnapshot } from '@/test-support/fake-battle-fixtures';
import { fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import { crossExitIfStanding } from '@/composables/use-board-crossing';
import { usePortal } from '@/composables/use-portal';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { useHeroInventoryStore } from './hero-inventory-store';
import { HERO_STORE_BLOB, persistHeroStore } from './hero-store-blob';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
const { fetchHeroMock } = vi.hoisted(() => ({ fetchHeroMock: vi.fn() }));

vi.mock('@/api/Requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/Requests')>()),
  fetchHero: fetchHeroMock,
}));
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

function legacyHeroBlob(locationKey: string, positions: Record<string, IHexCoordinates>): string {
  const [first] = Object.values(positions);
  return JSON.stringify({
    heroCoordinates: first,
    nav: {
      locationKey,
      locationMapId: null,
      [LEGACY_FIELD]: positions,
      returnStack: [],
    },
  });
}

function storeLegacyHeroBlob(locationKey: string, positions: Record<string, IHexCoordinates>) {
  writeBlob(HERO_STORE_BLOB, legacyHeroBlob(locationKey, positions));
}

describe('where the hero stands after a map load', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('MAPFIX-1 REQ-1: equals the server projection even when the stored blob remembers another hex', () => {
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

  it('MAPFIX-1 REQ-2: equals the server projection after crossing a board edge, whatever the blob remembers', async () => {
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

  it('MAPFIX-1 REQ-2: equals the server projection after stepping through a portal, whatever the blob remembers', async () => {
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
    const pinia = createPinia();
    pinia.use(persistHeroStore);
    createApp({}).use(pinia);
    setActivePinia(pinia);
    seedFakeSession('hero-pos');
  });

  it('REQ-4: loads a blob with heroCoordinates, and the next save holds neither it nor the per-map positions', async () => {
    storeLegacyHeroBlob('silesia', { 'old-map': { columnIndex: 4, rowIndex: 2 } });
    const hero = useHeroStore();

    expect(() => hero.restoreFromExpedition()).not.toThrow();
    expect(hero.nav.locationKey).toBe('silesia');
    expect(hero.heroCoordinates).toBeNull();
    expect(LEGACY_FIELD in hero.nav).toBe(false);
    await nextTick();

    hero.heroCoordinates = { columnIndex: 3, rowIndex: 7 };
    hero.setLocation('silesia', 'map-1');
    await nextTick();

    const saved = JSON.parse(readBlob(HERO_STORE_BLOB)!) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('heroCoordinates');
    expect(saved.nav).toMatchObject({ locationKey: 'silesia', locationMapId: 'map-1' });
    expect(readBlob(HERO_STORE_BLOB)).not.toContain(LEGACY_FIELD);
    expect(readBlob('nav')).not.toContain(LEGACY_FIELD);
  });
});

const FAKE_HERO: IHero = {
  id: 'hero-pos',
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
  origin: EDimension.NOWHERE,
};

describe('where the hero stands right after login', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchHeroMock.mockReset();
  });

  it('REQ-5: has no board position between getHero and the world projection, then stands where the server says', async () => {
    const { mapId, projected } = seedStandingIn('cave');
    const remembered = otherGround('cave', projected);
    const blobs = { [HERO_STORE_BLOB]: legacyHeroBlob('cave', { [mapId]: remembered }) };
    vi.spyOn(apiClient, 'get').mockImplementation((path: string) =>
      Promise.resolve(
        (path === '/expeditions/current'
          ? { expeditionId: 'exp-pos', blobs }
          : path === '/player/quest'
            ? { quest: null }
            : fakeWorldSnapshot()) as never,
      ),
    );
    fetchHeroMock.mockResolvedValue(FAKE_HERO);
    const hero = useHeroStore();
    const world = useWorldMapStore();

    expect(await hero.getHero()).toBe(true);

    expect(hero.nav.locationKey).toBe('cave');
    expect(world.currentMapId).toBeNull();
    expect(hero.heroCoordinates).toBeNull();

    world.bootstrapWorld();

    expect(world.currentMapId).toBe(mapId);
    expect(hero.heroCoordinates).toEqual(projected);
    expect(hero.heroCoordinates).not.toEqual(remembered);
  });
});
