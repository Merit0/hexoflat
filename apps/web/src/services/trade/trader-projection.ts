import { shallowRef } from 'vue';
import type { TTraderKey } from '@hexoflat/engine/content/traders.content';
import { emptyListings, type Listings } from '@hexoflat/engine/trade/listing-state';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';
import type { UniqueBuyback } from '@hexoflat/engine/trade/unique-buyback';

export interface TraderProjection {
  traders: Partial<Record<TTraderKey, TraderState>>;
  trips: number;
  listings: Listings;
  uniqueBuyback: UniqueBuyback;
}

const EMPTY: TraderProjection = {
  traders: {},
  trips: 0,
  listings: emptyListings(),
  uniqueBuyback: {},
};

export const traderProjection = shallowRef<TraderProjection>(EMPTY);

export function applyTraderProjection(progress: {
  traders?: Partial<Record<TTraderKey, TraderState>>;
  trips?: number;
  listings?: Listings;
  uniqueBuyback?: UniqueBuyback;
}): void {
  traderProjection.value = {
    traders: progress.traders ?? {},
    trips: progress.trips ?? 0,
    listings: progress.listings ?? emptyListings(),
    uniqueBuyback: progress.uniqueBuyback ?? {},
  };
}

export function resetTraderProjection(): void {
  traderProjection.value = EMPTY;
}
