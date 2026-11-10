import { toRaw } from 'vue';
import { aimOptions } from '@hexoflat/engine/battle/reaction';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { battleDistance, hexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import { isFreeHex } from '@hexoflat/engine/battle/battle-board';
import { controlledHero } from '@/composables/battle-board-tap';
import type { BattleState } from '@hexoflat/engine/battle/battle-state';
import { useBattleStore } from '@/stores/battle-store';

const SERVER_FIXTURE = 'Battle fixtures move to the server in B5';

export function finishOpenBattle(_outcome: 'victory' | 'defeat'): void {
  throw new Error(SERVER_FIXTURE);
}

export function giveHeroTheTurn(_willPerTurn: number): void {
  throw new Error(SERVER_FIXTURE);
}

export interface BattleHexPoint {
  x: number;
  y: number;
}

let hexPointProbe: ((hex: { q: number; r: number }) => BattleHexPoint | null) | null = null;

export function registerBattleHexProbe(
  probe: ((hex: { q: number; r: number }) => BattleHexPoint | null) | null,
): void {
  hexPointProbe = probe;
}

export interface BattleSnapshot {
  round: number;
  phase: string;
  activeId: string;
  order: string[];
  draws: Record<string, number>;
  turnWill: number;
  reaction: { stage: 'block' | 'aim'; attackerId: string; defenderId: string } | null;
  creatures: { id: string; side: string; hp: number; maxHp: number; q: number; r: number }[];
  wounds: Record<string, { q: number; r: number }[]>;
  heroDistances: Record<string, number>;
  placedShields: number;
  revealedShields: number;
  heroFreeNeighbours: { q: number; r: number }[];
  terrain: Record<string, number>;
  terrainByHex: Record<string, string>;
  aimOptions: { q: number; r: number }[];
}

export function crowdTheHero(_adjacent = 2, _far = 0): void {
  throw new Error(SERVER_FIXTURE);
}

export function holdTheWindowOpen(_extraMs: number): void {
  throw new Error(SERVER_FIXTURE);
}

export function giveEnemyTheTurn(_willPerTurn: number): void {
  throw new Error(SERVER_FIXTURE);
}

function heroDistanceTo(
  battle: { creatures: { side: string; pos: { q: number; r: number } }[] },
  pos: { q: number; r: number },
): number {
  const hero = battle.creatures.find((c) => c.side === 'heroes');
  return hero ? battleDistance(hero.pos, pos) : -1;
}

function freeBesideHero(battle: BattleState): { q: number; r: number }[] {
  const hero = battle.creatures.find((c) => c.side === 'heroes');
  if (!hero) return [];
  return Object.keys(battle.board)
    .map((key) => ({ q: Number(key.split(',')[0]), r: Number(key.split(',')[1]) }))
    .filter(
      (hex) =>
        battle.board[hexKey(hex)] === 'floor' &&
        battleDistance(hex, hero.pos) === 1 &&
        isFreeHex(battle, hex),
    );
}

function terrainCounts(battle: BattleState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const terrain of Object.values(battle.board)) counts[terrain] = (counts[terrain] ?? 0) + 1;
  counts.boulder = battle.boulders.length;
  return counts;
}

export function readBattleSnapshot(): BattleSnapshot | null {
  const store = useBattleStore();
  const view = store.projection;
  if (!view) return null;
  const battle = view as unknown as BattleState;
  const hero = controlledHero(view, store.localHeroIds);
  const strike = hero ? view.pending.find((s) => s.attackerId === hero.id) : undefined;
  const options =
    hero && strike && view.reaction?.stage === 'aim'
      ? aimOptions(view, hero, strike, view.turnWill, BATTLE_RULES, view.reaction.ranged)
      : [];
  return {
    round: battle.round,
    phase: battle.phase,
    activeId: battle.activeId,
    order: [...battle.order],
    draws: { ...battle.draws },
    turnWill: battle.turnWill,
    reaction: view.reaction
      ? {
          stage: view.reaction.stage,
          attackerId: view.reaction.attackerId,
          defenderId: view.reaction.defenderId,
        }
      : null,
    creatures: battle.creatures.map((c) => ({
      id: c.id,
      side: c.side,
      hp: c.hp,
      maxHp: c.maxHp,
      q: c.pos.q,
      r: c.pos.r,
    })),
    wounds: {},
    heroDistances: Object.fromEntries(
      battle.creatures
        .filter((c) => c.side === 'enemies')
        .map((c) => [c.id, heroDistanceTo(battle, c.pos)]),
    ),
    placedShields: battle.placedShields.length,
    revealedShields: store.revealedShields.length,
    heroFreeNeighbours: freeBesideHero(battle),
    terrain: terrainCounts(battle),
    terrainByHex: { ...battle.board },
    aimOptions: options.map((h) => ({ q: h.q, r: h.r })),
  };
}

export interface BattleHandsSnapshot {
  right: string | null;
  left: string | null;
  bag: string[];
  will: number;
}

export function readBattleHands(): BattleHandsSnapshot | null {
  const battle = useBattleStore().projection;
  const hero = battle?.creatures.find((creature) => creature.side === 'heroes');
  if (!battle || !hero) return null;
  return {
    right: hero.hands.right?.key ?? null,
    left: hero.hands.left?.key ?? null,
    bag: hero.bag.map((item) => item.key),
    will: battle.turnWill,
  };
}

export function battleTestHooks() {
  return {
    getBattleHands(): BattleHandsSnapshot | null {
      return readBattleHands();
    },
    getBattleSnapshot(): BattleSnapshot | null {
      return readBattleSnapshot();
    },
    holdTheWindowOpen(extraMs: number): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      holdTheWindowOpen(extraMs);
    },
    crowdTheHero(adjacent?: number, far?: number): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      crowdTheHero(adjacent, far);
    },
    giveEnemyTheTurn(): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      giveEnemyTheTurn(20);
    },
    getBattleHexPoint(q: number, r: number): BattleHexPoint | null {
      return hexPointProbe ? hexPointProbe({ q, r }) : null;
    },
    giveHeroTheTurn(will = 20): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      giveHeroTheTurn(will);
    },
    finishBattle(outcome: 'victory' | 'defeat'): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      finishOpenBattle(outcome);
    },
  };
}
