import { vi } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import type HexMapModel from '../map/models/hex-map-model';
import type { HeroState } from '../hero-movement/hero-state';
import {
  createEngineState,
  type HexEngineActionContext,
  type HexEngineState,
} from './apply-command';

/**
 * Shared setup for the `applyCommand` suites.
 *
 * Extracted when `apply-command.test.ts` was split per command group — the
 * file had grown past the engine's `max-lines` ratchet once every command
 * literal gained its envelope. Splitting it kept the ratchet where it is,
 * which is the point of having one.
 */

// Command ids must be unique per dispatch, or the applied-command log treats
// the second one as a retry and replays the first result instead of running it.
let commandCounter = 0;

export function nextCommandId(): string {
  commandCounter += 1;

  return `cmd-${commandCounter}`;
}

export const TEST_ACTOR_ID = 'test-actor';

export function buildMap(): HexMapModel {
  return new HexMapBuilder().name('test').width(2).height(1).build();
}

export function buildMovementMap(): HexMapModel {
  const map = new HexMapBuilder().name('movement-test').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;

  return map;
}

export function toState(map: HexMapModel, heroes: Record<string, HeroState> = {}): HexEngineState {
  return createEngineState({ map, heroes, seed: 'apply-command-test' });
}

export function buildHero(overrides: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1',
    controlledBy: null,
    coordinates: { columnIndex: 0, rowIndex: 0 },
    heroSteps: 0,
    ...overrides,
  };
}

export function createContext(
  overrides: Partial<HexEngineActionContext> = {},
): HexEngineActionContext {
  return {
    heroToolStore: {
      isLocked: false,
      isDragging: false,
      activeTool: null,
      hover: null,
      consumeDurability: vi.fn(() => true),
      lockTool: vi.fn(),
      unlockTool: vi.fn(),
      clearResolvedActions: vi.fn(),
      stopTool: vi.fn(),
    },
    hero: {
      hero: { name: 'Hero', maxHealth: 100, currentHealth: 100 },
      healHero: vi.fn(),
    },
    gathering: { add: vi.fn() },
    inventory: { putToInventory: vi.fn(() => ({ ok: true })) },
    events: { push: vi.fn() },
    worldMap: {
      combatActive: false,
      performHeroCombatAttack: vi.fn(() => ({ ok: true, message: '' })),
      placeCombatDefendMarker: vi.fn(() => true),
      isLocationRespawning: vi.fn(() => false),
      getLocationRespawnRemainingMs: vi.fn(() => 0),
      goToLocation: vi.fn(),
    },
    ...overrides,
  };
}
