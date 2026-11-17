import { describe, expect, it } from 'vitest';
import {
  MAP_BOUND_WORLD_COMMANDS,
  WORLD_COMMAND_SCHEMAS,
  type TWorldCommandType,
} from '../aggregates/world-player-commands';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { MAP_MISMATCH, mapRefusal } from './map-guard';

const HERO = 'hero-1';
const MAP = 'map-a';
const hex = { columnIndex: 2, rowIndex: 3 };

const payloads: Record<(typeof MAP_BOUND_WORLD_COMMANDS)[number], Record<string, unknown>> = {
  WORLD_STEP: { target: hex },
  WORLD_ACTION: {
    coordinates: hex,
    actionType: EHexActionType.TAKE,
    toolKey: HEXOBJECT_KEYS.HAND,
  },
  WORLD_TICK: {},
  WORLD_TRAVEL: { via: { kind: 'exit' } },
  WORLD_PORTAL_OPEN: { target: hex },
  WORLD_PORTAL_ENTER: {},
  WORLD_PORTAL_CLOSE: {},
};

const parse = (type: TWorldCommandType, payload: Record<string, unknown>) =>
  WORLD_COMMAND_SCHEMAS[type].safeParse({ type, payload: { heroId: HERO, ...payload } }).success;

describe('world commands name the map they expect (MAPFIX-2)', () => {
  it.each(MAP_BOUND_WORLD_COMMANDS)(
    'REQ-1: %s is refused by the schema without expectedMapId',
    (type) => {
      expect(parse(type, payloads[type])).toBe(false);
      expect(parse(type, { ...payloads[type], expectedMapId: MAP })).toBe(true);
    },
  );

  it.each(MAP_BOUND_WORLD_COMMANDS)('REQ-1: %s is refused with an empty expectedMapId', (type) => {
    expect(parse(type, { ...payloads[type], expectedMapId: '' })).toBe(false);
  });

  it('leaves WORLD_ENTER and WORLD_BATTLE as they were: no expectedMapId accepted', () => {
    expect(parse('WORLD_ENTER', { locationKey: 'camping' })).toBe(true);
    expect(parse('WORLD_ENTER', { locationKey: 'camping', expectedMapId: MAP })).toBe(false);
    expect(parse('WORLD_BATTLE', { kind: 'sync' })).toBe(true);
    expect(parse('WORLD_BATTLE', { kind: 'sync', expectedMapId: MAP })).toBe(false);
  });

  it('refuses a command for another map than the one the hero stands on', () => {
    const presence = { mapId: MAP };
    expect(mapRefusal(presence, { payload: { heroId: HERO, expectedMapId: MAP } })).toBeNull();
    expect(mapRefusal(presence, { payload: { heroId: HERO, expectedMapId: 'map-b' } })).toBe(
      MAP_MISMATCH,
    );
  });

  it('leaves commands without a map and heroes without a place to the other checks', () => {
    expect(mapRefusal({ mapId: MAP }, { payload: { heroId: HERO, locationKey: 'camping' } })).toBe(
      null,
    );
    expect(mapRefusal(null, { payload: { heroId: HERO, expectedMapId: MAP } })).toBeNull();
    expect(mapRefusal(undefined, { payload: { heroId: HERO, expectedMapId: MAP } })).toBeNull();
  });
});
