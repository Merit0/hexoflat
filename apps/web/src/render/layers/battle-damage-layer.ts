import { Container, Text, type Ticker } from 'pixi.js';
import { BATTLE_MOTION, BATTLE_TIMING } from '@/render/battle/battle-timing';
import type { DamageNumber } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleDamageLayer {
  spawn(numbers: DamageNumber[]): void;
  destroy(): void;
}

interface Popup {
  text: Text;
  startX: number;
  startY: number;
  ageMs: number;
}

const DAMAGE_COLOR = 0xff5a4a;

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

  function spawn(numbers: DamageNumber[]) {
    for (const { at, damage } of numbers) {
      const text = new Text({
        text: String(damage),
        style: {
          fontFamily: 'sans-serif',
          fontWeight: '800',
          fontSize: h * BATTLE_MOTION.damageFontTiles,
          fill: DAMAGE_COLOR,
          stroke: { color: 0x1a0d0a, width: Math.max(2, h * 0.05) },
        },
      });
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
