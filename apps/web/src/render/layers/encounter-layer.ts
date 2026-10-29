import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { EncounterView } from '@hexoflat/engine/encounters/encounter-state';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { buildHexPolygon } from '@/render/hex-geometry';
import { applyObjectFit } from '@/render/object-fit';
import { createHexToken, type HexToken } from '@/render/hex-token';
import { getTexture, isTextureReady, onTextureReady } from '@/render/texture-cache';
import {
  ENCOUNTER_LOOT_URL,
  ENCOUNTER_MARKS,
  ENCOUNTER_RIMS,
  encounterTokenUrl,
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

type Refit = (path: string, fit: () => void) => void;
type Track = (token: HexToken) => void;

function lootFace(w: number, h: number, refit: Refit): Sprite {
  const sprite = new Sprite(getTexture(ENCOUNTER_LOOT_URL));
  const fit = () => {
    sprite.texture = getTexture(ENCOUNTER_LOOT_URL);
    applyObjectFit(sprite, w, h, EHexobjectGroup.LOOT);
  };
  fit();
  refit(ENCOUNTER_LOOT_URL, fit);
  return sprite;
}

function creatureFace(view: EncounterView, w: number, h: number, track: Track): Container {
  const token = createHexToken(encounterTokenUrl(view.leaderKind));
  token.layout(w, h);
  token.body.position.set(w / 2, h / 2);
  track(token);
  return token.root;
}

function tokenNode(
  view: EncounterView,
  w: number,
  h: number,
  refit: Refit,
  track: Track,
): Container {
  const root = new Container();
  const rim = ENCOUNTER_RIMS[rimOf(view)];
  const isLoot = view.status === 'loot';
  root.addChild(isLoot ? lootFace(w, h, refit) : creatureFace(view, w, h, track));
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
    count.position.set(w / 2, h / 2);
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
  let unsubscribers: Array<() => void> = [];
  let faces: HexToken[] = [];
  const refit: Refit = (path, fit) => {
    if (!isTextureReady(path)) unsubscribers.push(onTextureReady(path, fit));
  };
  const track: Track = (token) => faces.push(token);

  function clearRefits() {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers = [];
    for (const face of faces) face.destroy();
    faces = [];
  }

  function sync(params: EncounterLayerSync) {
    const { w, h } = deps.getTileSize();
    drawWatched(watchedLayer, params.watched, w, h);
    clearRefits();
    for (const child of tokens.removeChildren()) child.destroy({ children: true });
    for (const view of params.encounters) {
      const node = tokenNode(view, w, h, refit, track);
      const { x, y } = calcHexPixelPosition({ coordinates: view.coordinates }, w, h);
      node.position.set(x, y);
      tokens.addChild(node);
    }
  }

  return {
    sync,
    destroy() {
      clearRefits();
      container.destroy({ children: true });
    },
  };
}
