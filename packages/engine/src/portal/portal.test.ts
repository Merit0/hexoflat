import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/apply-command';
import { buildHero } from '../commands/command-test-context';
import { CAMP_PORTAL_SPOT } from '../content/boards/camp-portal-spot';
import { getMeta } from '../content';
import { HexObjectFactory } from '../factory/hex-object-factory';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;

import { enter, open, setup, tileAt } from './portal-test-setup';

describe('R3: OPEN_PORTAL refusals', () => {
  function expectRefused(
    s: ReturnType<typeof setup>,
    target: IHexCoordinates,
    reason: string,
    command = open(s.hero.id, target),
  ) {
    const willBefore = s.state.knowledge!.current;
    const portalBefore = s.hero.portal;
    const { events } = applyCommand(s.state, command, s.ctx);
    expect(events).toEqual([
      { type: 'PORTAL_OPEN_REJECTED', payload: { heroId: s.hero.id, target, reason } },
    ]);
    expect(s.state.knowledge!.current).toBe(willBefore);
    expect(s.scrolls()).toBe(1);
    expect(s.hero.portal).toBe(portalBefore);
    const tile = s.state.map.tiles.find(
      (t) => coordinateKey(t.coordinates) === coordinateKey(target),
    );
    expect(tile?.hexobject?.hexobjectKey).not.toBe(HEXOBJECT_KEYS.RETURN_PORTAL);
  }

  it('R3 refuses a target that is not adjacent', () => {
    const s = setup();
    const far = {
      columnIndex: s.hero.coordinates.columnIndex + 3,
      rowIndex: s.hero.coordinates.rowIndex,
    };
    expectRefused(s, far, 'NOT_ADJACENT');
  });

  it('R3 refuses a missing tile', () => {
    const s = setup();
    s.hero.coordinates = { columnIndex: 0, rowIndex: 0 };
    const off = getHexNeighbors(s.hero.coordinates).find(
      (c) => !s.state.map.tiles.some((t) => coordinateKey(t.coordinates) === coordinateKey(c)),
    )!;
    expectRefused(s, off, 'NO_TILE');
  });

  it('R3 refuses non-ground terrain', () => {
    const s = setup();
    tileAt(s.state, s.target).terrain = 'water';
    expectRefused(s, s.target, 'NOT_GROUND');
  });

  it('R3 refuses a hex that already holds an object', () => {
    const s = setup();
    tileAt(s.state, s.target).hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, s.target);
    expectRefused(s, s.target, 'TILE_OCCUPIED');
  });

  it('R3 refuses a hex occupied by another hero', () => {
    const s = setup();
    s.state.heroes['hero-2'] = buildHero({ id: 'hero-2', coordinates: { ...s.target } });
    expectRefused(s, s.target, 'TILE_OCCUPIED');
  });

  it('R3 refuses an exit hex', () => {
    const s = setup();
    tileAt(s.state, s.target).exit = 'N';
    expectRefused(s, s.target, 'EXIT_HEX');
  });

  it('R3 refuses in the camping', () => {
    const s = setup({ location: 'camping' });
    expectRefused(s, s.target, 'IN_CAMPING');
  });

  it('R3 refuses in combat', () => {
    const s = setup({ combat: true });
    expectRefused(s, s.target, 'IN_COMBAT');
  });

  it('R3 refuses when the hero already has a portal', () => {
    const s = setup();
    s.hero.portal = {
      originLocationKey: 'silesia',
      originMapId: 'map-1',
      originHex: { columnIndex: 1, rowIndex: 1 },
      campHex: { ...CAMP_PORTAL_SPOT },
    };
    expectRefused(s, s.target, 'PORTAL_ALREADY_OPEN');
  });

  it('R3 refuses without a return scroll', () => {
    const s = setup({ scrolls: 0 });
    const { events } = applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    expect(events).toEqual([
      {
        type: 'PORTAL_OPEN_REJECTED',
        payload: { heroId: s.hero.id, target: s.target, reason: 'NO_SCROLL' },
      },
    ]);
    expect(s.hero.portal).toBeNull();
  });

  it('R3 refuses an unknown hero and a missing location', () => {
    const s = setup();
    expect(applyCommand(s.state, open('ghost', s.target), s.ctx).events[0]).toMatchObject({
      payload: { reason: 'HERO_NOT_FOUND' },
    });
    delete s.state.location;
    expect(applyCommand(s.state, open(s.hero.id, s.target), s.ctx).events[0]).toMatchObject({
      payload: { reason: 'NO_LOCATION' },
    });
  });
});

describe('R2: portal cost', () => {
  it('R2 prices opening at 5 Will from content and entering at 0', () => {
    expect(getMeta(SCROLL).actions?.USE?.willCost).toBe(5);
    expect(getMeta(HEXOBJECT_KEYS.RETURN_PORTAL).actions?.ENTER?.willCost).toBe(0);
  });

  it('R2 spends 5 Will and one scroll atomically and places the portal', () => {
    const s = setup({ will: 20 });
    const { events } = applyCommand(s.state, open(s.hero.id, s.target), s.ctx);

    expect(s.state.knowledge!.current).toBe(15);
    expect(s.scrolls()).toBe(0);
    expect(tileAt(s.state, s.target).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.RETURN_PORTAL);
    expect(s.hero.portal).toEqual({
      originLocationKey: 'silesia',
      originMapId: 'map-1',
      originHex: s.target,
      campHex: CAMP_PORTAL_SPOT,
    });
    expect(events.map((e) => e.type)).toEqual(['WILL_SPENT', 'PORTAL_OPENED']);
    expect(events[0]).toMatchObject({ payload: { amount: 5, balanceAfter: 15 } });
  });

  it('R2 insufficient Will rejects and changes nothing', () => {
    const s = setup({ will: 4 });
    const { events } = applyCommand(s.state, open(s.hero.id, s.target), s.ctx);

    expect(events.map((e) => e.type)).toEqual(['WILL_REJECTED', 'PORTAL_OPEN_REJECTED']);
    expect(events[0]).toMatchObject({ payload: { reason: 'INSUFFICIENT_WILL' } });
    expect(s.state.knowledge!.current).toBe(4);
    expect(s.scrolls()).toBe(1);
    expect(s.hero.portal).toBeNull();
    expect(tileAt(s.state, s.target).hexobject).toBeNull();
  });

  it('R2 entering a portal costs no Will', () => {
    const s = setup({ will: 20 });
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    const before = s.state.knowledge!.current;
    const { events } = applyCommand(s.state, enter(s.hero.id), s.ctx);

    expect(events.map((e) => e.type)).toEqual(['PORTAL_ENTERED']);
    expect(s.state.knowledge!.current).toBe(before);
  });
});
