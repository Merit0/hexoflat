import { UPDATE_PRIORITY, type Ticker } from 'pixi.js';

export type TickerCallback = (ticker: Ticker) => void;

export interface TickerSubscriptionOptions {
  source: string;
  priority?: number;
  once?: boolean;
  onFailure?: () => void;
}

export function subscribeTicker(
  ticker: Ticker,
  callback: TickerCallback,
  options: TickerSubscriptionOptions,
): () => void {
  let active = true;

  const unsubscribe = () => {
    if (!active) return;
    active = false;
    ticker.remove(listener);
  };

  const listener = (current: Ticker) => {
    if (options.once) active = false;
    try {
      callback(current);
    } catch (error) {
      unsubscribe();
      console.error(`[ticker] ${options.source} threw and was unsubscribed`, error);
      options.onFailure?.();
    }
  };

  const priority = options.priority ?? UPDATE_PRIORITY.NORMAL;
  if (options.once) ticker.addOnce(listener, undefined, priority);
  else ticker.add(listener, undefined, priority);
  return unsubscribe;
}
