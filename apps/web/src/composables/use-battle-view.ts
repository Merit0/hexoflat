import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleCreature, BattleHand, BattleHex } from '@hexoflat/engine/battle/battle-state';
import { creatureById } from '@hexoflat/engine/battle/battle-board';
import { useBattleStore } from '@/stores/battle-store';
import { battleTapActions, controlledHero } from './battle-board-tap';
import type { BattleMessage } from './battle-hint';
import { freeStrikeHand, type BattleActionId } from './battle-hero-card';
import { buildBattleView } from './battle-view';
import type { BattleUiState } from './battle-view-types';

const ui = reactive<BattleUiState>({ mode: 'move', hand: null, swapHand: 'left' });

export function resetBattleUi(): void {
  ui.mode = 'move';
  ui.hand = null;
  ui.swapHand = 'left';
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
      hand: ui.hand,
      hex,
      rules: BATTLE_RULES,
    });
    if (!actions.length) return;
    const accepted = store.actAll(actions);
    if (accepted && ui.mode !== 'move' && ui.mode !== 'swap') resetBattleUi();
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
    if (!item?.power) return;
    const on = ui.mode === 'strike' && ui.hand === hand;
    ui.mode = on ? 'move' : 'strike';
    ui.hand = on ? null : hand;
  }

  function pickAction(id: BattleActionId) {
    const hero = self();
    if (!hero || !store.projection) return;
    if (ui.mode === id) {
      resetBattleUi();
      return;
    }
    ui.mode = id;
    ui.hand = id === 'strike' ? freeStrikeHand(store.projection, hero) : null;
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

  return {
    view,
    ui,
    tapHex,
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
