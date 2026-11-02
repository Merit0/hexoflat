import { Container } from 'pixi.js';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { creatureSprite } from '@/render/creature-sprites';
import { createHexToken, type HexToken } from '@/render/hex-token';
import { drawBattleGrave } from './battle-grave';
import type { TokenPose } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleTokenLayer {
  sync(creatures: BattleCreature[], activeId: string | null, targets?: readonly string[]): void;
  pose(poses: ReadonlyMap<string, TokenPose>): void;
  setDying(ids: ReadonlySet<string>): void;
  destroy(): void;
}

interface PlacedToken {
  holder: Container;
  token: HexToken;
  x: number;
  y: number;
}

export function createBattleTokenLayer(deps: Omit<BattleLayerDeps, 'ticker'>): BattleTokenLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);
  const graves = new Container();
  container.addChild(graves);
  const placed = new Map<string, PlacedToken>();
  let creatures: BattleCreature[] = [];
  let dying: ReadonlySet<string> = new Set();
  let poses: ReadonlyMap<string, TokenPose> = new Map();

  function applyPoses() {
    for (const [id, { holder, x, y }] of placed) {
      const posed = poses.get(id);
      holder.position.set(posed?.x ?? x, posed?.y ?? y);
      holder.alpha = posed?.alpha ?? 1;
    }
  }

  function holderOf(creature: BattleCreature): PlacedToken {
    const holder = new Container();
    const token = createHexToken(creatureSprite(creature.side, creature.kind));
    token.layout(w, h);
    token.body.position.set(w / 2, h / 2);
    token.root.position.set(-w / 2, -h / 2);
    holder.addChild(token.root);
    const { x, y } = deps.positionOf(creature.pos);
    return { holder, token, x: x + w / 2, y: y + h / 2 };
  }

  function clear() {
    for (const { holder, token } of placed.values()) {
      token.destroy();
      holder.destroy({ children: true });
    }
    placed.clear();
  }

  function graveOf(creature: BattleCreature): Container {
    const grave = drawBattleGrave(h);
    const { x, y } = deps.positionOf(creature.pos);
    grave.position.set(x + w / 2, y + h / 2);
    return grave;
  }

  function rebuild() {
    clear();
    graves.removeChildren().forEach((child) => child.destroy({ children: true }));
    for (const creature of creatures) {
      if (creature.hp > 0 || dying.has(creature.id)) {
        const entry = holderOf(creature);
        placed.set(creature.id, entry);
        container.addChild(entry.holder);
      } else {
        graves.addChild(graveOf(creature));
      }
    }
    applyPoses();
  }

  function sync(next: BattleCreature[], _activeId?: string | null, _targets?: readonly string[]) {
    creatures = next;
    rebuild();
  }

  function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
  }

  return {
    sync,
    setDying(next) {
      if (sameIds(dying, next)) return;
      dying = new Set(next);
      rebuild();
    },
    pose(next) {
      poses = next;
      applyPoses();
    },
    destroy() {
      clear();
      container.destroy({ children: true });
    },
  };
}
