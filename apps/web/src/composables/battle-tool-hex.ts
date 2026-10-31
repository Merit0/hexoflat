import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import {
  type BattleCreature,
  type BattleHand,
  type BattleHex,
  type BattleItem,
} from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { livingCreatureAt, terrainAt } from '@hexoflat/engine/battle/battle-board';
import { shieldCapacity } from '@hexoflat/engine/battle/defend';
import { hexNeighbours, isAdjacentHex, sameHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { reachRefusal, strikingItem } from '@hexoflat/engine/battle/strike';
import { hexobjectOfBattleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { controlledHero } from './battle-board-tap';
import type { BattleStage } from './battle-stage';

export type BattleToolAction = 'attack' | 'block' | 'unblock' | 'use';

export interface BattleToolHex {
  origin: BattleHex;
  at: BattleHex;
  hand: BattleHand;
  toolKey: string;
  action: BattleToolAction | null;
  targetId: string | null;
  canAfford: boolean;
  price: number;
}

export interface BattleToolInput {
  projection: BattleProjection | null;
  localHeroIds: readonly string[];
  ui: { stage: BattleStage; hand: BattleHand | null; toolAt: BattleHex | null };
  rules: BattleRules;
}

export function battleToolKey(item: BattleItem | null): string {
  if (!item) return HEXOBJECT_KEYS.HAND;
  return hexobjectOfBattleItem(item.key) ?? HEXOBJECT_KEYS.HAND;
}

function foeAt(
  view: BattleProjection,
  self: BattleCreature,
  hex: BattleHex,
): BattleCreature | null {
  const creature = livingCreatureAt(view, hex);
  return creature && creature.side !== self.side ? creature : null;
}

function ringOf(view: BattleProjection, self: BattleCreature): BattleHex[] {
  return view.pending.filter((s) => s.targetId === self.id).flatMap((s) => s.ring);
}

function inRing(view: BattleProjection, self: BattleCreature, hex: BattleHex): boolean {
  return ringOf(view, self).some((h) => sameHex(h, hex));
}

function toolAnchor(
  view: BattleProjection,
  self: BattleCreature,
  preferred: BattleHex | null,
  item: BattleItem | null,
): BattleHex | null {
  if (preferred && (isAdjacentHex(self.pos, preferred) || foeAt(view, self, preferred))) {
    return preferred;
  }
  const around = hexNeighbours(self.pos).filter((hex) => terrainAt(view, hex) !== null);
  if (item?.shieldCapacity) return around.find((hex) => inRing(view, self, hex)) ?? null;
  if (!item || item.power) return around.find((hex) => foeAt(view, self, hex)) ?? around[0] ?? null;
  return around[0] ?? null;
}

export function strikeHands(
  view: BattleProjection,
  self: BattleCreature,
  rules: BattleRules,
): BattleHand[] {
  return (['right', 'left'] as BattleHand[]).filter(
    (hand) => !!strikingItem(self, hand, rules) && !view.struckHands.includes(hand),
  );
}

interface Decision {
  action: BattleToolAction | null;
  targetId: string | null;
  price: number;
}

function attackDecision(
  view: BattleProjection,
  self: BattleCreature,
  hand: BattleHand,
  at: BattleHex,
  rules: BattleRules,
): Decision {
  const foe = foeAt(view, self, at);
  const ready = strikeHands(view, self, rules).includes(hand);
  const weapon = strikingItem(self, hand, rules);
  const reachable =
    !!foe &&
    !!weapon &&
    !reachRefusal(view, self, foe, weapon, Math.max(0, view.turnWill - rules.strike), rules);
  return foe && ready && reachable
    ? { action: 'attack', targetId: foe.id, price: rules.strike }
    : { action: null, targetId: null, price: 0 };
}

function blockDecision(
  view: BattleProjection,
  self: BattleCreature,
  at: BattleHex,
  rules: BattleRules,
): Decision {
  if (view.placedShields.some((hex) => sameHex(hex, at)))
    return { action: 'unblock', targetId: null, price: 0 };
  const open = inRing(view, self, at) && view.placedShields.length < shieldCapacity(self, rules);
  return open
    ? { action: 'block', targetId: null, price: 0 }
    : { action: null, targetId: null, price: 0 };
}

const NO_ACTION: Decision = { action: null, targetId: null, price: 0 };

function useDecision(item: BattleItem): Decision {
  return item.usePrice ? { action: 'use', targetId: null, price: item.usePrice } : NO_ACTION;
}

function decide(
  view: BattleProjection,
  self: BattleCreature,
  hand: BattleHand,
  at: BattleHex,
  rules: BattleRules,
): Decision {
  const item = self.hands[hand];
  if (!item || item.power) return attackDecision(view, self, hand, at, rules);
  if (item.shieldCapacity) return blockDecision(view, self, at, rules);
  return useDecision(item);
}

export function buildBattleToolHex(input: BattleToolInput): BattleToolHex | null {
  const view = input.projection;
  const self = controlledHero(view, input.localHeroIds);
  const blocking = view?.phase === 'defend' && view.reaction?.stage === 'block';
  if (!view || !self || (view.phase !== 'act' && !blocking) || input.ui.stage !== 'action')
    return null;
  const hand = input.ui.hand;
  if (!hand) return null;
  const item = self.hands[hand];
  const at = toolAnchor(view, self, input.ui.toolAt, item);
  if (!at) return null;
  const decision = decide(view, self, hand, at, input.rules);
  return {
    origin: { ...self.pos },
    at: { ...at },
    hand,
    toolKey: battleToolKey(item),
    action: decision.action,
    targetId: decision.targetId,
    canAfford: view.turnWill >= decision.price,
    price: decision.price,
  };
}
