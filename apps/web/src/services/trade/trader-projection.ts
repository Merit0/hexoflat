import { shallowRef } from 'vue';
import type { TTraderKey } from '@hexoflat/engine/content/traders.content';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';

export interface TraderProjection {
  traders: Partial<Record<TTraderKey, TraderState>>;
  trips: number;
}

const EMPTY: TraderProjection = { traders: {}, trips: 0 };

export const traderProjection = shallowRef<TraderProjection>(EMPTY);

export function applyTraderProjection(progress: {
  traders?: Partial<Record<TTraderKey, TraderState>>;
  trips?: number;
}): void {
  traderProjection.value = { traders: progress.traders ?? {}, trips: progress.trips ?? 0 };
}

export function resetTraderProjection(): void {
  traderProjection.value = EMPTY;
}
