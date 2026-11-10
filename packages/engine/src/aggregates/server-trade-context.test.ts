import { describe, expect, it } from 'vitest';
import { campObjectSpots } from '../content/boards/camp-object-spot';
import { TRADER_KEYS } from '../content/traders.content';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { traderView } from '../trade/trader-view';
import { getHexNeighbors } from '../utils/hex-utils';
import { AGGREGATES, emptyProgressState, serverTradeContext, type Presence } from './index';

const HERO = 'hero-1';
const SEED = 'server-seed';
const [STALL] = campObjectSpots(HEXOBJECT_KEYS.TRADER_STALL);
const inCamp = (coordinates: Presence['coordinates']): Presence => ({
  locationKey: 'camping',
  mapId: 'camping-1',
  coordinates,
});

describe('serverTradeContext', () => {
  it('names the trader on every one of the six hexes around the stall', () => {
    for (const hex of getHexNeighbors(STALL)) {
      expect(serverTradeContext(inCamp(hex), SEED)).toEqual({ atTrader: 'ilva', rngSeed: SEED });
    }
  });

  it('names no trader on the stall hex, two hexes away, in another location or with no place', () => {
    const away = { columnIndex: STALL.columnIndex + 2, rowIndex: STALL.rowIndex };
    const elsewhere: Presence = { ...inCamp(getHexNeighbors(STALL)[0]), locationKey: 'cave' };
    for (const presence of [inCamp(STALL), inCamp(away), elsewhere, null]) {
      expect(serverTradeContext(presence, SEED).atTrader).toBeNull();
    }
  });
});

describe('progress projection for the client', () => {
  it('fills every untouched trader with its serial 0 goods and keeps a stored one as it is', () => {
    const progress = emptyProgressState(HERO);
    const projected = AGGREGATES.progress.project(progress, { rngSeed: SEED }) as typeof progress;
    expect(Object.keys(projected.traders)).toEqual([...TRADER_KEYS]);
    expect(projected.traders.ilva).toEqual(traderView(progress, 'ilva', SEED));
    expect(progress.traders).toEqual({});

    const stored = { ...traderView(progress, 'ilva', 'other-seed'), serial: 4 };
    const held = { ...progress, traders: { ilva: stored } };
    const again = AGGREGATES.progress.project(held, { rngSeed: SEED }) as typeof progress;
    expect(again.traders.ilva).toEqual(stored);
  });

  it('never puts the seed into the projection and refuses to project without one', () => {
    const progress = emptyProgressState(HERO);
    expect(JSON.stringify(AGGREGATES.progress.project(progress, { rngSeed: SEED }))).not.toContain(
      SEED,
    );
    expect(() => AGGREGATES.progress.project(progress, {})).toThrow(/rngSeed/);
  });
});
