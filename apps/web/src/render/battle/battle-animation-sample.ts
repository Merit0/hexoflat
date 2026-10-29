import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleAnimationStep } from './battle-animation-plan';
import { BATTLE_MOTION } from './battle-timing';

export interface Point {
  x: number;
  y: number;
}

export interface TokenPose extends Point {
  alpha: number;
}

export interface StrikeFx {
  ring: BattleHex[];
  ringAlpha: number;
  sword: Point & { rotation: number; alpha: number };
}

export interface AnimationGeometry {
  centreOf(hex: BattleHex): Point;
  tileHeight: number;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function stepCreatureId(step: BattleAnimationStep): string {
  return step.kind === 'strike' ? step.targetId : step.creatureId;
}

export function movesToken(step: BattleAnimationStep): boolean {
  return step.kind !== 'strike';
}

function slidePoint(path: BattleHex[], t: number, geo: AnimationGeometry): Point {
  const legs = path.length - 1;
  const at = easeInOut(t) * legs;
  const leg = Math.min(legs - 1, Math.floor(at));
  return lerp(geo.centreOf(path[leg]), geo.centreOf(path[leg + 1]), at - leg);
}

function shakeOffset(t: number, amplitude: number): number {
  return Math.sin(t * Math.PI * 2 * BATTLE_MOTION.shakeWaves) * amplitude * (1 - t);
}

export function sampleTokenPose(
  step: BattleAnimationStep,
  progress: number,
  geo: AnimationGeometry,
): TokenPose | null {
  const t = clamp01(progress);
  const h = geo.tileHeight;
  switch (step.kind) {
    case 'vanish':
      return { ...geo.centreOf(step.at), alpha: 1 - t };
    case 'appear':
      return { ...geo.centreOf(step.at), alpha: t };
    case 'slide':
      return { ...slidePoint(step.path, t, geo), alpha: 1 };
    case 'eject': {
      const p = lerp(geo.centreOf(step.from), geo.centreOf(step.to), easeOut(t));
      return {
        x: p.x,
        y: p.y - Math.sin(t * Math.PI) * BATTLE_MOTION.ejectLiftTiles * h,
        alpha: 1,
      };
    }
    case 'shake': {
      const c = geo.centreOf(step.at);
      if (step.style === 'fall') {
        return {
          x: c.x,
          y: c.y + Math.abs(shakeOffset(t, BATTLE_MOTION.fallShakeTiles * h)),
          alpha: 1,
        };
      }
      return { x: c.x + shakeOffset(t, BATTLE_MOTION.heartShakeTiles * h), y: c.y, alpha: 1 };
    }
    case 'strike':
      return null;
  }
}

export function stepStartPose(step: BattleAnimationStep, geo: AnimationGeometry): TokenPose | null {
  return sampleTokenPose(step, 0, geo);
}

export function stepEndPose(step: BattleAnimationStep, geo: AnimationGeometry): TokenPose | null {
  return sampleTokenPose(step, 1, geo);
}

export function sampleStrikeFx(
  step: BattleAnimationStep,
  progress: number,
  geo: AnimationGeometry,
): StrikeFx | null {
  if (step.kind !== 'strike') return null;
  const t = clamp01(progress);
  const target = geo.centreOf(step.target);
  const start = step.from
    ? geo.centreOf(step.from)
    : { x: target.x, y: target.y - BATTLE_MOTION.swordDropTiles * geo.tileHeight };
  const flight = clamp01(t / 0.75);
  const at = lerp(start, target, easeInOut(flight));
  const rotation =
    start.x === target.x && start.y === target.y
      ? Math.PI / 2
      : Math.atan2(target.y - start.y, target.x - start.x);
  return {
    ring: step.ring,
    ringAlpha: Math.sin(t * Math.PI),
    sword: { ...at, rotation, alpha: t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25 },
  };
}
