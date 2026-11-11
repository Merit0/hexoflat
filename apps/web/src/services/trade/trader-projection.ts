import { shallowRef } from 'vue';
import type { TTraderKey } from '@hexoflat/engine/content/traders.content';
import { emptyListings, type Listings } from '@hexoflat/engine/trade/listing-state';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';

export interface TraderProjection {
  traders: Partial<Record<TTraderKey, TraderState>>;
  trips: number;
  listings: Listings;
}

const EMPTY: TraderProjection = { traders: {}, trips: 0, listings: emptyListings() };

export const traderProjection = shallowRef<TraderProjection>(EMPTY);

export function applyTraderProjection(progress: {
  traders?: Partial<Record<TTraderKey, TraderState>>;
  trips?: number;
  listings?: Listings;
}): void {
  traderProjection.value = {
    traders: progress.traders ?? {},
    trips: progress.trips ?? 0,
    listings: progress.listings ?? emptyListings(),
  };
}

export function resetTraderProjection(): void {
  traderProjection.value = EMPTY;
}
