import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import type {
  BattleCreature,
  BattleHand,
  BattleHex,
  BattleItem,
} from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { livingCreatureAt, terrainAt } from '@hexoflat/engine/battle/battle-board';
import { guardHexRefusal, shieldCapacity } from '@hexoflat/engine/battle/defend';
import { hexNeighbours, isAdjacentHex, sameHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { strikingItem } from '@hexoflat/engine/battle/strike';
import { hexobjectOfBattleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { controlledHero } from './battle-board-tap';
import { handFitsStage, stageHands, type BattleStage } from './battle-stage';

export type BattleToolAction = 'attack' | 'block' | 'unblock';

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

function toolAnchor(
  view: BattleProjection,
  self: BattleCreature,
  preferred: BattleHex | null,
  stage: BattleStage,
): BattleHex | null {
  if (preferred && isAdjacentHex(self.pos, preferred)) return preferred;
  const around = hexNeighbours(self.pos).filter((hex) => terrainAt(view, hex) !== null);
  if (stage === 'block') return around.find((hex) => !guardHexRefusal(view, self, hex)) ?? null;
  return around.find((hex) => foeAt(view, self, hex)) ?? around[0] ?? null;
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
  return foe && ready
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
  const open =
    !guardHexRefusal(view, self, at) && view.placedShields.length < shieldCapacity(self, rules);
  return open
    ? { action: 'block', targetId: null, price: rules.shieldPerSide }
    : { action: null, targetId: null, price: 0 };
}

export function buildBattleToolHex(input: BattleToolInput): BattleToolHex | null {
  const view = input.projection;
  const self = controlledHero(view, input.localHeroIds);
  const { stage } = input.ui;
  if (!view || !self || view.phase !== 'act' || stage === 'move') return null;
  const chosen = input.ui.hand;
  const hand =
    chosen && handFitsStage(self.hands[chosen], stage) ? chosen : stageHands(self, stage)[0];
  if (!hand) return null;
  const at = toolAnchor(view, self, input.ui.toolAt, stage);
  if (!at) return null;
  const decision =
    stage === 'attack'
      ? attackDecision(view, self, hand, at, input.rules)
      : blockDecision(view, self, at, input.rules);
  return {
    origin: { ...self.pos },
    at: { ...at },
    hand,
    toolKey: battleToolKey(self.hands[hand]),
    action: decision.action,
    targetId: decision.targetId,
    canAfford: view.turnWill >= decision.price,
    price: decision.price,
  };
}
