import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleHex, BattleSide } from '@hexoflat/engine/battle/battle-state';
import { battleToolKeyOf } from './battle-tool-key';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { BATTLE_TIMING } from './battle-timing';

export interface AnimatedCreature {
  id: string;
  side: BattleSide;
  pos: BattleHex;
}

export interface StrikeHit {
  at: BattleHex;
  damage: number;
}

export type BattleAnimationStep =
  | {
      kind: 'strike';
      targetId: string;
      target: BattleHex;
      from: BattleHex | null;
      toolKey: string;
      ring: BattleHex[];
      splashAt: BattleHex[];
      hits: StrikeHit[];
      durationMs: number;
    }
  | { kind: 'slide'; creatureId: string; path: BattleHex[]; durationMs: number }
  | { kind: 'walk'; creatureId: string; from: BattleHex; to: BattleHex; durationMs: number }
  | { kind: 'eject'; creatureId: string; from: BattleHex; to: BattleHex; durationMs: number }
  | { kind: 'fall'; creatureId: string; at: BattleHex; durationMs: number }
  | {
      kind: 'shake';
      creatureId: string;
      at: BattleHex;
      style: 'hit' | 'fall' | 'soft';
      damage?: number;
      durationMs: number;
    };

interface Moved {
  creatureId: string;
  from: BattleHex;
  to: BattleHex;
}
interface Resolved {
  results: Array<{ attackerId: string; outcome: string; damage: number }>;
}
interface Swept {
  attackerId: string;
  victimId: string;
  damage: number;
}
interface Struck {
  attackerId: string;
  targetId: string;
  fromHex: BattleHex | null;
  itemKey?: string;
  ring: BattleHex[];
}
interface Displaced {
  targetId: string;
  from: BattleHex;
  path: BattleHex[];
  fell: boolean;
}
interface Damaged {
  creatureId: string;
  amount: number;
}
interface Thrown {
  creatureId: string;
  from: BattleHex;
  to: BattleHex;
}

const SHAKE_MS = {
  fall: BATTLE_TIMING.ledgeFallShakeMs,
  hit: BATTLE_TIMING.heartShakeMs,
  soft: BATTLE_TIMING.softShakeMs,
} as const;

const copy = (hex: BattleHex): BattleHex => ({ q: hex.q, r: hex.r });

function rewind(events: DomainEvent[], creatures: AnimatedCreature[]): Map<string, BattleHex> {
  const pos = new Map(creatures.map((c) => [c.id, copy(c.pos)]));
  for (const event of [...events].reverse()) {
    const p = event.payload as Partial<Moved & Displaced>;
    const id = event.type === 'DISPLACED' ? p.targetId : p.creatureId;
    if (!id || !pos.has(id)) continue;
    if (event.type === 'CREATURE_MOVED' || event.type === 'THROWN_CLEAR')
      pos.set(id, copy(p.from!));
    if (event.type === 'MOVE_UNDONE') pos.set(id, copy(p.from!));
    if (event.type === 'DISPLACED') pos.set(id, copy(p.from!));
  }
  return pos;
}

class Planner {
  readonly steps: BattleAnimationStep[] = [];
  private readonly covered: string[] = [];

  constructor(private readonly pos: Map<string, BattleHex>) {}

  read(event: DomainEvent, later: DomainEvent[] = []) {
    if (event.type === 'CREATURE_MOVED') this.moved(event.payload as Moved);
    if (event.type === 'MOVE_UNDONE') this.place((event.payload as Moved).creatureId, event);
    if (event.type === 'STRIKE_LANDED') this.struck(event.payload as Struck, later);
    if (event.type === 'DISPLACED') this.displaced(event.payload as Displaced);
    if (event.type === 'THROWN_CLEAR') this.thrown(event.payload as Thrown);
    if (event.type === 'CREATURE_DAMAGED') this.damaged(event.payload as Damaged);
    if (event.type === 'CREATURE_FELL') this.fell((event.payload as Moved).creatureId);
  }

  private place(creatureId: string, event: DomainEvent) {
    if (this.pos.has(creatureId)) this.pos.set(creatureId, copy((event.payload as Moved).to));
  }

  private moved({ creatureId, from, to }: Moved) {
    if (!this.pos.has(creatureId)) return;
    this.steps.push({
      kind: 'walk',
      creatureId,
      from: copy(from),
      to: copy(to),
      durationMs: BATTLE_TIMING.stepMs,
    });
    this.pos.set(creatureId, copy(to));
  }

  private struck({ attackerId, targetId, itemKey, ring }: Struck, later: DomainEvent[]) {
    const target = this.pos.get(targetId);
    if (!target) return;
    const attacker = this.pos.get(attackerId);
    const toolKey = battleToolKeyOf(itemKey);
    const hits = this.strikeHits(attackerId, targetId, later);
    this.covered.push(...hits.filter((h) => h.damage > 0).map((h) => h.victimId));
    this.steps.push({
      kind: 'strike',
      targetId,
      target: copy(target),
      from: attacker ? copy(attacker) : null,
      toolKey,
      ring: ring.map(copy),
      splashAt:
        toolKey === HEXOBJECT_KEYS.HAND ? [] : hits.filter((h) => h.damage > 0).map((h) => h.at),
      hits,
      durationMs: BATTLE_TIMING.strikeMs,
    });
    if (hits.some((h) => h.victimId === targetId && h.damage === 0)) this.shake(targetId, 'soft');
  }

  private strikeHits(
    attackerId: string,
    targetId: string,
    later: DomainEvent[],
  ): Array<StrikeHit & { victimId: string }> {
    const next = later.findIndex((e) => e.type === 'STRIKE_LANDED');
    const mine = next < 0 ? later : later.slice(0, next);
    const resolved = mine.find((e) => e.type === 'STRIKES_RESOLVED')?.payload as
      Resolved | undefined;
    const result = resolved?.results.find((r) => r.attackerId === attackerId);
    const target = this.pos.get(targetId);
    const hits: Array<StrikeHit & { victimId: string }> =
      result && target ? [{ at: copy(target), damage: result.damage, victimId: targetId }] : [];
    for (const event of mine) {
      if (event.type !== 'STRIKE_SWEPT') continue;
      const swept = event.payload as Swept;
      const at = swept.damage > 0 ? this.pos.get(swept.victimId) : undefined;
      if (at) hits.push({ at: copy(at), damage: swept.damage, victimId: swept.victimId });
    }
    return hits;
  }

  private displaced({ targetId, from, path, fell }: Displaced) {
    if (!this.pos.has(targetId) || path.length === 0) return;
    this.steps.push({
      kind: 'slide',
      creatureId: targetId,
      path: [from, ...path].map(copy),
      durationMs: BATTLE_TIMING.slidePerHexMs * path.length,
    });
    this.pos.set(targetId, copy(path[path.length - 1]));
    if (fell) this.shake(targetId, 'fall');
  }

  private thrown({ creatureId, from, to }: Thrown) {
    if (!this.pos.has(creatureId)) return;
    this.steps.push({
      kind: 'eject',
      creatureId,
      from: copy(from),
      to: copy(to),
      durationMs: BATTLE_TIMING.sawEjectMs,
    });
    this.pos.set(creatureId, copy(to));
  }

  private fell(creatureId: string) {
    const at = this.pos.get(creatureId);
    if (!at) return;
    this.steps.push({
      kind: 'fall',
      creatureId,
      at: copy(at),
      durationMs: BATTLE_TIMING.deathFadeMs,
    });
  }

  private damaged({ creatureId, amount }: Damaged) {
    const covered = this.covered.indexOf(creatureId);
    if (covered >= 0) {
      this.covered.splice(covered, 1);
      this.shake(creatureId, 'hit');
      return;
    }
    this.shake(creatureId, 'hit', amount);
  }

  private shake(creatureId: string, style: 'hit' | 'fall' | 'soft', damage?: number) {
    const at = this.pos.get(creatureId);
    if (!at) return;
    const durationMs = damage ? BATTLE_TIMING.woundMs : SHAKE_MS[style];
    this.steps.push({ kind: 'shake', creatureId, at: copy(at), style, damage, durationMs });
  }
}

export function planBattleAnimation(
  events: DomainEvent[],
  creatures: AnimatedCreature[],
): BattleAnimationStep[] {
  const planner = new Planner(rewind(events, creatures));
  events.forEach((event, i) => planner.read(event, events.slice(i + 1)));
  return planner.steps;
}
