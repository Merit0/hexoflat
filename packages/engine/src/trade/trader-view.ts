import { CONTENT } from '../content/content-map';
import { realmOfBoard } from '../registry/location-token-origin';
import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import type { TTraderDefinition } from '../content/content-schema';
import { TRADERS, TRADER_KEYS, type TTraderKey } from '../content/traders.content';
import type { InventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { sha256Hex } from '../utils/hash/sha256';
import { deriveStream } from '../utils/random-seeded';
import type { ProgressState } from '../aggregates/progress-state';
import { applyDiscounts } from './discount-math';
import { sellPriceOf } from './price-of';
import { emptyBuyback, rollGoods } from './roll-goods';
import type { TraderGood, TraderState } from './trade-state';
import { type TokenOrigin } from '../tokens/token-origin';
import { isTokenType, mintBaseToken, tokenSourceIdOf, type TokenMint } from '../tokens/game-tokens';
import type { ItemToken } from '../tokens/token-schema';

export function goodsStreamLabel(trader: TTraderKey, serial: number): string {
  return `trader:${trader}:${serial}`;
}

function withSlotToken<E extends { key: string; amount: number; token?: ItemToken }>(
  entry: E | null,
  mint: TokenMint,
): E | null {
  if (!entry || entry.token || entry.amount !== 1 || !isTokenType(entry.key)) return entry;
  return { ...entry, token: mintBaseToken(mint, entry.key, 0) };
}

function shopNamespace(rngSeed: string): string {
  return sha256Hex(`shop-namespace:${rngSeed}`).slice(0, 32);
}

interface SlotMintBase {
  rngSeed: string;
  namespace: string;
  key: TTraderKey;
  serial: number;
  origin: TokenOrigin;
}

function slotMint(base: SlotMintBase, slot: string): TokenMint {
  return {
    seed: base.rngSeed,
    sourceId: tokenSourceIdOf('shop', base.namespace, base.key, String(base.serial), slot),
    origin: base.origin,
  };
}

function slotMintBase(
  def: TTraderDefinition,
  rngSeed: string,
  key: TTraderKey,
  serial: number,
): SlotMintBase {
  return {
    rngSeed,
    namespace: shopNamespace(rngSeed),
    key,
    serial,
    origin: def.tokenOrigin ?? { realm: realmOfBoard(CONTENT[def.stallHexobjectKey]), mapTier: 1 },
  };
}

function withTraderTokens(state: TraderState, rngSeed: string, key: TTraderKey): TraderState {
  const def: TTraderDefinition = TRADERS[key];
  const base = slotMintBase(def, rngSeed, key, state.serial);
  const goods = state.goods.map((good, index) => withSlotToken(good, slotMint(base, `g${index}`)));
  const buyback = state.buyback.map((entry, index) =>
    withSlotToken(entry, slotMint(base, `b${index}`)),
  );
  const same =
    goods.every((good, i) => good === state.goods[i]) &&
    buyback.every((entry, i) => entry === state.buyback[i]);
  return same ? state : { ...state, goods, buyback };
}

export function rollTraderGoods(
  def: TTraderDefinition,
  rngSeed: string,
  key: TTraderKey,
  serial: number,
): (TraderGood | null)[] {
  const label = goodsStreamLabel(key, serial);
  const base = slotMintBase(def, rngSeed, key, serial);
  const goods = rollGoods(def, deriveStream(rngSeed, label)).map((good, index) =>
    withSlotToken(good, slotMint(base, `g${index}`)),
  );
  return applyDiscounts(def, goods, deriveStream(rngSeed, `${label}:deals`));
}

export function traderView(
  progress: Pick<ProgressState, 'traders' | 'trips'>,
  key: TTraderKey,
  rngSeed: string,
): TraderState {
  const stored = progress.traders[key];
  if (stored) return withTraderTokens(stored, rngSeed, key);
  const def = TRADERS[key];
  return {
    serial: 0,
    trip: progress.trips,
    paidRefreshes: 0,
    goods: rollTraderGoods(def, rngSeed, key, 0),
    buyback: emptyBuyback(def),
  };
}

export function sellUnitPrice(def: TTraderDefinition, key: THexobjectKey): number | null {
  return sellPriceOf(def, { key });
}

export function refreshPrice(state: TraderState, trips: number, def: TTraderDefinition): number {
  const paid = state.trip === trips ? state.paidRefreshes : 0;
  return def.refresh.baseWill * def.refresh.factor ** paid;
}

export function walletCoins(inventory: Pick<InventoryState, 'bag' | 'equip'>): number {
  const held = [...inventory.bag, ...EQUIP_SLOTS.map((slot) => inventory.equip[slot])];
  return held.reduce(
    (sum, item) => (item?.key === HEXOBJECT_KEYS.COINS ? sum + item.amount : sum),
    0,
  );
}

export function tradersForClient(
  progress: Pick<ProgressState, 'traders' | 'trips'>,
  rngSeed: string,
): Record<TTraderKey, TraderState> {
  return Object.fromEntries(
    TRADER_KEYS.map((key) => [key, traderView(progress, key, rngSeed)]),
  ) as Record<TTraderKey, TraderState>;
}
