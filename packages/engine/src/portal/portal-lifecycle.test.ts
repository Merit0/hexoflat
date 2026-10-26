import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/apply-command';
import { buildHero } from '../commands/command-test-context';
import { deserializeState, serializeState } from '../commands/snapshot';
import { CAMP_PORTAL_SPOT } from '../content/boards/camp-portal-spot';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import type { HeroState } from '../hero-movement/hero-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { closePortalOnTransition } from './portal-rules';
import type { PortalLink } from './portal-state';

import { enter, open, setup, tileAt } from './portal-test-setup';

describe('R4: pair lifetime', () => {
  it('R4 entering from the origin goes to the camping beside the camp spot and keeps the pair', () => {
    const s = setup();
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    const { events } = applyCommand(s.state, enter(s.hero.id), s.ctx);

    expect(events).toEqual([
      {
        type: 'PORTAL_ENTERED',
        payload: {
          heroId: s.hero.id,
          from: 'silesia',
          to: 'camping',
          toMapId: null,
          arrivalNear: CAMP_PORTAL_SPOT,
          portalHex: s.target,
        },
      },
    ]);
    expect(s.hero.portal).not.toBeNull();
  });

  it('R4 returning through the camp portal goes beside the origin portal and closes the pair', () => {
    const s = setup();
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    const link = s.hero.portal as PortalLink;

    const camp = setup({ location: 'camping' });
    camp.state.heroes = { [s.hero.id]: s.hero };
    camp.state.map = camp.state.map;
    const spot = tileAt(camp.state, CAMP_PORTAL_SPOT);
    spot.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.RETURN_PORTAL, CAMP_PORTAL_SPOT);
    s.hero.coordinates = getHexNeighbors(CAMP_PORTAL_SPOT).find((c) => {
      const t = tileAt(camp.state, c);
      return t.terrain === 'ground' && !t.hexobject;
    })!;
    camp.state.knowledge = s.state.knowledge;

    const { events } = applyCommand(camp.state, enter(s.hero.id), camp.ctx);

    expect(events.map((e) => e.type)).toEqual(['PORTAL_ENTERED', 'PORTAL_CLOSED']);
    expect(events[0]).toMatchObject({
      payload: { to: 'silesia', toMapId: 'map-1', arrivalNear: link.originHex },
    });
    expect(events[1]).toMatchObject({
      payload: {
        reason: 'RETURNED',
        remove: [
          { locationKey: 'silesia', mapId: 'map-1', hex: link.originHex },
          { locationKey: 'camping', mapId: null, hex: CAMP_PORTAL_SPOT },
        ],
      },
    });
    expect(s.hero.portal).toBeNull();
  });
});

describe('R4: other transitions close the pair', () => {
  it('R4 any other gate closes the pair', () => {
    const s = setup();
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    const link = s.hero.portal as PortalLink;

    const gateTile = s.state.map.tiles.find((t) => t.exit === 'N')!;
    s.hero.coordinates = { ...gateTile.coordinates };
    const { events } = applyCommand(
      s.state,
      { type: 'CROSS_EXIT', payload: { heroId: s.hero.id, from: 'silesia' } },
      s.ctx,
    );

    expect(events.map((e) => e.type)).toEqual(['BOARD_EXITED', 'PORTAL_CLOSED']);
    expect(events[1]).toMatchObject({ payload: { reason: 'OTHER_GATE' } });
    expect(events[1].payload).toMatchObject({
      remove: [{ locationKey: link.originLocationKey, hex: link.originHex }, expect.anything()],
    });
    expect(s.hero.portal).toBeNull();
  });

  it('R4 a homeland-gate ENTER action closes the pair', () => {
    const s = setup({ location: 'camping' });
    s.hero.portal = {
      originLocationKey: 'silesia',
      originMapId: 'map-1',
      originHex: { columnIndex: 2, rowIndex: 2 },
      campHex: { ...CAMP_PORTAL_SPOT },
    };
    const gate = s.state.map.tiles.find(
      (t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.HOMELAND_GATE,
    )!;

    const { events } = applyCommand(
      s.state,
      {
        type: 'START_HEX_ACTION',
        payload: {
          heroId: s.hero.id,
          coordinates: gate.coordinates,
          actionType: EHexActionType.ENTER,
          toolKey: HEXOBJECT_KEYS.HAND,
          now: 1,
        },
      },
      s.ctx,
    );

    expect(events.map((e) => e.type)).toEqual(['PORTAL_CLOSED', 'HEX_ACTION_STARTED']);
    expect(events[0]).toMatchObject({ payload: { reason: 'OTHER_GATE' } });
    expect(s.hero.portal).toBeNull();
  });

  it('R4 a world-gate ENTER action closes the pair; death closes it too; entering the pair does not', () => {
    const link: PortalLink = {
      originLocationKey: 'silesia',
      originMapId: 'map-1',
      originHex: { columnIndex: 2, rowIndex: 2 },
      campHex: { ...CAMP_PORTAL_SPOT },
    };
    const hero: HeroState = buildHero({ portal: link });

    expect(closePortalOnTransition(hero, { kind: 'GATE' })).toMatchObject({
      closes: true,
      reason: 'OTHER_GATE',
    });
    expect(closePortalOnTransition(hero, { kind: 'DEATH' })).toMatchObject({
      closes: true,
      reason: 'DEATH',
    });
    expect(closePortalOnTransition(hero, { kind: 'ENTER_PORTAL' })).toEqual({ closes: false });
    expect(closePortalOnTransition(buildHero(), { kind: 'GATE' })).toEqual({ closes: false });
  });
});

describe('R5: dungeon portals are one-way', () => {
  it('R5 a dungeon origin has no camp hex and PORTAL_OPENED says one-way', () => {
    const s = setup({ boardKind: 'DUNGEON' });
    const { events } = applyCommand(s.state, open(s.hero.id, s.target), s.ctx);

    expect(s.hero.portal?.campHex).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: 'PORTAL_OPENED', payload: { oneWay: true } });
  });

  it('R5 entering a one-way portal arrives in the camping with no camp hex', () => {
    const s = setup({ boardKind: 'DUNGEON' });
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    const { events } = applyCommand(s.state, enter(s.hero.id), s.ctx);

    expect(events[0]).toMatchObject({
      type: 'PORTAL_ENTERED',
      payload: { to: 'camping', arrivalNear: null },
    });
  });
});

describe('R10: portal ownership', () => {
  it('R10 another hero cannot enter a portal they do not own', () => {
    const s = setup();
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);
    const other = buildHero({
      id: 'hero-2',
      coordinates: getHexNeighbors(s.target).find(
        (c) => coordinateKey(c) !== coordinateKey(s.hero.coordinates),
      )!,
    });
    s.state.heroes[other.id] = other;

    const { events } = applyCommand(s.state, enter(other.id), s.ctx);

    expect(events).toEqual([
      { type: 'PORTAL_ENTER_REJECTED', payload: { heroId: 'hero-2', reason: 'NOT_YOUR_PORTAL' } },
    ]);
  });

  it('refuses entering when no portal is adjacent or in combat', () => {
    const s = setup();
    expect(applyCommand(s.state, enter(s.hero.id), s.ctx).events[0]).toMatchObject({
      payload: { reason: 'NO_PORTAL' },
    });
    const c = setup({ combat: true });
    expect(applyCommand(c.state, enter(c.hero.id), c.ctx).events[0]).toMatchObject({
      payload: { reason: 'IN_COMBAT' },
    });
  });
});

describe('R7: hero portal persistence', () => {
  it('R7 round-trips hero.portal through a snapshot', () => {
    const s = setup();
    applyCommand(s.state, open(s.hero.id, s.target), s.ctx);

    const restored = deserializeState(serializeState(s.state), 0);

    expect(restored.heroes[s.hero.id].portal).toEqual(s.hero.portal);
  });

  it('R7 an old save without the field loads with no portal', () => {
    const s = setup();
    delete s.hero.portal;

    const restored = deserializeState(serializeState(s.state), 0);

    expect(restored.heroes[s.hero.id].portal ?? null).toBeNull();
  });
});
