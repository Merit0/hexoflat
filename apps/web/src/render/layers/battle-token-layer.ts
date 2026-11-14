import { Container } from 'pixi.js';
import type { BattleCreature, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { sameHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { creatureSprite } from '@/render/creature-sprites';
import { createHexToken, type HexToken } from '@/render/hex-token';
import { BATTLE_GRAVE_SPRITES, EXAMINED_GRAVE_ALPHA } from '@/render/battle/battle-look';
import { drawBattleGrave } from './battle-grave';
import type { TokenPose } from '@/render/battle/battle-animation-sample';
import type { BattleLayerDeps } from './battle-board-layer';

export interface BattleTokenLayer {
  sync(
    creatures: BattleCreature[],
    activeId: string | null,
    targets?: readonly string[],
    graves?: readonly BattleGraveMark[] | null,
  ): void;
  pose(poses: ReadonlyMap<string, TokenPose>): void;
  setDying(ids: ReadonlySet<string>): void;
  destroy(): void;
}

export interface BattleGraveMark {
  hex: BattleHex;
  examined: boolean;
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
  let graveMarks: readonly BattleGraveMark[] | null = null;
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

  let graveTokens: HexToken[] = [];

  function hexGraveAt(hex: BattleHex, examined: boolean): Container | null {
    const path = BATTLE_GRAVE_SPRITES.enemies;
    if (!path) return null;
    const token = createHexToken(path);
    token.layout(w, h);
    token.body.position.set(w / 2, h / 2);
    token.root.position.set(-w / 2, -h / 2);
    graveTokens.push(token);
    const holder = new Container();
    holder.addChild(token.root);
    const { x, y } = deps.positionOf(hex);
    holder.position.set(x + w / 2, y + h / 2);
    holder.alpha = examined ? EXAMINED_GRAVE_ALPHA : 1;
    return holder;
  }

  function graveOf(creature: BattleCreature): Container {
    if (creature.side === 'enemies') {
      const grave = hexGraveAt(creature.pos, false);
      if (grave) return grave;
    }
    const grave = drawBattleGrave(h);
    const { x, y } = deps.positionOf(creature.pos);
    grave.position.set(x + w / 2, y + h / 2);
    return grave;
  }

  function clearGraves() {
    for (const token of graveTokens) token.destroy();
    graveTokens = [];
    graves.removeChildren();
  }

  function rebuild() {
    clear();
    clearGraves();
    for (const creature of creatures) {
      if (creature.hp > 0 || dying.has(creature.id)) {
        const entry = holderOf(creature);
        placed.set(creature.id, entry);
        container.addChild(entry.holder);
      } else if (!graveMarks || creature.side !== 'enemies') {
        graves.addChild(graveOf(creature));
      }
    }
    for (const mark of graveMarks ?? []) {
      const covered = creatures.some((c) => dying.has(c.id) && sameHex(c.pos, mark.hex));
      const grave = covered ? null : hexGraveAt(mark.hex, mark.examined);
      if (grave) graves.addChild(grave);
    }
    applyPoses();
  }

  function sync(
    next: BattleCreature[],
    _activeId?: string | null,
    _targets?: readonly string[],
    marks?: readonly BattleGraveMark[] | null,
  ) {
    creatures = next;
    graveMarks = marks ?? null;
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
      clearGraves();
      container.destroy({ children: true });
    },
  };
}
