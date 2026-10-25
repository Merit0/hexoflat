import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { CAMP_PORTAL_SPOT } from '@hexoflat/engine/content/boards/camp-portal-spot';
import { createKnowledgeState } from '@hexoflat/engine/knowledge/state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey, getHexNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { writeKnowledge } from '@/services/persistence/knowledge-storage';
import { readLocationMapIndex, readSavedMap } from '@/services/persistence/world-storage';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { crossExitIfStanding } from './use-board-crossing';
import { usePortal } from './use-portal';

vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
}));

const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;
const PORTAL = HEXOBJECT_KEYS.RETURN_PORTAL;

function portalHexes(map: HexMapModel) {
  return map.tiles
    .filter((tile) => tile.hexobject?.hexobjectKey === PORTAL)
    .map((tile) => coordinateKey(tile.coordinates));
}

function storedPortalHexes(locationKey: 'camping' | 'silesia') {
  const mapId = readLocationMapIndex()[locationKey]!;
  const saved = readSavedMap(mapId)!;
  return saved.tiles.filter((tile) => tile.hexobject?.hexobjectKey === PORTAL).length;
}

describe('usePortal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  });

  function startInSilesia(will = 20, scrolls = 0) {
    const hero = useHeroStore();
    const world = useWorldMapStore();
    const inventory = useHeroInventoryStore();
    hero.hero.id = 'hero-1';
    const knowledge = createKnowledgeState('hero-1');
    knowledge.current = will;
    writeKnowledge(knowledge);
    hero.knowledge = knowledge;
    inventory.hydrate();
    if (scrolls) inventory.putToInventory(SCROLL, scrolls);

    world.goToLocation('silesia');
    const map = world.map as HexMapModel;
    const target = getHexNeighbors(hero.heroCoordinates!).find((c) => {
      const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(c));
      return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
    })!;
    return { hero, world, inventory, target, origin: { ...hero.heroCoordinates! } };
  }

  it('opens a portal: spends 5 Will, keeps the unlimited scrolls, places the portal, stores the link', async () => {
    const { hero, world, inventory, target } = startInSilesia(20, 2);
    const scrollsBefore = inventory.countItem(SCROLL);

    const outcome = await usePortal().openPortal(target);

    expect(outcome.ok).toBe(true);
    expect(hero.knowledge!.current).toBe(15);
    expect(inventory.countItem(SCROLL)).toBe(scrollsBefore);
    expect(portalHexes(world.map as HexMapModel)).toEqual([coordinateKey(target)]);
    expect(hero.portal).toMatchObject({
      originLocationKey: 'silesia',
      originHex: target,
      campHex: CAMP_PORTAL_SPOT,
    });
  });

  it('reports the engine refusal reason and changes nothing when Will is short', async () => {
    const { hero, world, inventory, target } = startInSilesia(4);

    const outcome = await usePortal().openPortal(target);

    expect(outcome).toEqual({ ok: false, reason: 'INSUFFICIENT_WILL' });
    expect(hero.knowledge!.current).toBe(4);
    expect(inventory.countItem(SCROLL)).toBeGreaterThan(0);
    expect(portalHexes(world.map as HexMapModel)).toEqual([]);
    expect(hero.portal).toBeNull();
  });

  it('previews the refusal in words for every R3 case the UI can hit', () => {
    const { target, inventory } = startInSilesia(20, 0);
    inventory.items = inventory.items.filter((item) => item.key !== SCROLL);

    expect(usePortal().previewOpen(target)).toEqual({ ok: false, reason: 'NO_SCROLL' });
  });

  it('walks the whole loop: origin -> camp portal -> back, both portals gone', async () => {
    const { hero, world, target } = startInSilesia();
    const portal = usePortal();
    await portal.openPortal(target);

    const there = await portal.enterPortal();

    expect(there.ok).toBe(true);
    expect(world.currentLocationKey).toBe('camping');
    expect(portalHexes(world.map as HexMapModel)).toEqual([coordinateKey(CAMP_PORTAL_SPOT)]);
    expect(hexDistance(hero.heroCoordinates!, CAMP_PORTAL_SPOT)).toBe(1);
    expect(hero.portal).not.toBeNull();

    const back = await portal.enterPortal();

    expect(back.ok).toBe(true);
    expect(world.currentLocationKey).toBe('silesia');
    expect(hexDistance(hero.heroCoordinates!, target)).toBe(1);
    expect(hero.portal).toBeNull();
    expect(portalHexes(world.map as HexMapModel)).toEqual([]);
    expect(storedPortalHexes('camping')).toBe(0);
  });

  it('puts the camp portal on the nearest free hex when the camp spot is taken', async () => {
    const { hero, world, target, origin } = startInSilesia();
    const portal = usePortal();
    await portal.openPortal(target);
    world.goToLocation('camping');
    const camp = world.map as HexMapModel;
    const spotTile = camp.tiles.find(
      (t) => coordinateKey(t.coordinates) === coordinateKey(CAMP_PORTAL_SPOT),
    )!;
    spotTile.hexobject = {
      ...camp.tiles.find((t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.COINS)!.hexobject!,
    };
    world.goToLocation('silesia');
    hero.heroCoordinates = { ...origin };

    await portal.enterPortal();

    const campHex = hero.portal!.campHex!;
    expect(coordinateKey(campHex)).not.toBe(coordinateKey(CAMP_PORTAL_SPOT));
    expect(hexDistance(campHex, CAMP_PORTAL_SPOT)).toBe(1);
    expect(portalHexes(world.map as HexMapModel)).toEqual([coordinateKey(campHex)]);
  });

  it('closes the pair on death and removes the stored origin portal', async () => {
    const { hero, world, target } = startInSilesia();
    const portal = usePortal();
    await portal.openPortal(target);
    await portal.enterPortal();

    hero.closePortalOnDeath();

    expect(hero.portal).toBeNull();
    expect(portalHexes(world.map as HexMapModel)).toEqual([]);
    expect(storedPortalHexes('silesia')).toBe(0);
  });

  it('another transition (crossing an atlas exit) closes the pair and removes the origin portal', async () => {
    const { hero, world, target } = startInSilesia();
    await usePortal().openPortal(target);
    const exit = (world.map as HexMapModel).tiles.find((tile) => tile.exit === 'N')!;
    hero.heroCoordinates = { ...exit.coordinates };

    const crossed = await crossExitIfStanding();

    expect(crossed).toBe(true);
    expect(hero.portal).toBeNull();
    expect(storedPortalHexes('silesia')).toBe(0);
  });

  it('a dungeon origin is one-way: no camp hex and no camp portal on arrival', async () => {
    const hero = useHeroStore();
    const world = useWorldMapStore();
    const inventory = useHeroInventoryStore();
    hero.hero.id = 'hero-1';
    const knowledge = createKnowledgeState('hero-1');
    knowledge.current = 20;
    writeKnowledge(knowledge);
    hero.knowledge = knowledge;
    inventory.hydrate();
    inventory.putToInventory(SCROLL, 1);
    expect(MapRegistry.get('cave').boardKind).toBe('DUNGEON');
    world.goToLocation('cave');
    const map = world.map as HexMapModel;
    const target = getHexNeighbors(hero.heroCoordinates!).find((c) => {
      const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(c));
      return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
    })!;
    const portal = usePortal();

    expect(portal.previewOpen(target)).toMatchObject({ ok: true, oneWay: true });
    await portal.openPortal(target);
    expect(hero.portal!.campHex).toBeNull();

    await portal.enterPortal();

    expect(world.currentLocationKey).toBe('camping');
    expect(portalHexes(world.map as HexMapModel)).toEqual([]);
  });
});
