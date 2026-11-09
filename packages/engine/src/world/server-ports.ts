import type { HexEngineActionContext } from '../commands/apply-command';
import type { DomainEvent } from '../commands/types';

export interface ServerPortLog {
  lines: { source: string; text: string; kind?: string }[];
}

/**
 * The world ports for a runtime without a UI: tool durability always holds, nothing is locked or
 * dragged, nothing is healed or counted (health moves to the server in D4b-3), and there is no
 * battle until the battle lifecycle runs on the server (D4b-4). Event lines are kept for the log.
 */
export function createServerActionContext(
  log: ServerPortLog = { lines: [] },
): HexEngineActionContext {
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
    gathering: { add: () => {} },
    events: {
      push: (source: string, text: string, kind?: string) => {
        log.lines.push({ source, text, kind });
      },
    },
    worldMap: {
      combatActive: false,
      isLocationRespawning: () => false,
      getLocationRespawnRemainingMs: () => 0,
      goToLocation: () => {},
    },
  };
}

export function eventsOfType(events: readonly DomainEvent[], type: string): DomainEvent[] {
  return events.filter((event) => event.type === type);
}
