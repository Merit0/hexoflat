import { aimOptions } from '@hexoflat/engine/battle/reaction';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { battleDistance, hexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import { isFreeHex } from '@hexoflat/engine/battle/battle-board';
import { controlledHero } from '@/composables/battle-board-tap';
import type { BattleState } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { apiClient } from '@/api/client';
import { inventorySession } from '@/services/inventory/inventory-session';
import { observeServerClock } from '@/services/battle/battle-clock';
import { useBattleStore } from '@/stores/battle-store';

interface FixtureAnswer {
  battleView: BattleProjection | null;
  serverNowMs: number;
}

async function serverFixture(body: Record<string, unknown>): Promise<void> {
  const sentAt = Date.now();
  let answer: FixtureAnswer;
  try {
    answer = await apiClient.post<FixtureAnswer>('/player/dev/battle-fixture', body, {
      headers: { 'X-Player-Session': inventorySession.sessionToken ?? '' },
    });
  } catch (error) {
    throw new Error(
      `Battle fixture refused (start the API with HEXOFLAT_E2E_FIXTURES=1): ${String(error)}`,
    );
  }
  observeServerClock(answer.serverNowMs, sentAt, Date.now());
  useBattleStore().projection = answer.battleView;
}

export function finishOpenBattle(outcome: 'victory' | 'defeat'): Promise<void> {
  return serverFixture({ kind: 'finish', outcome });
}

export function giveHeroTheTurn(willPerTurn: number): Promise<void> {
  return serverFixture({ kind: 'hero-turn', will: willPerTurn });
}

export function crowdTheHero(adjacent = 2, far = 0): Promise<void> {
  return serverFixture({ kind: 'crowd', adjacent, far });
}

export function holdTheWindowOpen(extraMs: number): Promise<void> {
  return serverFixture({ kind: 'hold-window', extraMs });
}

export function giveEnemyTheTurn(willPerTurn: number): Promise<void> {
  return serverFixture({ kind: 'enemy-turn', will: willPerTurn });
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
    async holdTheWindowOpen(extraMs: number): Promise<void> {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      await holdTheWindowOpen(extraMs);
    },
    async crowdTheHero(adjacent?: number, far?: number): Promise<void> {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      await crowdTheHero(adjacent, far);
    },
    async giveEnemyTheTurn(): Promise<void> {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      await giveEnemyTheTurn(20);
    },
    getBattleHexPoint(q: number, r: number): BattleHexPoint | null {
      return hexPointProbe ? hexPointProbe({ q, r }) : null;
    },
    async giveHeroTheTurn(will = 20): Promise<void> {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      await giveHeroTheTurn(will);
    },
    async finishBattle(outcome: 'victory' | 'defeat'): Promise<void> {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      await finishOpenBattle(outcome);
    },
  };
}
