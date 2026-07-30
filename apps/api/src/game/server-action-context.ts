import type { HexEngineActionContext } from '@hexoflat/engine';

/**
 * Minimal working ports so the 4 pre-multiplayer commands (START_HEX_ACTION,
 * FINISH_PENDING_ACTIONS, WORLD_TICK, ADD_RESOURCE_SPAWNER) don't throw when
 * forwarded generically through the gateway. Real inventory/gathering/heal
 * persistence is out of scope for this phase (tracked as follow-up debt).
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
    inventory: {
      putToInventory: () => ({ ok: true }),
    },
    events: {
      push: () => {},
    },
    worldMap: {
      combatActive: false,
      performHeroCombatAttack: () => ({ ok: true, message: '' }),
      placeCombatDefendMarker: () => true,
      isLocationRespawning: () => false,
      getLocationRespawnRemainingMs: () => 0,
      goToLocation: () => {},
    },
  };
}
