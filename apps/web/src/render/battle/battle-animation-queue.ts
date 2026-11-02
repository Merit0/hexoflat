import type { BattleAnimationStep } from './battle-animation-plan';
import {
  movesToken,
  damageNumbersOf,
  sampleStrikeFx,
  sampleTokenPose,
  stepCreatureId,
  stepEndPose,
  stepStartPose,
  strikeReachedHit,
  type AnimationGeometry,
  type DamageNumber,
  type StrikeFx,
  type TokenPose,
} from './battle-animation-sample';

export interface BattleAnimationFrame {
  poses: Map<string, TokenPose>;
  fx: StrikeFx | null;
  dying: Set<string>;
  numbers: DamageNumber[];
  busy: boolean;
}

export class BattleAnimationQueue {
  private steps: BattleAnimationStep[] = [];
  private elapsedMs = 0;
  private readonly held = new Map<string, TokenPose>();
  private readonly announced = new WeakSet<BattleAnimationStep>();

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
    const numbers: DamageNumber[] = [];
    while (this.steps.length && this.elapsedMs >= this.steps[0].durationMs) {
      this.elapsedMs -= this.steps[0].durationMs;
      const done = this.steps.shift()!;
      numbers.push(...this.announce(done));
      this.finish(done);
    }
    if (!this.steps.length) this.elapsedMs = 0;
    const current = this.steps[0];
    if (current && strikeReachedHit(current, this.progress(current))) {
      numbers.push(...this.announce(current));
    }
    return { ...this.frame(), numbers };
  }

  clear() {
    this.steps = [];
    this.held.clear();
    this.elapsedMs = 0;
  }

  frame(): BattleAnimationFrame {
    const poses = new Map(this.held);
    const dying = new Set(
      this.steps.filter((s) => s.kind === 'fall').map((s) => stepCreatureId(s)),
    );
    const current = this.steps[0];
    if (!current) return { poses, fx: null, dying, numbers: [], busy: false };
    const progress = this.progress(current);
    const pose = sampleTokenPose(current, progress, this.geo);
    if (pose) poses.set(stepCreatureId(current), pose);
    return {
      poses,
      fx: sampleStrikeFx(current, progress, this.geo),
      dying,
      numbers: [],
      busy: true,
    };
  }

  private progress(step: BattleAnimationStep): number {
    return step.durationMs > 0 ? this.elapsedMs / step.durationMs : 1;
  }

  private announce(step: BattleAnimationStep): DamageNumber[] {
    if (this.announced.has(step)) return [];
    this.announced.add(step);
    return damageNumbersOf(step, this.geo);
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
