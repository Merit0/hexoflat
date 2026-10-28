import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { getTexture } from '@/render/texture-cache';
import { BATTLE_SPRITES } from '@/render/battle/battle-look';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleTokenLayer {
  sync(creatures: BattleCreature[], activeId: string | null): void;
  destroy(): void;
}

const SIDE_RING = { heroes: 0x4a8be0, enemies: 0xb0306a } as const;

function hearts(creature: BattleCreature): string {
  return `${creature.hp / 2}/${creature.maxHp / 2}`;
}

export function createBattleTokenLayer(deps: Omit<BattleLayerDeps, 'ticker'>): BattleTokenLayer {
  const container = new Container();
  deps.worldContainer.addChild(container);

  function sync(creatures: BattleCreature[], activeId: string | null) {
    const { w, h } = deps.tileSize;
    container.removeChildren().forEach((child) => child.destroy({ children: true }));
    for (const creature of creatures.filter((c) => c.hp > 0)) {
      const token = new Container();
      const { x, y } = deps.positionOf(creature.pos);
      token.position.set(x + w / 2, y + h / 2);
      const ring = new Graphics();
      const active = creature.id === activeId;
      ring
        .circle(0, 0, w * 0.38)
        .stroke({ color: active ? 0xe0a93f : SIDE_RING[creature.side], width: active ? 4 : 3 });
      const face = new Sprite(
        getTexture(creature.side === 'heroes' ? BATTLE_SPRITES.hero : BATTLE_SPRITES.skeleton),
      );
      face.anchor.set(0.5);
      face.width = w * 0.7;
      face.height = h * 0.7;
      const hp = new Text({
        text: hearts(creature),
        style: {
          fontFamily: 'Cinzel, serif',
          fontSize: 11,
          fontWeight: '800',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3 },
        },
      });
      hp.anchor.set(0.5);
      hp.position.set(0, h * 0.32);
      token.addChild(face, ring, hp);
      container.addChild(token);
    }
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
