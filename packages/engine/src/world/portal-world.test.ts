import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { toAggregate } from '../inventory/inventory-adapter';
import { grantToDraft } from '../inventory/apply-stock';
import { emptyInventoryState } from '../inventory/inventory-state';
import { countItem } from '../inventory/plan-stock';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { LocationKey } from '../registry/location-key';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import {
  closePortalWorld,
  enterPortalWorld,
  openPortalWorld,
  type PortalRun,
} from './portal-world';
import { createServerWorld, type ServerWorld } from './server-world';
import { travelWorld } from './travel';
import type { WorldRun } from './world-commands';

const HERO = 'hero-1';

function withScroll() {
  const inventory = emptyInventoryState(HERO);
  const draft = { current: inventory, events: [] as never[] };
  grantToDraft(draft, HEXOBJECT_KEYS.RETURN_SCROLL, 2, 'dev');
  return draft.current;
}

function baseRun(world: ServerWorld): WorldRun {
  const progress = emptyProgressState(HERO);
  progress.knowledge.skills = { a_crest: 1, a_teleport: 6 };
  return { world, progress, inventory: withScroll(), heroId: HERO, now: 1_000 };
}

function finders(known: ServerWorld[]) {
  return {
    loadStored: (key: LocationKey) => known.find((w) => w.locationKey === key) ?? null,
    loadById: (id: string) => known.find((w) => w.mapId === id) ?? null,
    create: (key: LocationKey) => createServerWorld(key, `fresh-${key}`, 'seed', HERO),
  };
}

function freeBeside(world: ServerWorld) {
  return getHexNeighbors(world.heroCoordinates!).find((hex) => {
    const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(hex));
    return !!tile && tile.terrain === 'ground' && !tile.hexobject && !tile.exit;
  })!;
}

function portalHexes(world: ServerWorld) {
  return world.map.tiles
    .filter((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.RETURN_PORTAL)
    .map((tile) => coordinateKey(tile.coordinates));
}

describe('a portal on the server', () => {
  it('opens beside the hero: a scroll and the Will go, the link is kept in the progress', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const target = freeBeside(silesia);
    const opened = openPortalWorld(baseRun(silesia), target);
    if (!opened.ok) throw new Error(opened.code);
    expect(portalHexes(opened.world)).toEqual([coordinateKey(target)]);
    expect(opened.progress.portal).toMatchObject({
      originLocationKey: 'silesia',
      originMapId: 'silesia-1',
    });
    expect(countItem(toAggregate(opened.inventory), HEXOBJECT_KEYS.RETURN_SCROLL)).toBe(1);
    expect(opened.progress.knowledge.current).toBe(45);
    expect(opened.tileDiffs.length).toBeGreaterThan(0);
  });

  it('refuses without the skill, without a scroll, in the camp and with a portal already open', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const target = freeBeside(silesia);
    const noSkill = baseRun(silesia);
    noSkill.progress.knowledge.skills = {};
    expect(openPortalWorld(noSkill, target)).toMatchObject({ ok: false, code: 'NOT_AN_ANGEL' });
    const noScroll = { ...baseRun(silesia), inventory: emptyInventoryState(HERO) };
    expect(openPortalWorld(noScroll, target)).toMatchObject({ ok: false, code: 'NO_SCROLL' });
    const camp = createServerWorld('camping', 'camp-1', 'seed', HERO);
    expect(openPortalWorld(baseRun(camp), freeBeside(camp))).toMatchObject({
      ok: false,
      code: 'IN_CAMPING',
    });
    const opened = openPortalWorld(baseRun(silesia), target);
    if (!opened.ok) throw new Error(opened.code);
    const again = {
      ...baseRun(opened.world),
      progress: opened.progress,
      inventory: opened.inventory,
    };
    expect(openPortalWorld(again, freeBeside(opened.world))).toMatchObject({
      ok: false,
      code: 'PORTAL_ALREADY_OPEN',
    });
  });

  it('takes the hero to the camp, puts the camp portal beside him, and back again closes both', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const camp = createServerWorld('camping', 'camp-1', 'seed', HERO);
    const target = freeBeside(silesia);
    const opened = openPortalWorld(baseRun(silesia), target);
    if (!opened.ok) throw new Error(opened.code);
    silesia.heroCoordinates = { ...opened.world.heroCoordinates! };

    const run: PortalRun = {
      ...baseRun(silesia),
      progress: opened.progress,
      inventory: opened.inventory,
      ...finders([silesia, camp]),
    };
    const there = enterPortalWorld(run);
    if (!there.ok) throw new Error(there.code);
    expect(there.destination.locationKey).toBe('camping');
    expect(portalHexes(there.destination)).toHaveLength(1);
    expect(there.progress.portal?.campHex).not.toBeNull();
    expect(there.progress.presence).toMatchObject({ locationKey: 'camping' });

    const back = enterPortalWorld({
      ...baseRun(there.destination),
      progress: there.progress,
      ...finders([silesia, there.destination]),
    });
    if (!back.ok) throw new Error(back.code);
    expect(back.destination.mapId).toBe('silesia-1');
    expect(back.progress.portal).toBeNull();
    expect(portalHexes(back.destination)).toEqual([]);
    expect(portalHexes(there.destination)).toEqual([]);
  });

  it('refuses to enter far from a portal or without one', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const run: PortalRun = { ...baseRun(silesia), ...finders([silesia]) };
    expect(enterPortalWorld(run)).toMatchObject({ ok: false, code: 'NO_PORTAL' });
  });
});

describe('a portal closed on the server', () => {
  it('is closed by crossing a board edge, which removes the portal hex it left behind', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const target = freeBeside(silesia);
    const opened = openPortalWorld(baseRun(silesia), target);
    if (!opened.ok) throw new Error(opened.code);
    const exit = silesia.map.tiles.find((tile) => tile.exit)!;
    silesia.heroCoordinates = { ...exit.coordinates };
    const crossed = travelWorld(
      { ...baseRun(silesia), progress: opened.progress, ...finders([]) },
      { kind: 'exit' },
    );
    if (!crossed.ok) throw new Error(crossed.code);
    expect(crossed.progress.portal).toBeNull();
    expect(portalHexes(silesia)).toEqual([]);
    expect(crossed.events.map((e) => e.type)).toContain('PORTAL_CLOSED');
  });

  it('is closed on death, wherever the other end was, and does nothing without a portal', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const camp = createServerWorld('camping', 'camp-1', 'seed', HERO);
    const opened = openPortalWorld(baseRun(silesia), freeBeside(silesia));
    if (!opened.ok) throw new Error(opened.code);
    const there = enterPortalWorld({
      ...baseRun(silesia),
      progress: opened.progress,
      inventory: opened.inventory,
      ...finders([silesia, camp]),
    });
    if (!there.ok) throw new Error(there.code);
    const dead = closePortalWorld({
      ...baseRun(there.destination),
      progress: there.progress,
      ...finders([silesia]),
    });
    if (!dead.ok) throw new Error(dead.code);
    expect(dead.progress.portal).toBeNull();
    expect(portalHexes(silesia)).toEqual([]);
    expect(portalHexes(dead.world)).toEqual([]);
    expect(dead.touched?.map((w) => w.mapId)).toEqual(['silesia-1']);
    expect(closePortalWorld({ ...baseRun(silesia), ...finders([]) })).toMatchObject({
      ok: false,
      code: 'NO_PORTAL',
    });
  });
});
