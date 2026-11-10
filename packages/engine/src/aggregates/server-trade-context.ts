import { standsNextToCampObject } from '../content/boards/camp-object-spot';
import { TRADERS, TRADER_KEYS } from '../content/traders.content';
import type { TradeContext } from './apply-trade-command';
import type { Presence } from './progress-state';

export function serverTradeContext(presence: Presence | null, rngSeed: string): TradeContext {
  const atTrader =
    TRADER_KEYS.find((key) => standsNextToCampObject(presence, TRADERS[key].stallHexobjectKey)) ??
    null;
  return { atTrader, rngSeed };
}
