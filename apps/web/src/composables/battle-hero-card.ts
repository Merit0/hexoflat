import type { BattleCreature, BattleHand, BattleItem } from '@hexoflat/engine/battle/battle-state';
import { BATTLE_HANDS } from '@hexoflat/engine/battle/battle-state';
import { creatureById, isAlive } from '@hexoflat/engine/battle/battle-board';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { battleHint, type BattleMessage } from './battle-hint';
import type { BattleUiMode } from './battle-board-tap';
import { stageViews, type BattleStage, type BattleStageView } from './battle-stage';
import type { BattleCreatureRow, BattleViewInput } from './battle-view-types';

export type BattleCardState = 'defend' | 'act' | 'wait' | 'fallen' | 'victory' | 'defeat';
export type BattleHandKind = 'weapon' | 'shield' | 'consumable' | 'empty';
export type BattleActionId = 'push' | 'pull' | 'swap';

export interface BattleHandView {
  hand: BattleHand;
  kind: BattleHandKind;
  itemKey: string | null;
  meta: BattleMessage | null;
  selected: boolean;
  disabled: boolean;
}

export interface BattleActionView {
  id: BattleActionId;
  cost: number;
  selected: boolean;
  disabled: boolean;
}

export interface BattleDefendView {
  strikes: number;
  attacker: string;
  placed: number;
  capacity: number;
  shieldKey: string | null;
  shieldCost: number;
  dodgeCost: number;
  canBlock: boolean;
  canDodge: boolean;
}

export interface BattleWaitView {
  name: string;
  init: number;
  stance: number;
}

export interface BattleHeroCard {
  row: BattleCreatureRow;
  state: BattleCardState;
  will: number;
  willCap: number;
  stanceGain: number;
  hands: BattleHandView[];
  actions: BattleActionView[];
  hint: BattleMessage | null;
  canUndo: boolean;
  stanceNote: number;
  plan: number;
  stage: BattleStage;
  stages: BattleStageView[];
  defend: BattleDefendView | null;
  wait: BattleWaitView | null;
  bag: { index: number; key: string }[];
}

function handKind(item: BattleItem | null): BattleHandKind {
  if (!item) return 'empty';
  if (item.power) return 'weapon';
  if (item.heal) return 'consumable';
  return 'shield';
}

function handMeta(
  item: BattleItem | null,
  struck: boolean,
  input: BattleViewInput,
): BattleMessage | null {
  const kind = handKind(item);
  if (kind === 'weapon' || kind === 'empty') {
    const power = item?.power ?? input.rules.unarmedPower;
    return struck
      ? { key: 'battle.hand.struck' }
      : { key: 'battle.hand.weapon', params: { hearts: power / 2, cost: input.rules.strike } };
  }
  if (kind === 'consumable')
    return {
      key: 'battle.hand.consumable',
      params: { hearts: item!.heal! / 2, cost: input.rules.use },
    };
  return { key: 'battle.hand.shield', params: { sides: item!.shieldCapacity ?? 0 } };
}

function handDisabled(
  kind: BattleHandKind,
  struck: boolean,
  view: BattleProjection,
  input: BattleViewInput,
) {
  if (input.ui.mode === 'swap') return false;
  if (kind === 'weapon' || kind === 'empty') return struck || view.turnWill < input.rules.strike;
  if (kind === 'consumable') return view.turnWill < input.rules.use;
  return true;
}

function hands(
  view: BattleProjection,
  self: BattleCreature,
  input: BattleViewInput,
): BattleHandView[] {
  return BATTLE_HANDS.map((hand) => {
    const item = self.hands[hand];
    const kind = handKind(item);
    const struck = view.struckHands.includes(hand);
    const selected =
      input.ui.mode === 'swap'
        ? input.ui.swapHand === hand
        : input.ui.stage === 'attack' && input.ui.mode === 'strike' && input.ui.hand === hand;
    return {
      hand,
      kind,
      itemKey: item?.key ?? null,
      meta: handMeta(item, struck, input),
      selected,
      disabled: handDisabled(kind, struck, view, input),
    };
  });
}

function actions(
  view: BattleProjection,
  self: BattleCreature,
  input: BattleViewInput,
): BattleActionView[] {
  const { rules, ui } = input;
  const will = view.turnWill;
  const entry = (id: BattleActionId, cost: number, blocked: boolean): BattleActionView => ({
    id,
    cost,
    selected: ui.mode === id,
    disabled: blocked || will < cost,
  });
  return [
    entry('push', rules.push, false),
    entry('pull', rules.pull, false),
    entry('swap', rules.swap, self.bag.length === 0),
  ];
}

function defendView(
  view: BattleProjection,
  self: BattleCreature,
  input: BattleViewInput,
): BattleDefendView {
  const { rules } = input;
  const strikes = view.pending.filter((s) => s.targetId === self.id);
  const shieldHand = BATTLE_HANDS.find((h) => !!self.hands[h]?.shieldCapacity);
  const capacity = Math.min(
    rules.maxShieldSides,
    BATTLE_HANDS.reduce((sum, h) => sum + (self.hands[h]?.shieldCapacity ?? 0), 0),
  );
  const placed = view.placedShields.length;
  return {
    strikes: strikes.length,
    attacker: strikes[0] ? input.nameOf(strikes[0].attackerId) : '',
    placed,
    capacity,
    shieldKey: shieldHand ? self.hands[shieldHand]!.key : null,
    shieldCost: rules.shieldPerSide,
    dodgeCost: rules.dodge,
    canBlock: placed > 0,
    canDodge: view.turnWill + placed * rules.shieldPerSide >= rules.dodge,
  };
}

function waitView(
  view: BattleProjection,
  self: BattleCreature,
  input: BattleViewInput,
): BattleWaitView | null {
  const active = creatureById(view, view.activeId);
  if (!active) return null;
  return {
    name: input.nameOf(active.id),
    init: view.draws[active.id] ?? 0,
    stance: view.stance[self.id] ?? 0,
  };
}

function cardState(
  view: BattleProjection,
  self: BattleCreature,
  input: BattleViewInput,
): BattleCardState {
  if (view.phase === 'ended') return view.outcome === 'victory' ? 'victory' : 'defeat';
  if (!isAlive(self)) return 'fallen';
  if (view.activeId !== self.id || !input.localHeroIds.includes(self.id)) return 'wait';
  return view.phase === 'defend' ? 'defend' : 'act';
}

function defaultActHint(
  mode: BattleUiMode,
  self: BattleCreature,
  input: BattleViewInput,
  targets: number,
): BattleMessage {
  if (mode === 'strike') {
    const item = input.ui.hand ? self.hands[input.ui.hand] : null;
    return targets && item
      ? { key: 'battle.hint.act.strike', params: { item: `content.battle.${item.key}.title` } }
      : { key: 'battle.hint.act.strikeNone' };
  }
  if (mode === 'swap') return { key: 'battle.hint.act.swap', params: { hand: input.ui.swapHand } };
  return { key: `battle.hint.act.${mode}` };
}

function cardHint(
  state: BattleCardState,
  self: BattleCreature,
  input: BattleViewInput,
  targets: number,
) {
  const last = battleHint(input.lastHeroEvents, input.nameOf);
  if (state === 'act') return last ?? defaultActHint(input.ui.mode, self, input, targets);
  return state === 'defend' ? last : null;
}

export function buildHeroCard(
  input: BattleViewInput,
  view: BattleProjection,
  self: BattleCreature,
  rows: BattleCreatureRow[],
): BattleHeroCard {
  const state = cardState(view, self, input);
  const targets = rows.filter((r) => r.targeted).length;
  const defending = state === 'defend';
  const stanceGain = defending ? Math.max(0, input.turnStartWill - input.rules.willPerTurn) : 0;
  return {
    row: rows.find((r) => r.id === self.id)!,
    state,
    will: state === 'act' || defending ? view.turnWill : 0,
    willCap: input.rules.willPerTurn + stanceGain,
    stanceGain,
    hands: hands(view, self, input),
    actions: actions(view, self, input),
    hint: cardHint(state, self, input, targets),
    canUndo: view.undo.length > 0,
    stanceNote: Math.min(input.rules.stanceMax, view.turnWill),
    plan: 0,
    stage: input.ui.stage,
    stages: stageViews(input.ui.stage),
    defend: defending ? defendView(view, self, input) : null,
    wait: state === 'wait' ? waitView(view, self, input) : null,
    bag: self.bag.map((item, index) => ({ index, key: item.key })),
  };
}
