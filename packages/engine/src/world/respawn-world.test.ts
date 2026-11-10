import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { grantToDraft } from '../inventory/apply-stock';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { LocationKey } from '../registry/location-key';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { openPortalWorld } from './portal-world';
import { respawnWorld } from './respawn-world';
import { createServerWorld, type ServerWorld } from './server-world';
import type { TravelRun } from './travel';

const HERO = 'hero-1';

function scrolls() {
  const draft = { current: emptyInventoryState(HERO), events: [] as never[] };
  grantToDraft(draft, HEXOBJECT_KEYS.RETURN_SCROLL, 2, 'dev');
  return draft.current;
}

function runIn(world: ServerWorld, camp: ServerWorld | null): TravelRun {
  const progress = emptyProgressState(HERO);
  progress.knowledge.skills = { a_crest: 1, a_teleport: 6 };
  progress.health.current = 0;
  return {
    world,
    progress,
    inventory: scrolls(),
    heroId: HERO,
    now: 5_000,
    loadStored: (key: LocationKey) => (key === 'camping' ? camp : null),
    loadById: () => null,
    create: (key: LocationKey) => createServerWorld(key, `fresh-${key}`, 'seed', HERO),
  };
}

function freeBeside(world: ServerWorld) {
  return getHexNeighbors(world.heroCoordinates!).find((hex) => {
    const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(hex));
    return !!tile && tile.terrain === 'ground' && !tile.hexobject && !tile.exit;
  })!;
}

describe('REQ-SRV-RSP-001 a defeated hero is respawned in the camp by the server', () => {
  it('closes the open portal, brings a fresh dungeon, puts the hero in the camp with one heart', () => {
    const cave = createServerWorld('cave', 'cave-1', 'seed', HERO);
    const camp = createServerWorld('camping', 'camp-1', 'seed', HERO);
    const run = runIn(cave, camp);
    const opened = openPortalWorld(run, freeBeside(cave));
    if (!opened.ok) throw new Error(opened.code);
    run.progress = opened.progress;
    run.inventory = opened.inventory;
    expect(run.progress.portal).not.toBeNull();
    cave.battle = null;

    const out = respawnWorld(run);
    if (!out.ok) throw new Error(out.code);
    expect(out.progress.portal).toBeNull();
    expect(out.events.map((event) => event.type)).toEqual(['PORTAL_CLOSED', 'HERO_RESPAWNED']);
    expect(out.replaced?.locationKey).toBe('cave');
    expect(out.replaced?.mapId).not.toBe('cave-1');
    expect(out.destination.locationKey).toBe('camping');
    expect(out.progress.presence).toMatchObject({ locationKey: 'camping', mapId: 'camp-1' });
    expect(out.progress.health.current).toBe(1);
    expect(out.origin.battle).toBeNull();
    expect(out.origin.engagement).toBeNull();
  });

  it('keeps a static location as it is and leaves the Will, skills and sealing alone', () => {
    const silesia = createServerWorld('silesia', 'silesia-1', 'seed', HERO);
    const camp = createServerWorld('camping', 'camp-1', 'seed', HERO);
    const run = runIn(silesia, camp);
    run.progress.sealedUntil = { cave: 99_999 };
    const will = run.progress.knowledge.current;
    const out = respawnWorld(run);
    if (!out.ok) throw new Error(out.code);
    expect(out.replaced).toBeNull();
    expect(out.progress.sealedUntil).toEqual({ cave: 99_999 });
    expect(out.progress.knowledge.current).toBe(will);
    expect(out.progress.knowledge.skills).toEqual({ a_crest: 1, a_teleport: 6 });
    expect(out.events.map((event) => event.type)).toEqual(['HERO_RESPAWNED']);
  });

  it('builds the camp when none is stored yet', () => {
    const cave = createServerWorld('cave', 'cave-1', 'seed', HERO);
    const out = respawnWorld(runIn(cave, null));
    if (!out.ok) throw new Error(out.code);
    expect(out.destination.locationKey).toBe('camping');
    expect(out.progress.presence?.locationKey).toBe('camping');
  });

  it('does not move anyone from the camp to a copy of the camp', () => {
    const camp = createServerWorld('camping', 'camp-1', 'seed', HERO);
    const out = respawnWorld(runIn(camp, camp));
    if (!out.ok) throw new Error(out.code);
    expect(out.destination).toBe(camp);
    expect(out.replaced).toBeNull();
  });
});
