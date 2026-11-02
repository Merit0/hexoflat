import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../commands/types';
import { createSeededRandom } from '../utils/random-seeded';
import { applyBattleCommand } from './apply-battle';
import type { BattleAction } from './battle-commands';
import { BATTLE_RULES } from './battle-content';
import { creatureById, isAlive } from './battle-fuzz-helpers';
import { battleStateSchema, type BattleHex, type BattleState } from './battle-state';
import { battlefieldSeed, generateBattlefield } from './battlefield';
import { deployBattle } from './battlefield-setup';
import { hexKey, hexNeighbours, sameHex } from './hex-battle-geom';
import { hero } from './battle-test-setup';
import { projectBattleForViewer } from './projection';
import { shieldCapacity } from './defend';
import { startBattle } from './start-battle';

const BATTLES = Number(process.env.FUZZ_BATTLES ?? 120);
const MAX_COMMANDS = 600;
const SQUADS = [
  ['skeleton-warrior'],
  ['skeleton-warrior', 'skeleton-warrior'],
  ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'],
  ['skeleton-archer', 'skeleton-archer'],
  ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior', 'skeleton-archer'],
];

type Rng = () => number;
const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

function randomAction(battle: BattleState, rng: Rng): BattleAction {
  const heroes = battle.creatures.filter((c) => c.side === 'heroes' && isAlive(c));
  const me = pick(heroes, rng);
  const foes = battle.creatures.filter((c) => c.side === 'enemies' && isAlive(c));
  const view = projectBattleForViewer(battle, 'heroes');
  const roll = rng();
  if (battle.task) {
    return roll < 0.2
      ? { kind: 'task-timeout' }
      : { kind: 'answer-task', option: Math.floor(rng() * 4) };
  }
  if (battle.reaction?.stage === 'aim') {
    const strike = view.pending.find((s) => s.attackerId === battle.activeId);
    const ring = strike?.ring ?? [];
    if (roll < 0.15) return { kind: 'end-turn' };
    if (roll < 0.3) return { kind: 'reaction-timeout' };
    return ring.length ? { kind: 'aim', hex: pick(ring, rng) } : { kind: 'reaction-timeout' };
  }
  if (battle.reaction?.stage === 'block') {
    const ring = view.pending[0]?.ring ?? [];
    if (roll < 0.1) return { kind: 'move', hex: pick(hexNeighbours(me.pos), rng) };
    if (roll < 0.45 && ring.length) return { kind: 'place-shield', hex: pick(ring, rng) };
    if (roll < 0.55 && battle.placedShields.length)
      return { kind: 'remove-shield', hex: pick(battle.placedShields, rng) };
    if (roll < 0.7) return { kind: 'take-hit' };
    return { kind: 'reaction-timeout' };
  }
  if (roll < 0.5) return { kind: 'move', hex: pick(hexNeighbours(me.pos), rng) };
  if (roll < 0.72 && foes.length)
    return {
      kind: 'strike',
      targetId: pick(foes, rng).id,
      hand: pick(['right', 'left'] as const, rng),
    };
  if (roll < 0.8) return { kind: 'end-turn' };
  if (roll < 0.84) return { kind: 'undo-step' };
  if (roll < 0.88 && foes.length) return { kind: 'push', targetId: pick(foes, rng).id };
  if (roll < 0.92)
    return {
      kind: 'set-hands',
      right: pick(['sword', 'dagger', null, 'nonsense'], rng),
      left: pick(['wooden-shield', null, 'sword'], rng),
    };
  if (roll < 0.94) return { kind: 'place-shield', hex: pick(hexNeighbours(me.pos), rng) };
  if (roll < 0.96) return { kind: 'use-item', hand: pick(['right', 'left'] as const, rng) };
  if (roll < 0.98) return { kind: 'swap-item', hand: 'left', bagIndex: Math.floor(rng() * 3) };
  return { kind: 'take-hit' };
}

function violations(battle: BattleState, events: DomainEvent[], before: BattleState): string[] {
  const bad: string[] = [];
  const parsed = battleStateSchema.safeParse(battle);
  if (!parsed.success) bad.push(`schema: ${parsed.error.issues[0]?.message}`);
  const alive = battle.creatures.filter(isAlive);
  const seen = new Set<string>();
  for (const creature of battle.creatures) {
    if (creature.hp < 0 || creature.hp > creature.maxHp)
      bad.push(`hp ${creature.id} ${creature.hp}`);
    if (!isAlive(creature)) continue;
    const key = hexKey(creature.pos);
    if (seen.has(key)) bad.push(`two creatures on ${key}`);
    seen.add(key);
    const terrain = battle.board[key];
    if (!terrain || terrain === 'wall') bad.push(`${creature.id} stands on ${terrain}`);
    if (battle.boulders.some((b) => sameHex(b.pos, creature.pos)))
      bad.push(`${creature.id} in a boulder`);
  }
  if (battle.turnWill < 0) bad.push(`will ${battle.turnWill}`);
  if (battle.phase === 'ended') {
    if (battle.reaction) bad.push('reaction after the end');
    const sides = new Set(alive.map((c) => c.side));
    if (sides.size > 1) bad.push('ended with both sides alive');
    return bad;
  }
  const active = creatureById(battle, battle.activeId);
  if (!active || !isAlive(active)) bad.push(`active ${battle.activeId} is not alive`);
  const reaction = battle.reaction;
  if (reaction) {
    if (reaction.stage === 'block') {
      if (battle.phase !== 'defend' || battle.activeId !== reaction.defenderId)
        bad.push('block stage without the defender active');
      const defender = creatureById(battle, reaction.defenderId);
      if (defender && battle.placedShields.length > shieldCapacity(defender, BATTLE_RULES))
        bad.push('more shields than the capacity');
    } else if (battle.phase !== 'act' || battle.activeId !== reaction.attackerId) {
      bad.push('aim stage without the attacker active');
    }
    if (battle.pending.length !== 1) bad.push(`pending ${battle.pending.length} during a reaction`);
  } else {
    if (battle.phase !== 'act') bad.push(`phase ${battle.phase} without a reaction`);
    if (battle.pending.length) bad.push('pending strikes without a reaction');
    if (battle.placedShields.length && !before.reaction) bad.push('shields outside a window');
  }
  if (reaction?.stage === 'block' && active) {
    const watcher = active.side === 'heroes' ? 'enemies' : 'heroes';
    if (projectBattleForViewer(battle, watcher).placedShields.length)
      bad.push('the attacker sees the defender shields');
    const strikes = projectBattleForViewer(battle, active.side).pending;
    if (strikes.some((s) => s.fromHex !== null)) bad.push('the defender sees the strike side');
  }
  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === 'CREATURE_DAMAGED' && Number(payload.amount) <= 0)
      bad.push('zero damage event');
    if (event.type === 'STRIKE_SWEPT') {
      const attacker = creatureById(battle, String(payload.attackerId));
      const victim = creatureById(battle, String(payload.victimId));
      if (!attacker || !victim || attacker.side === victim.side) bad.push('sweep hit an ally');
    }
  }
  return bad;
}

function playBattle(n: number): { bad: string[]; outcome: string; log: string[] } {
  const rng = createSeededRandom({ seed: `fuzz-${n}`, counter: 0 });
  const squad = SQUADS[n % SQUADS.length];
  const heroCount = 1 + (n % 3 === 0 ? 1 : 0);
  const { setup } = deployBattle({
    battleId: `fuzz-${n}`,
    field: generateBattlefield('crypt', battlefieldSeed(`fuzz-${n}`, 0)),
    heroes: Array.from({ length: heroCount }, (_, i) =>
      hero({ q: 0, r: 0 }, { id: `hero-${i}`, hp: 6 + (n % 5), maxHp: 6 + (n % 5) }),
    ),
    members: squad,
    direction: { x: -1, y: 0 },
    ambush: n % 4 === 0,
  });
  let battle = startBattle(setup, BATTLE_RULES).battle;
  const log: string[] = [];
  const bad: string[] = [];
  for (let i = 0, atMs = 0; i < MAX_COMMANDS && battle.phase !== 'ended'; i++, atMs += 400) {
    const before = battle;
    const active = creatureById(battle, battle.activeId)!;
    const heroActs = active.side === 'heroes' || battle.reaction?.defenderId === active.id;
    const action = heroActs ? randomAction(battle, rng) : null;
    const owner = battle.task ? creatureById(battle, battle.task.creatureId)! : active;
    const command = action
      ? { kind: 'hero' as const, heroId: owner.id, atMs, action }
      : { kind: 'run-enemy-turn' as const, atMs };
    const result = applyBattleCommand(before, { type: 'BATTLE', payload: command });
    log.push(JSON.stringify(command));
    const rejected = result.events.some((e) => e.type === 'BATTLE_REJECTED');
    if (rejected && result.battle !== before)
      bad.push(`a rejected command changed the state: ${log.at(-1)}`);
    battle = result.battle ?? before;
    if (i % 20 === 0) {
      const restored = battleStateSchema.safeParse(JSON.parse(JSON.stringify(battle)));
      if (!restored.success)
        bad.push(`a saved state does not load: ${restored.error.issues[0]?.message}`);
      else if (JSON.stringify(restored.data) !== JSON.stringify(restored.data))
        bad.push('unstable parse');
      else {
        const again = applyBattleCommand(restored.data, {
          type: 'BATTLE',
          payload: { kind: 'run-enemy-turn', atMs },
        });
        const original = applyBattleCommand(battle, {
          type: 'BATTLE',
          payload: { kind: 'run-enemy-turn', atMs },
        });
        if (
          JSON.stringify(again.events.map((e) => e.type)) !==
          JSON.stringify(original.events.map((e) => e.type))
        )
          bad.push('a reloaded battle plays differently');
      }
    }
    for (const message of violations(battle, result.events, before))
      bad.push(`${message} <- ${log.at(-1)}`);
    if (bad.length) break;
  }
  return { bad, outcome: battle.outcome ?? 'unfinished', log };
}

describe('battle fuzz (random human-like play against the real engine)', () => {
  it(`keeps every invariant over ${BATTLES} random battles`, { timeout: 280_000 }, () => {
    const failures: string[] = [];
    const outcomes: Record<string, number> = {};
    for (let n = 0; n < BATTLES; n++) {
      const { bad, outcome } = playBattle(n);
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
      if (bad.length) failures.push(`battle ${n}: ${bad[0]}`);
    }
    console.info('fuzz outcomes', JSON.stringify(outcomes));
    expect(failures.slice(0, 8)).toEqual([]);
  });

  it('plays a battle the same way twice from the same commands', () => {
    const a = playBattle(7);
    const b = playBattle(7);
    expect(b.log).toEqual(a.log);
    expect(b.outcome).toBe(a.outcome);
  });
});
