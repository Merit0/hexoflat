import { Container, Graphics } from 'pixi.js';
import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { creatureSprite } from '@/render/creature-sprites';
import { createHexToken, type HexToken } from '@/render/hex-token';
import { BATTLE_BLOOD_COLORS } from '@/render/battle/battle-look';
import { BATTLE_MOTION } from '@/render/battle/battle-timing';
import { woundDrops } from '@/render/battle/battle-wound-drops';
import type { TokenPose } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleTokenLayer {
  sync(
    creatures: BattleCreature[],
    activeId: string | null,
    targets?: readonly string[],
    wounds?: Readonly<Record<string, BattleHex[]>>,
  ): void;
  pose(poses: ReadonlyMap<string, TokenPose>): void;
  destroy(): void;
}

interface PlacedToken {
  holder: Container;
  token: HexToken;
  x: number;
  y: number;
}

function drawDrop(radius: number): Graphics {
  const g = new Graphics();
  g.poly([0, -radius * 1.9, -radius * 0.9, -radius * 0.2, radius * 0.9, -radius * 0.2]).fill({
    color: BATTLE_BLOOD_COLORS.fill,
  });
  g.circle(0, 0.15 * radius, radius).fill({ color: BATTLE_BLOOD_COLORS.fill });
  g.circle(-radius * 0.35, 0, radius * 0.25).fill({
    color: BATTLE_BLOOD_COLORS.shine,
    alpha: 0.8,
  });
  return g;
}

export function createBattleTokenLayer(deps: Omit<BattleLayerDeps, 'ticker'>): BattleTokenLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);
  const placed = new Map<string, PlacedToken>();
  const drops = new Container();
  container.addChild(drops);
  const centreOf = (hex: BattleHex) => {
    const { x, y } = deps.positionOf(hex);
    return { x: x + w / 2, y: y + h / 2 };
  };
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
    wounds: Readonly<Record<string, BattleHex[]>> = {},
  ) {
    clear();
    for (const creature of creatures.filter((c) => c.hp > 0)) {
      const entry = holderOf(creature);
      placed.set(creature.id, entry);
      container.addChild(entry.holder);
    }
    container.addChild(drops);
    drops.removeChildren().forEach((child) => child.destroy());
    const bled = creatures.filter((c) => c.hp > 0).flatMap((c) => wounds[c.id] ?? []);
    for (const point of woundDrops(bled, centreOf, h)) {
      const drop = drawDrop(h * BATTLE_MOTION.dropRadiusTiles);
      drop.position.set(point.x, point.y);
      drops.addChild(drop);
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
