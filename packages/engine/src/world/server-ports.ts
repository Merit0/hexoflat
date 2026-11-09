import type { HexEngineActionContext } from '../commands/apply-command';
import type { DomainEvent } from '../commands/types';
import type { THeroToolKey } from '../content/equipment.content';
import type { TGameEventType } from '../abstraction/abstract-action';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { THexobjectKey } from '../registry/hexobjects-registry';

export type WorldEffect =
  | { kind: 'lockTool'; coordinates: IHexCoordinates; endsAt: number }
  | { kind: 'unlockTool' }
  | { kind: 'consumeDurability'; pct: number }
  | { kind: 'stopTool' }
  | { kind: 'clearResolvedActions' }
  | { kind: 'setActiveTool'; key: THeroToolKey | null }
  | { kind: 'treeCut'; amount: number }
  | { kind: 'stones'; amount: number }
  | { kind: 'gather'; key: THexobjectKey; amount: number }
  | { kind: 'log'; source: string; text: string; type?: TGameEventType }
  | { kind: 'heal'; amount: number };

export interface WorldClientHint {
  tool: { dragging: boolean; hover: IHexCoordinates | null; active: THeroToolKey | null };
  health: { current: number; max: number };
}

const NO_HINT: WorldClientHint = {
  tool: { dragging: false, hover: null, active: null },
  health: { current: 0, max: 0 },
};

export function createRecordingPorts(hint: WorldClientHint = NO_HINT): {
  ctx: HexEngineActionContext;
  effects: WorldEffect[];
} {
  const effects: WorldEffect[] = [];
  const health = { ...hint.health };
  let activeTool = hint.tool.active;
  const ctx: HexEngineActionContext = {
    heroToolStore: {
      isLocked: true,
      isDragging: hint.tool.dragging,
      hover: hint.tool.hover ? { ...hint.tool.hover } : null,
      stoneCollected: 1,
      get activeTool() {
        return activeTool;
      },
      set activeTool(key: THeroToolKey | null) {
        activeTool = key;
        effects.push({ kind: 'setActiveTool', key });
      },
      consumeDurability: (pct: number) => {
        effects.push({ kind: 'consumeDurability', pct });
        return true;
      },
      lockTool: (tile, endsAt) => {
        effects.push({ kind: 'lockTool', coordinates: { ...tile.coordinates }, endsAt });
      },
      unlockTool: () => {
        effects.push({ kind: 'unlockTool' });
      },
      clearResolvedActions: () => {
        effects.push({ kind: 'clearResolvedActions' });
      },
      stopTool: () => {
        effects.push({ kind: 'stopTool' });
      },
      addTreeCut: (amount: number) => {
        effects.push({ kind: 'treeCut', amount });
      },
      collectStones: (amount: number) => {
        effects.push({ kind: 'stones', amount });
      },
    },
    hero: {
      hero: {
        name: '',
        get maxHealth() {
          return health.max;
        },
        get currentHealth() {
          return health.current;
        },
      },
      healHero: (amount: number) => {
        health.current = Math.min(health.max, health.current + amount);
        effects.push({ kind: 'heal', amount });
      },
    },
    gathering: {
      add: (key: THexobjectKey, amount = 1) => {
        effects.push({ kind: 'gather', key, amount });
      },
    },
    events: {
      push: (source: string, text: string, type?: TGameEventType) => {
        effects.push({ kind: 'log', source, text, ...(type ? { type } : {}) });
      },
    },
    worldMap: {
      combatActive: false,
      isLocationRespawning: () => false,
      getLocationRespawnRemainingMs: () => 0,
      goToLocation: () => {},
    },
  };
  return { ctx, effects };
}

export function eventsOfType(events: readonly DomainEvent[], type: string): DomainEvent[] {
  return events.filter((event) => event.type === type);
}
