import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleCreature, BattleHand, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { creatureById } from '@hexoflat/engine/battle/battle-board';
import { useBattleStore } from '@/stores/battle-store';
import { battleTapActions, controlledHero } from './battle-board-tap';
import type { BattleMessage } from './battle-hint';
import type { BattleActionId } from './battle-hero-card';
import {
  BATTLE_STAGES,
  handFitsStage,
  stageHands,
  stageMode,
  type BattleStage,
} from './battle-stage';
import { buildBattleView } from './battle-view';
import type { BattleUiState } from './battle-view-types';

const ui = reactive<BattleUiState>({
  stage: 'attack',
  mode: 'strike',
  hand: null,
  swapHand: 'left',
  hover: null,
  toolAt: null,
});

export function resetBattleUi(): void {
  ui.stage = 'attack';
  ui.mode = 'strike';
  ui.hand = null;
  ui.swapHand = 'left';
  ui.hover = null;
  ui.toolAt = null;
}

const TRANSLATED_PARAM = /^(battle|content)\./;

export function useBattleText() {
  const { t } = useI18n();
  function text(message: BattleMessage | null): string {
    if (!message) return '';
    const params = Object.fromEntries(
      Object.entries(message.params ?? {}).map(([k, v]) => [
        k,
        typeof v === 'string' && TRANSLATED_PARAM.test(v) ? t(v) : v,
      ]),
    );
    return t(message.key, params);
  }
  return { t, text };
}

export function useBattleView() {
  const store = useBattleStore();
  const { t } = useI18n();

  function creatureOf(id: string): BattleCreature | null {
    const fromBattle = store.projection ? creatureById(store.projection, id) : null;
    const fromDeploy = (store.deploy?.setup.creatures as BattleCreature[] | undefined)?.find(
      (c) => c.id === id,
    );
    return fromBattle ?? fromDeploy ?? null;
  }

  function nameOf(id: string): string {
    const named = store.deploy?.names[id];
    if (named) return named;
    const creature = creatureOf(id);
    return creature ? t(`content.battle.${creature.kind}.title`) : id;
  }

  const view = computed(() =>
    buildBattleView({
      deploy: store.deploy,
      projection: store.projection,
      localHeroIds: store.localHeroIds,
      lastHeroEvents: store.lastHeroEvents,
      turnStartWill: store.turnStartWill,
      ui: { ...ui },
      rules: BATTLE_RULES,
      nameOf,
    }),
  );

  function self(): BattleCreature | null {
    return controlledHero(store.projection, store.localHeroIds);
  }

  function act(action: BattleAction): boolean {
    return store.act(action);
  }

  function tapHex(hex: BattleHex) {
    const actions = battleTapActions({
      projection: store.projection,
      localHeroIds: store.localHeroIds,
      mode: ui.mode,
      hex,
      rules: BATTLE_RULES,
    });
    if (!actions.length) return;
    ui.hover = null;
    const accepted = store.actAll(actions);
    if (accepted && ui.mode !== 'move' && ui.mode !== 'swap') resetBattleUi();
  }

  function goStage(stage: BattleStage) {
    ui.stage = stage;
    ui.mode = stageMode(stage);
    ui.hand = null;
    ui.toolAt = null;
  }

  function nextStage() {
    const next = BATTLE_STAGES[BATTLE_STAGES.indexOf(ui.stage) + 1];
    if (next) goStage(next);
  }

  function pickHand(hand: BattleHand) {
    const hero = self();
    if (!hero) return;
    if (ui.mode === 'swap') {
      ui.swapHand = hand;
      return;
    }
    const item = hero.hands[hand];
    if (item?.heal) {
      act({ kind: 'use-item', hand });
      resetBattleUi();
      return;
    }
    if (!handFitsStage(item, 'attack')) return;
    ui.stage = 'attack';
    ui.mode = 'strike';
    ui.hand = hand;
  }

  function pickAction(id: BattleActionId) {
    const hero = self();
    if (!hero || !store.projection) return;
    if (ui.mode === id) {
      resetBattleUi();
      return;
    }
    ui.mode = id;
    ui.hand = null;
  }

  function cycleHand(direction: 1 | -1) {
    const hero = self();
    if (!hero || store.projection?.phase !== 'act' || store.animating) return;
    if (ui.stage === 'move' || (ui.stage === 'attack' && ui.mode !== 'strike')) return;
    const usable = stageHands(hero, ui.stage);
    if (!usable.length) return;
    const at = ui.hand ? usable.indexOf(ui.hand) : -1;
    ui.hand = usable[(at + direction + usable.length) % usable.length] ?? usable[0];
  }

  function swapFrom(bagIndex: number) {
    if (act({ kind: 'swap-item', hand: ui.swapHand, bagIndex })) resetBattleUi();
  }

  function endTurn() {
    if (act({ kind: 'end-turn' })) resetBattleUi();
  }

  function start() {
    resetBattleUi();
    store.start();
  }

  function leave() {
    resetBattleUi();
    store.leave();
  }

  function hoverHex(hex: BattleHex | null) {
    ui.hover = hex;
    if (hex && (ui.mode === 'strike' || ui.mode === 'block')) ui.toolAt = hex;
  }

  function actWithTool() {
    const tool = view.value.board?.tool;
    if (!tool?.action) return false;
    if (tool.action === 'attack' && tool.targetId)
      return store.act({ kind: 'strike', targetId: tool.targetId, hand: tool.hand });
    if (tool.action === 'block') return store.act({ kind: 'place-shield', hex: tool.at });
    return store.act({ kind: 'remove-shield', hex: tool.at });
  }

  return {
    view,
    ui,
    tapHex,
    hoverHex,
    actWithTool,
    nextStage,
    goStage,
    cycleHand,
    pickHand,
    pickAction,
    swapFrom,
    endTurn,
    start,
    leave,
    undo: () => act({ kind: 'undo-step' }),
    block: () => act({ kind: 'confirm-block' }),
    dodge: () => act({ kind: 'start-dodge' }),
    takeHit: () => act({ kind: 'take-hit' }),
    answer: (option: number) => act({ kind: 'answer-task', option }),
    timeout: () => act({ kind: 'task-timeout' }),
  };
}
