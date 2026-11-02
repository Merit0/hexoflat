import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import {
  BATTLE_HANDS,
  type BattleCreature,
  type BattleHand,
  type BattleHex,
} from '@hexoflat/engine/battle/battle-state';
import { creatureById, isAlive, livingCreatureAt } from '@hexoflat/engine/battle/battle-board';
import { useBattleStore } from '@/stores/battle-store';
import { battleMovePreview, battleTapActions, controlledHero } from './battle-board-tap';
import { useBattleWarnings } from './use-battle-warnings';
import type { BattleMessage } from './battle-hint';
import type { BattleActionId } from './battle-hero-card';
import { stageMode, type BattleStage } from './battle-stage';
import { buildBattleView } from './battle-view';
import { weaponHandsLeft } from './battle-tool-hex';
import type { BattleUiState } from './battle-view-types';

const ui = reactive<BattleUiState>({
  stage: 'move',
  mode: 'move',
  hand: null,
  swapHand: 'left',
  hover: null,
  toolAt: null,
  selectedId: null,
});

export function resetBattleUi(): void {
  ui.stage = 'move';
  ui.mode = 'move';
  ui.hand = null;
  ui.swapHand = 'left';
  ui.hover = null;
  ui.toolAt = null;
  ui.selectedId = null;
}

export function activateBattleHand(hand: BattleHand): void {
  ui.stage = 'action';
  ui.mode = stageMode('action');
  ui.hand = hand;
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
  const { warn, send, lockedWarning } = useBattleWarnings();
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
      revealedShields: store.revealedShields,
      animating: store.animating,
      ui: { ...ui },
      rules: BATTLE_RULES,
      nameOf,
    }),
  );

  function self(): BattleCreature | null {
    return controlledHero(store.projection, store.localHeroIds);
  }

  function act(action: BattleAction): boolean {
    return send(() => store.act(action));
  }

  function goStage(stage: BattleStage) {
    ui.stage = stage;
    ui.mode = stageMode(stage);
    ui.hand = null;
    ui.toolAt = null;
  }

  function tapHex(hex: BattleHex) {
    if (lockedWarning()) return;
    const moving = ui.stage === 'action' && ui.mode === 'strike';
    const actions = battleTapActions({
      projection: store.projection,
      localHeroIds: store.localHeroIds,
      mode: moving ? 'move' : ui.mode,
      hex,
      rules: BATTLE_RULES,
    });
    if (!actions.length) {
      if (selectFoeAt(hex)) return;
      if (store.projection?.phase === 'defend') warn('WRONG_PHASE', null);
      else warnUnaffordable(hex);
      return;
    }
    ui.hover = null;
    if (moving) goStage('move');
    const accepted = send(() => store.actAll(actions));
    if (accepted && ui.mode !== 'move' && ui.mode !== 'swap') resetBattleUi();
  }

  function selectFoeAt(hex: BattleHex): boolean {
    const projection = store.projection;
    if (!projection || projection.phase === 'ended') return false;
    const foe = livingCreatureAt(projection, hex);
    if (!foe || foe.side === projection.viewer) return false;
    ui.selectedId = foe.id;
    ui.toolAt = null;
    return true;
  }

  function selectEnemy(id: string) {
    const projection = store.projection;
    if (!projection || projection.phase === 'ended') return;
    const foe = creatureById(projection, id);
    if (!foe || foe.side === projection.viewer || !isAlive(foe)) return;
    ui.selectedId = id;
    ui.toolAt = null;
  }

  function warnUnaffordable(hex: BattleHex) {
    if (ui.mode !== 'move' && !(ui.stage === 'action' && ui.mode === 'strike')) return;
    const route = battleMovePreview({
      projection: store.projection,
      localHeroIds: store.localHeroIds,
      mode: 'move',
      hex,
      rules: BATTLE_RULES,
    });
    if (route && !route.reachable) warn('INSUFFICIENT_WILL', route.cost);
  }

  function pickHand(hand: BattleHand) {
    const hero = self();
    if (!hero) return;
    if (ui.mode === 'swap') {
      ui.swapHand = hand;
      return;
    }
    if (hero.hands[hand]?.usePrice) {
      act({ kind: 'use-item', hand });
      resetBattleUi();
      return;
    }
    goStage('action');
    ui.hand = hand;
  }

  function pickAction(id: BattleActionId) {
    const hero = self();
    if (!hero || !store.projection) return;
    if (ui.mode === id) {
      resetBattleUi();
      return;
    }
    ui.stage = 'action';
    ui.mode = id;
    ui.hand = null;
  }

  function cycleHand(direction: 1 | -1) {
    const hero = self();
    if (!hero || store.projection?.phase !== 'act' || store.inputLocked) return;
    if (ui.stage !== 'action' || ui.mode !== 'strike') {
      goStage('action');
      ui.hand = BATTLE_HANDS[0];
      return;
    }
    const at = ui.hand ? BATTLE_HANDS.indexOf(ui.hand) : 0;
    ui.hand = BATTLE_HANDS[(at + direction + BATTLE_HANDS.length) % BATTLE_HANDS.length];
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
    if (hex && ui.mode === 'strike') ui.toolAt = hex;
  }

  function hideToolWhenNoWeaponLeft() {
    const projection = store.projection;
    const hero = self();
    if (!projection || !hero) return;
    if (weaponHandsLeft(projection, hero).length === 0) goStage('move');
  }

  function actWithTool() {
    if (lockedWarning()) return false;
    const tool = view.value.board?.tool;
    if (!tool?.action) return false;
    if (tool.action === 'attack' && tool.targetId) {
      const struck = act({ kind: 'strike', targetId: tool.targetId, hand: tool.hand });
      if (struck) hideToolWhenNoWeaponLeft();
      return struck;
    }
    if (tool.action === 'block') return act({ kind: 'place-shield', hex: tool.at });
    if (tool.action === 'use') return act({ kind: 'use-item', hand: tool.hand });
    return act({ kind: 'remove-shield', hex: tool.at });
  }

  return {
    view,
    ui,
    tapHex,
    selectEnemy,
    hoverHex,
    actWithTool,
    closeTool: () => goStage('move'),
    goStage,
    cycleHand,
    pickHand,
    pickAction,
    swapFrom,
    endTurn,
    start,
    leave,
    undo: () => act({ kind: 'undo-step' }),
    takeHit: () => act({ kind: 'take-hit' }),
    answer: (option: number) => act({ kind: 'answer-task', option }),
    timeout: () => act({ kind: 'task-timeout' }),
  };
}
