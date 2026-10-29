import type { Ticker } from 'pixi.js';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleFxLayer } from '@/render/layers/battle-fx-layer';
import type { BattleTokenLayer } from '@/render/layers/battle-token-layer';
import { planBattleAnimation, type AnimatedCreature } from './battle-animation-plan';
import { BattleAnimationQueue } from './battle-animation-queue';
import type { AnimationGeometry } from './battle-animation-sample';

export interface BattleAnimatorDeps {
  ticker: Ticker;
  geometry: AnimationGeometry;
  tokens: BattleTokenLayer;
  fx: BattleFxLayer;
  onBusyChange(busy: boolean): void;
}

export interface BattleAnimator {
  play(events: DomainEvent[], creatures: AnimatedCreature[]): void;
  destroy(): void;
}

export function createBattleAnimator(deps: BattleAnimatorDeps): BattleAnimator {
  const queue = new BattleAnimationQueue(deps.geometry);
  let running = false;

  function render(deltaMs: number) {
    const frame = queue.advance(deltaMs);
    deps.tokens.pose(frame.poses);
    deps.fx.sync(frame.fx);
    if (!frame.busy) setRunning(false);
  }

  const onTick = (ticker: Ticker) => render(ticker.deltaMS);

  function setRunning(next: boolean) {
    if (running === next) return;
    running = next;
    if (next) deps.ticker.add(onTick);
    else deps.ticker.remove(onTick);
    deps.onBusyChange(next);
  }

  return {
    play(events, creatures) {
      const steps = planBattleAnimation(events, creatures);
      if (!steps.length) return;
      queue.enqueue(steps);
      render(0);
      setRunning(true);
    },
    destroy() {
      queue.clear();
      setRunning(false);
    },
  };
}
