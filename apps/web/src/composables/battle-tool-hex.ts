import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import type {
  BattleCreature,
  BattleHand,
  BattleHex,
  BattleItem,
} from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { livingCreatureAt, terrainAt } from '@hexoflat/engine/battle/battle-board';
import { hexNeighbours, isAdjacentHex } from '@hexoflat/engine/battle/hex-battle-geom';
import { strikingItem } from '@hexoflat/engine/battle/strike';
import { hexobjectOfBattleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { controlledHero } from './battle-board-tap';
import type { BattleUiMode } from './battle-board-tap';

export interface BattleToolHex {
  origin: BattleHex;
  at: BattleHex;
  hand: BattleHand;
  toolKey: string;
  targetId: string | null;
  canAfford: boolean;
}

export interface BattleToolInput {
  projection: BattleProjection | null;
  localHeroIds: readonly string[];
  ui: { mode: BattleUiMode; hand: BattleHand | null; toolAt: BattleHex | null };
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
): BattleHex | null {
  if (preferred && isAdjacentHex(self.pos, preferred)) return preferred;
  const around = hexNeighbours(self.pos).filter((hex) => terrainAt(view, hex) !== null);
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

export function buildBattleToolHex(input: BattleToolInput): BattleToolHex | null {
  const view = input.projection;
  const self = controlledHero(view, input.localHeroIds);
  const hand = input.ui.hand;
  if (!view || !self || view.phase !== 'act' || input.ui.mode !== 'strike' || !hand) return null;
  const at = toolAnchor(view, self, input.ui.toolAt);
  if (!at) return null;
  const foe = foeAt(view, self, at);
  const ready = strikeHands(view, self, input.rules).includes(hand);
  return {
    origin: { ...self.pos },
    at: { ...at },
    hand,
    toolKey: battleToolKey(self.hands[hand]),
    targetId: foe && ready ? foe.id : null,
    canAfford: view.turnWill >= input.rules.strike,
  };
}
