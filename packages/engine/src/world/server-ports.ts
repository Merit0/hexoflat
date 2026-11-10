import type { HexEngineActionContext } from '../commands/apply-command';
import type { DomainEvent } from '../commands/types';
import { HeroModel } from '../models/hero-model';
import type { THeroToolKey } from '../content/equipment.content';
import type { TGameEventType } from '../abstraction/abstract-action';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';

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
  tool: {
    dragging: boolean;
    hover: IHexCoordinates | null;
    active: THeroToolKey | null;
    durability?: { current: number; max: number };
  };
}

const NO_HINT: WorldClientHint = {
  tool: { dragging: false, hover: null, active: null },
};

export function createRecordingPorts(
  hint: WorldClientHint = NO_HINT,
  heroModel: HeroModel = new HeroModel(),
): {
  ctx: HexEngineActionContext;
  effects: WorldEffect[];
} {
  const effects: WorldEffect[] = [];
  let activeTool = hint.tool.active;
  const durability = hint.tool.durability ? { ...hint.tool.durability } : null;
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
        if (!durability || !activeTool || activeTool === HEXOBJECT_KEYS.HAND) return true;
        if (!Number.isFinite(pct) || pct <= 0) return true;
        if (durability.max <= 0 || durability.current <= 0) return false;
        durability.current = Math.max(
          0,
          durability.current - Math.max(1, Math.ceil(durability.max * pct)),
        );
        return durability.current > 0;
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
      hero: heroModel,
      healHero: (amount: number) => {
        heroModel.setHealth(heroModel.currentHealth + amount);
        heroModel.adjustHealthOnStatChange();
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
