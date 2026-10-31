import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleHex, BattleSide } from '@hexoflat/engine/battle/battle-state';
import { hexobjectOfBattleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { BATTLE_TIMING } from './battle-timing';

export interface AnimatedCreature {
  id: string;
  side: BattleSide;
  pos: BattleHex;
}

export type BattleAnimationStep =
  | {
      kind: 'strike';
      targetId: string;
      target: BattleHex;
      from: BattleHex | null;
      toolKey: string;
      ring: BattleHex[];
      durationMs: number;
    }
  | { kind: 'slide'; creatureId: string; path: BattleHex[]; durationMs: number }
  | { kind: 'walk'; creatureId: string; from: BattleHex; to: BattleHex; durationMs: number }
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

  constructor(private readonly pos: Map<string, BattleHex>) {}

  read(event: DomainEvent) {
    if (event.type === 'CREATURE_MOVED') this.moved(event.payload as Moved);
    if (event.type === 'MOVE_UNDONE') this.place((event.payload as Moved).creatureId, event);
    if (event.type === 'STRIKE_LANDED') this.struck(event.payload as Struck);
    if (event.type === 'DISPLACED') this.displaced(event.payload as Displaced);
    if (event.type === 'THROWN_CLEAR') this.thrown(event.payload as Thrown);
    if (event.type === 'CREATURE_DAMAGED') this.shake((event.payload as Moved).creatureId, 'hit');
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

  private struck({ attackerId, targetId, itemKey, ring }: Struck) {
    const target = this.pos.get(targetId);
    if (!target) return;
    const attacker = this.pos.get(attackerId);
    this.steps.push({
      kind: 'strike',
      targetId,
      target: copy(target),
      from: attacker ? copy(attacker) : null,
      toolKey: (itemKey && hexobjectOfBattleItem(itemKey)) || HEXOBJECT_KEYS.HAND,
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
    if (!at) return;
    const durationMs =
      style === 'fall' ? BATTLE_TIMING.ledgeFallShakeMs : BATTLE_TIMING.heartShakeMs;
    this.steps.push({ kind: 'shake', creatureId, at: copy(at), style, durationMs });
  }
}

export function planBattleAnimation(
  events: DomainEvent[],
  creatures: AnimatedCreature[],
): BattleAnimationStep[] {
  const planner = new Planner(rewind(events, creatures));
  for (const event of events) planner.read(event);
  return planner.steps;
}
