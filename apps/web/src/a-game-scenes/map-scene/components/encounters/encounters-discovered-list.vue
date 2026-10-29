<template>
  <section class="discovered" data-testid="encounters-discovered">
    <div class="discovered__will">{{ t('encounter.prices', prices) }}</div>
    <div class="discovered__heading">{{ t('encounter.discovered') }}</div>
    <p v-if="!rows.length" class="discovered__empty">{{ t('encounter.nothingYet') }}</p>
    <div
      v-for="row in rows"
      :key="row.view.id"
      class="discovered__row"
      :data-testid="row.isLoot ? `loot-token-${row.view.id}` : `encounter-token-${row.view.id}`"
    >
      <encounter-token
        :leader-kind="row.view.leaderKind"
        :count="row.view.count"
        :threat="row.view.threat"
        :scouted="row.view.scouted"
        :sentry="row.view.sentry"
        :boss="row.view.boss"
        :is-loot="row.isLoot"
        size="list"
      />
      <div class="discovered__body">
        <span class="discovered__name">{{ t(row.view.title) }}</span>
        <span class="discovered__meta">{{ row.meta }}</span>
      </div>
      <span v-if="!row.isLoot" class="discovered__threat" :class="`is-${row.view.threat}`">
        {{ t(`encounter.threat.${row.view.threat}`) }}
      </span>
    </div>
    <div class="discovered__hint">{{ t('encounter.hint') }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMeta } from '@hexoflat/engine';
import { ENCOUNTER_RULES } from '@hexoflat/engine/encounters/encounter-content';
import type { EncounterView } from '@hexoflat/engine/encounters/encounter-state';
import { useEncounterStore } from '@/stores/encounter-store';
import EncounterToken from './encounter-token.vue';

const { t } = useI18n();
const store = useEncounterStore();
const prices = { attack: ENCOUNTER_RULES.attackWill, scout: ENCOUNTER_RULES.scoutWill, step: 1 };

function describe(view: EncounterView): string {
  if (view.status === 'loot') {
    const items = view.loot.map((key) => getMeta(key)?.title ?? key).join(', ');
    return t('encounter.lootWaiting', { items });
  }
  const known = view.members.filter((m): m is string => !!m);
  const leader = t(`content.battle.${view.leaderKind}.title`);
  const unknown = view.members.length - known.length;
  const parts = [t('encounter.enemies', { count: view.count })];
  parts.push(unknown ? t('encounter.leaderAndUnknown', { leader, unknown }) : leader);
  if (view.sentry) parts.push(t('encounter.sentry'));
  return parts.join(' · ');
}

const rows = computed(() =>
  store.views.map((view) => ({ view, isLoot: view.status === 'loot', meta: describe(view) })),
);
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
.discovered__threat {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}
.discovered__threat.is-easy {
  color: #a8c98e;
}
.discovered__threat.is-risky {
  color: #f0c060;
}
.discovered__threat.is-deadly {
  color: #f07a6a;
}
.discovered__hint {
  color: #8e9599;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
