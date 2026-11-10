import { Container, Sprite, Text, type Ticker } from 'pixi.js';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import { BATTLE_MOTION, BATTLE_TIMING } from '@/render/battle/battle-timing';
import type { DamageNumber } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleDamageLayer {
  spawn(numbers: DamageNumber[]): void;
  destroy(): void;
}

interface Popup {
  text: Text | Sprite;
  startX: number;
  startY: number;
  ageMs: number;
}

const DAMAGE_COLOR = 0xff5a4a;
export const HALF_HEART_SPRITE = '/board-assets/hero-board/cracker-heart-icon.png';
const MINIMUM_DAMAGE = 1;
const HALF_HEART_TILES = 0.5;

export function createBattleDamageLayer(deps: BattleLayerDeps): BattleDamageLayer {
  const { w, h } = deps.tileSize;
  const container = new Container();
  container.eventMode = 'none';
  deps.worldContainer.addChild(container);
  let popups: Popup[] = [];
  let running = false;

  function draw(popup: Popup) {
    const t = Math.min(1, popup.ageMs / BATTLE_TIMING.damageNumberMs);
    const fade = (1 - t) / (1 - BATTLE_MOTION.damageFadeFrom);
    popup.text.position.set(popup.startX, popup.startY - t * BATTLE_MOTION.damageRiseTiles * h);
    popup.text.alpha = Math.min(1, fade);
  }

  const onTick = (ticker: Ticker) => {
    for (const popup of popups) {
      popup.ageMs += ticker.deltaMS;
      draw(popup);
    }
    const alive = popups.filter((p) => p.ageMs < BATTLE_TIMING.damageNumberMs);
    popups
      .filter((p) => !alive.includes(p))
      .forEach((p) => {
        container.removeChild(p.text);
        p.text.destroy();
      });
    popups = alive;
    if (!popups.length) stop();
  };

  function stop() {
    if (!running) return;
    running = false;
    deps.ticker.remove(onTick);
  }

  function halfHeart(): Sprite {
    const sprite = new Sprite(getTexture(HALF_HEART_SPRITE));
    const stopWatch = onTextureReady(HALF_HEART_SPRITE, () => {
      sprite.texture = getTexture(HALF_HEART_SPRITE);
      const side = h * HALF_HEART_TILES;
      sprite.width = side;
      sprite.height = side;
      stopWatch?.();
    });
    const side = h * HALF_HEART_TILES;
    sprite.width = side;
    sprite.height = side;
    return sprite;
  }

  function damageNode(damage: number): Text | Sprite {
    if (damage === MINIMUM_DAMAGE) return halfHeart();
    return new Text({
      text: String(damage / 2),
      style: {
        fontFamily: 'sans-serif',
        fontWeight: '800',
        fontSize: h * BATTLE_MOTION.damageFontTiles,
        fill: DAMAGE_COLOR,
        stroke: { color: 0x1a0d0a, width: Math.max(2, h * 0.05) },
      },
    });
  }

  function spawn(numbers: DamageNumber[]) {
    for (const { at, damage } of numbers) {
      const text = damageNode(damage);
      text.anchor.set(0.5);
      container.addChild(text);
      const popup = {
        text,
        startX: at.x + w * BATTLE_MOTION.damageStartX,
        startY: at.y + h * BATTLE_MOTION.damageStartY,
        ageMs: 0,
      };
      draw(popup);
      popups.push(popup);
    }
    if (!running && popups.length) {
      running = true;
      deps.ticker.add(onTick);
    }
  }

  return {
    spawn,
    destroy() {
      stop();
      container.destroy({ children: true });
      popups = [];
    },
  };
}
