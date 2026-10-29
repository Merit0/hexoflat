import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleHex, BattleSide } from '@hexoflat/engine/battle/battle-state';
import { BATTLE_TIMING } from './battle-timing';

export interface AnimatedCreature {
  id: string;
  side: BattleSide;
  pos: BattleHex;
}

export type BattleAnimationStep =
  | { kind: 'vanish'; creatureId: string; at: BattleHex; durationMs: number }
  | { kind: 'appear'; creatureId: string; at: BattleHex; durationMs: number }
  | {
      kind: 'strike';
      targetId: string;
      target: BattleHex;
      from: BattleHex | null;
      ring: BattleHex[];
      durationMs: number;
    }
  | { kind: 'slide'; creatureId: string; path: BattleHex[]; durationMs: number }
  | { kind: 'eject'; creatureId: string; from: BattleHex; to: BattleHex; durationMs: number }
  | {
      kind: 'shake';
      creatureId: string;
      at: BattleHex;
      style: 'hit' | 'fall';
      durationMs: number;
    };

interface Moved {
  creatureId: string;
  from: BattleHex;
  to: BattleHex;
}
interface Struck {
  targetId: string;
  fromHex: BattleHex | null;
  ring: BattleHex[];
}
interface Displaced {
  targetId: string;
  from: BattleHex;
  path: BattleHex[];
  fell: boolean;
}
interface Thrown {
  creatureId: string;
  from: BattleHex;
  to: BattleHex;
}

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
  private readonly hidden = new Set<string>();
  private readonly sides: Map<string, BattleSide>;

  constructor(
    creatures: AnimatedCreature[],
    private readonly pos: Map<string, BattleHex>,
  ) {
    this.sides = new Map(creatures.map((c) => [c.id, c.side]));
  }

  read(event: DomainEvent) {
    if (event.type === 'CREATURE_MOVED') this.moved(event.payload as Moved);
    if (event.type === 'MOVE_UNDONE') this.place((event.payload as Moved).creatureId, event);
    if (event.type === 'STRIKE_DEALT') this.struck(event.payload as Struck);
    if (event.type === 'DISPLACED') this.displaced(event.payload as Displaced);
    if (event.type === 'THROWN_CLEAR') this.thrown(event.payload as Thrown);
    if (event.type === 'CREATURE_DAMAGED') this.shake((event.payload as Moved).creatureId, 'hit');
    if (event.type === 'TURN_ENDED') this.reveal();
  }

  reveal() {
    for (const creatureId of this.hidden) {
      const at = this.pos.get(creatureId)!;
      this.steps.push({ kind: 'appear', creatureId, at, durationMs: BATTLE_TIMING.enemyAppearMs });
    }
    this.hidden.clear();
  }

  private place(creatureId: string, event: DomainEvent) {
    if (this.pos.has(creatureId)) this.pos.set(creatureId, copy((event.payload as Moved).to));
  }

  private moved({ creatureId, from, to }: Moved) {
    if (!this.pos.has(creatureId)) return;
    if (this.sides.get(creatureId) === 'enemies' && !this.hidden.has(creatureId)) {
      this.hidden.add(creatureId);
      this.steps.push({
        kind: 'vanish',
        creatureId,
        at: copy(from),
        durationMs: BATTLE_TIMING.enemyVanishMs,
      });
    }
    this.pos.set(creatureId, copy(to));
  }

  private struck({ targetId, fromHex, ring }: Struck) {
    const target = this.pos.get(targetId);
    if (!target) return;
    this.steps.push({
      kind: 'strike',
      targetId,
      target: copy(target),
      from: fromHex ? copy(fromHex) : null,
      ring: ring.map(copy),
      durationMs: BATTLE_TIMING.strikeMs,
    });
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

  private shake(creatureId: string, style: 'hit' | 'fall') {
    const at = this.pos.get(creatureId);
    if (!at || this.hidden.has(creatureId)) return;
    const durationMs =
      style === 'fall' ? BATTLE_TIMING.ledgeFallShakeMs : BATTLE_TIMING.heartShakeMs;
    this.steps.push({ kind: 'shake', creatureId, at: copy(at), style, durationMs });
  }
}

export function planBattleAnimation(
  events: DomainEvent[],
  creatures: AnimatedCreature[],
): BattleAnimationStep[] {
  const planner = new Planner(creatures, rewind(events, creatures));
  for (const event of events) planner.read(event);
  planner.reveal();
  return planner.steps;
}
