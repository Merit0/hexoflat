import type { BattleAnimationStep } from './battle-animation-plan';
import {
  movesToken,
  sampleStrikeFx,
  sampleTokenPose,
  stepCreatureId,
  stepEndPose,
  stepStartPose,
  type AnimationGeometry,
  type StrikeFx,
  type TokenPose,
} from './battle-animation-sample';

export interface BattleAnimationFrame {
  poses: Map<string, TokenPose>;
  fx: StrikeFx | null;
  busy: boolean;
}

export class BattleAnimationQueue {
  private steps: BattleAnimationStep[] = [];
  private elapsedMs = 0;
  private readonly held = new Map<string, TokenPose>();

  constructor(private readonly geo: AnimationGeometry) {}

  get busy(): boolean {
    return this.steps.length > 0;
  }

  enqueue(next: BattleAnimationStep[]) {
    for (const step of next) {
      const id = stepCreatureId(step);
      const start = movesToken(step) ? stepStartPose(step, this.geo) : null;
      if (start && !this.held.has(id) && !this.touchedLater(id)) this.held.set(id, start);
      this.steps.push(step);
    }
  }

  advance(deltaMs: number): BattleAnimationFrame {
    this.elapsedMs += deltaMs;
    while (this.steps.length && this.elapsedMs >= this.steps[0].durationMs) {
      this.elapsedMs -= this.steps[0].durationMs;
      this.finish(this.steps.shift()!);
    }
    if (!this.steps.length) this.elapsedMs = 0;
    return this.frame();
  }

  clear() {
    this.steps = [];
    this.held.clear();
    this.elapsedMs = 0;
  }

  frame(): BattleAnimationFrame {
    const poses = new Map(this.held);
    const current = this.steps[0];
    if (!current) return { poses, fx: null, busy: false };
    const progress = current.durationMs > 0 ? this.elapsedMs / current.durationMs : 1;
    const pose = sampleTokenPose(current, progress, this.geo);
    if (pose) poses.set(stepCreatureId(current), pose);
    return { poses, fx: sampleStrikeFx(current, progress, this.geo), busy: true };
  }

  private touchedLater(id: string): boolean {
    return this.steps.some((s) => movesToken(s) && stepCreatureId(s) === id);
  }

  private finish(step: BattleAnimationStep) {
    if (!movesToken(step)) return;
    const id = stepCreatureId(step);
    if (this.touchedLater(id)) this.held.set(id, stepEndPose(step, this.geo)!);
    else this.held.delete(id);
  }
}
