import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { EncounterView } from '@hexoflat/engine/encounters/encounter-state';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { buildHexPolygon } from '@/render/hex-geometry';
import { getTexture } from '@/render/texture-cache';
import {
  ENCOUNTER_LOOT_URL,
  ENCOUNTER_MARKS,
  ENCOUNTER_RIMS,
  ENCOUNTER_TOKEN_URL,
  leaderGlyph,
  rimOf,
  toPixiColor,
} from '@/render/encounter-look';

export interface EncounterLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
}

export interface EncounterLayerSync {
  encounters: EncounterView[];
  watched: IHexCoordinates[];
  reachableIds: string[];
}

export interface EncounterLayer {
  sync(params: EncounterLayerSync): void;
  destroy(): void;
}

const STACK_STEP = 5;
const TOKEN_SCALE = 0.78;

function scaledPolygon(w: number, h: number, scale: number, dx: number, dy: number): number[] {
  const points = buildHexPolygon(w * scale, h * scale).points;
  return points.map((value, i) =>
    i % 2 === 0 ? value + dx + (w * (1 - scale)) / 2 : value + dy + (h * (1 - scale)) / 2,
  );
}

function badge(text: string, fill: string, stroke: string, radius: number): Container {
  const root = new Container();
  const circle = new Graphics()
    .circle(0, 0, radius)
    .fill({ color: toPixiColor(fill) })
    .stroke({ color: toPixiColor(stroke), width: 2 });
  const label = new Text({
    text,
    style: { fontFamily: 'Cinzel, serif', fontSize: radius, fontWeight: '800', fill: 0xf5ead0 },
  });
  label.anchor.set(0.5);
  root.addChild(circle, label);
  return root;
}

function drawWatched(layer: Graphics, watched: IHexCoordinates[], w: number, h: number) {
  layer.clear();
  for (const coord of watched) {
    const { x, y } = calcHexPixelPosition({ coordinates: coord }, w, h);
    layer
      .poly(scaledPolygon(w, h, 0.94, x, y))
      .fill({ color: toPixiColor(ENCOUNTER_MARKS.watched.fill), alpha: 0.55 })
      .stroke({ color: toPixiColor(ENCOUNTER_MARKS.watched.stroke), width: 2 });
  }
}

function tokenNode(view: EncounterView, glow: boolean, w: number, h: number): Container {
  const root = new Container();
  const rim = ENCOUNTER_RIMS[rimOf(view)];
  const isLoot = view.status === 'loot';
  const layers = isLoot ? 0 : view.count - 1;
  for (let i = layers; i >= 1; i -= 1) {
    root.addChild(
      new Graphics()
        .poly(scaledPolygon(w, h, TOKEN_SCALE, 0, i * STACK_STEP))
        .fill({ color: toPixiColor(rim.dark) })
        .stroke({ color: 0x0b0d11, width: 1 }),
    );
  }
  if (glow) {
    root.addChild(
      new Graphics()
        .poly(scaledPolygon(w, h, TOKEN_SCALE + 0.1, 0, 0))
        .stroke({ color: toPixiColor(ENCOUNTER_MARKS.glow), width: 4, alpha: 0.85 }),
    );
  }
  root.addChild(
    new Graphics()
      .poly(scaledPolygon(w, h, TOKEN_SCALE, 0, 0))
      .fill({ color: 0x15171c })
      .stroke({ color: toPixiColor(rim.light), width: 3 }),
  );
  const sprite = new Sprite(getTexture(isLoot ? ENCOUNTER_LOOT_URL : ENCOUNTER_TOKEN_URL));
  sprite.anchor.set(0.5);
  sprite.position.set(w / 2, h / 2);
  sprite.width = w * 0.52;
  sprite.height = h * 0.52;
  root.addChild(sprite);
  if (isLoot) return root;
  const glyph = leaderGlyph(view.leaderKind);
  if (glyph) {
    const mark = new Text({ text: glyph, style: { fontSize: w * 0.2 } });
    mark.anchor.set(0.5);
    mark.position.set(w / 2, h * 0.2);
    root.addChild(mark);
  }
  if (view.count > 1) {
    const count = badge(`×${view.count}`, '#15171c', rim.light, 12);
    count.position.set(w * 0.8, h * 0.78 + layers * STACK_STEP);
    root.addChild(count);
  }
  if (!view.scouted) {
    const unknown = badge('?', ENCOUNTER_MARKS.unknown.fill, ENCOUNTER_MARKS.unknown.stroke, 10);
    unknown.position.set(w * 0.82, h * 0.2);
    root.addChild(unknown);
  }
  if (view.sentry) {
    const eye = badge('👁', ENCOUNTER_MARKS.sentry.fill, ENCOUNTER_MARKS.sentry.stroke, 11);
    eye.position.set(w * 0.18, h * 0.2);
    root.addChild(eye);
  }
  return root;
}

export function createEncounterLayer(deps: EncounterLayerDeps): EncounterLayer {
  const container = new Container();
  container.eventMode = 'none';
  const watchedLayer = new Graphics();
  const tokens = new Container();
  container.addChild(watchedLayer, tokens);
  deps.worldContainer.addChild(container);

  function sync(params: EncounterLayerSync) {
    const { w, h } = deps.getTileSize();
    drawWatched(watchedLayer, params.watched, w, h);
    for (const child of tokens.removeChildren()) child.destroy({ children: true });
    const reachable = new Set(params.reachableIds);
    for (const view of params.encounters) {
      const node = tokenNode(view, reachable.has(view.id), w, h);
      const { x, y } = calcHexPixelPosition({ coordinates: view.coordinates }, w, h);
      node.position.set(x, y);
      tokens.addChild(node);
    }
  }

  return {
    sync,
    destroy() {
      container.destroy({ children: true });
    },
  };
}
