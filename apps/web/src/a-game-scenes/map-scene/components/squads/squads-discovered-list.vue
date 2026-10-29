<template>
  <section class="discovered" data-testid="squads-discovered">
    <div class="discovered__will">{{ t('squad.prices', prices) }}</div>
    <div class="discovered__heading">{{ t('squad.discovered') }}</div>
    <p v-if="!rows.length" class="discovered__empty">{{ t('squad.nothingYet') }}</p>
    <div
      v-for="row in rows"
      :key="row.view.id"
      class="discovered__row"
      :data-testid="`squad-row-${row.view.id}`"
    >
      <battle-hex-token side="enemies" :kind="row.view.leaderKind" :init="null" />
      <div class="discovered__body">
        <span class="discovered__name">{{ t(row.view.title) }}</span>
        <span class="discovered__meta">{{ row.meta }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMeta } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { SquadView } from '@hexoflat/engine/squads/squad-state';
import { useSquadViews } from '@/services/squads/squad-views';
import BattleHexToken from '@/a-game-scenes/map-scene/components/battle/battle-hex-token.vue';

const { t } = useI18n();
const { views } = useSquadViews();
const squadActions = getMeta(HEXOBJECT_KEYS.LONE_SKELETON).actions;
const prices = {
  attack: squadActions?.[EHexActionType.ATTACK]?.willCost ?? 0,
  scout: squadActions?.[EHexActionType.SCOUT]?.willCost ?? 0,
  step: 1,
};

function describe(view: SquadView): string {
  const known = view.members.filter((m): m is string => !!m);
  const leader = t(`content.battle.${view.leaderKind}.title`);
  const unknown = view.members.length - known.length;
  const parts = [t('squad.enemies', { count: view.count })];
  parts.push(unknown ? t('squad.leaderAndUnknown', { leader, unknown }) : leader);
  if (view.watcher) parts.push(t('squad.watcher'));
  return parts.join(' · ');
}

const rows = computed(() => views.value.map((view) => ({ view, meta: describe(view) })));
</script>

<style scoped>
.discovered {
  display: grid;
  gap: 8px;
}
.discovered__will {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #36424a;
  background: #121517;
  color: #cbbfa6;
  font-size: 0.85rem;
}
.discovered__heading {
  color: #f08a7a;
  font-family: Cinzel, serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.discovered__empty {
  margin: 0;
  color: #8e9599;
  font-size: 0.85rem;
}
.discovered__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 12px;
  background: #262e33;
  border: 1px solid #36424a;
}
.discovered__body {
  flex: 1;
  display: grid;
}
.discovered__name {
  color: #e8d7a8;
  font-family: Cinzel, serif;
  font-weight: 700;
}
.discovered__meta {
  color: #8e9599;
  font-size: 0.8rem;
}
</style>
