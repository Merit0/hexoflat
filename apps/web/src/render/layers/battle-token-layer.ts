import { Container } from 'pixi.js';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { creatureSprite } from '@/render/creature-sprites';
import { createHexToken, type HexToken } from '@/render/hex-token';
import type { TokenPose } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleTokenLayer {
  sync(creatures: BattleCreature[], activeId: string | null, targets?: readonly string[]): void;
  pose(poses: ReadonlyMap<string, TokenPose>): void;
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
  const placed = new Map<string, PlacedToken>();
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

  function sync(
    creatures: BattleCreature[],
    _activeId?: string | null,
    _targets?: readonly string[],
  ) {
    clear();
    for (const creature of creatures.filter((c) => c.hp > 0)) {
      const entry = holderOf(creature);
      placed.set(creature.id, entry);
      container.addChild(entry.holder);
    }
    applyPoses();
  }

  return {
    sync,
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
