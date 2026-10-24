import { vi } from 'vitest';
import type HexMapModel from '../map/models/hex-map-model';
import type { HeroState } from '../hero-movement/hero-state';
import type { HexEngineActionContext, HexEngineState } from './apply-command';

export function toState(map: HexMapModel, heroes: Record<string, HeroState> = {}): HexEngineState {
  return { map, heroes };
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
