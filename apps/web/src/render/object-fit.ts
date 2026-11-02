import type { Sprite } from 'pixi.js';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { applyCoverFit } from '@/render/hex-geometry';

export type HexobjectFitRule = 'creature' | 'construction' | 'pickup';

export const HEXOBJECT_FIT_RULES: Record<EHexobjectGroup, HexobjectFitRule> = {
  [EHexobjectGroup.CREATURE]: 'creature',
  [EHexobjectGroup.CONSTRUCTION]: 'construction',
  [EHexobjectGroup.RESOURCE]: 'construction',
  [EHexobjectGroup.LOOT]: 'pickup',
  [EHexobjectGroup.TOOL]: 'pickup',
  [EHexobjectGroup.EQUIPMENT]: 'pickup',
};

export const PICKUP_SPRITE_SCALE = 0.7;

function fitWholeCell(sprite: Sprite, w: number, h: number) {
  applyCoverFit(sprite, w, h);
}

function fitPickup(sprite: Sprite, w: number, h: number) {
  const boxWidth = w * PICKUP_SPRITE_SCALE;
  const boxHeight = h * PICKUP_SPRITE_SCALE;
  applyCoverFit(sprite, boxWidth, boxHeight);
  sprite.position.x += (w - boxWidth) / 2;
  sprite.position.y += (h - boxHeight) / 2;
}

const FITS: Record<HexobjectFitRule, (sprite: Sprite, w: number, h: number) => void> = {
  creature: fitWholeCell,
  construction: fitWholeCell,
  pickup: fitPickup,
};

export function hexobjectFitRule(groupType?: EHexobjectGroup): HexobjectFitRule {
  return groupType ? HEXOBJECT_FIT_RULES[groupType] : 'construction';
}

export function applyObjectFit(sprite: Sprite, w: number, h: number, groupType?: EHexobjectGroup) {
  FITS[hexobjectFitRule(groupType)](sprite, w, h);
}
