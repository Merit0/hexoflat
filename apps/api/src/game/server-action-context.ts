import type { HexEngineActionContext } from '@hexoflat/engine';

/**
 * Minimal working ports so the 4 pre-multiplayer commands (START_HEX_ACTION,
 * FINISH_PENDING_ACTIONS, WORLD_TICK, ADD_RESOURCE_SPAWNER) don't throw when
 * forwarded generically through the gateway. Heal and gathering
 * persistence is out of scope for this phase; the hero's inventory lives in the state itself.
 */
export function createServerActionContext(): HexEngineActionContext {
  return {
    heroToolStore: {
      isLocked: false,
      isDragging: false,
      activeTool: null,
      hover: null,
      consumeDurability: () => true,
      lockTool: () => {},
      unlockTool: () => {},
      clearResolvedActions: () => {},
      stopTool: () => {},
    },
    hero: {
      hero: { name: '', maxHealth: 0, currentHealth: 0 },
      healHero: () => {},
    },
    gathering: {
      add: () => {},
    },
    events: {
      push: () => {},
    },
    worldMap: {
      combatActive: false,
      isLocationRespawning: () => false,
      getLocationRespawnRemainingMs: () => 0,
      goToLocation: () => {},
    },
  };
}
