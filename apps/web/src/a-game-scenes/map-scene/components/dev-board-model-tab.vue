<template>
  <section v-if="model.descriptor.value" class="model-tab" data-testid="dev-model-tab">
    <header class="model-tab__header">Модель</header>

    <p v-if="model.previewError.value" class="model-tab__error" data-testid="dev-model-error">
      {{ model.previewError.value }}
    </p>

    <table class="model-tab__rules">
      <thead>
        <tr>
          <th>Правило</th>
          <th>Хотіли</th>
          <th>Поставили</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="rule in model.rules.value"
          :key="rule.ruleId"
          :class="{ 'model-tab__rule--short': rule.outcome === 'short' }"
          :title="rule.note"
          :data-testid="`dev-model-rule-${rule.ruleId}`"
          @mouseenter="model.hoveredRuleId.value = rule.ruleId"
          @mouseleave="model.hoveredRuleId.value = null"
        >
          <td>{{ rule.ruleId }}</td>
          <td>{{ rule.wanted }}</td>
          <td>{{ rule.placed }}</td>
          <td class="model-tab__buttons">
            <button
              type="button"
              :data-testid="`dev-model-minus-${rule.ruleId}`"
              @click="model.adjust(rule.ruleId, -1)"
            >
              −
            </button>
            <button
              type="button"
              :data-testid="`dev-model-plus-${rule.ruleId}`"
              @click="model.adjust(rule.ruleId, 1)"
            >
              +
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ul class="model-tab__notes">
      <li v-for="rule in notedRules" :key="rule.ruleId">{{ rule.ruleId }}: {{ rule.note }}</li>
    </ul>

    <label class="model-tab__inspect">
      <input
        type="checkbox"
        data-testid="dev-model-inspect-toggle"
        :checked="panelStore.inspectMode"
        @change="panelStore.toggleInspectMode()"
      />
      Слід по кліку
    </label>

    <div
      v-if="panelStore.inspectMode && panelStore.inspectedCoordinates"
      class="model-tab__trace"
      data-testid="dev-model-trace"
    >
      <div>
        {{ panelStore.inspectedCoordinates.columnIndex }}:{{
          panelStore.inspectedCoordinates.rowIndex
        }}
      </div>
      <div v-if="!model.inspectedEntries.value.length">— нічого не створило цей гекс</div>
      <div v-for="(entry, index) in model.inspectedEntries.value" :key="index">
        {{ entry.stage }} / {{ entry.pieceId }}
        <template v-if="entry.ruleId"> / {{ entry.ruleId }}</template>
        <template v-if="entry.note"> — {{ entry.note }}</template>
      </div>
    </div>

    <div class="model-tab__params">
      <label>
        tier
        <select v-model.number="panelStore.params.tier" data-testid="dev-model-tier">
          <option v-for="value in PARAM_VALUES" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <label>
        partySize
        <select v-model.number="panelStore.params.partySize" data-testid="dev-model-party-size">
          <option v-for="value in PARAM_VALUES" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
    </div>

    <div class="model-tab__actions">
      <button type="button" data-testid="dev-model-other-seed" @click="worldStore.devNextSeed()">
        Інший сід
      </button>
      <button
        type="button"
        :disabled="!model.isDirty.value"
        data-testid="dev-model-apply"
        @click="model.applyToBoard()"
      >
        Перебудувати
      </button>
      <button
        type="button"
        :disabled="!model.isDirty.value"
        data-testid="dev-model-reset"
        @click="model.reset()"
      >
        Скинути
      </button>
      <button
        type="button"
        :disabled="!model.isDirty.value || model.isSaving.value"
        data-testid="dev-model-save"
        @click="model.save()"
      >
        Зберегти
      </button>
    </div>

    <p v-if="model.status.value" class="model-tab__status" data-testid="dev-model-status">
      {{ model.status.value }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useBoardModelDraft } from '@/composables/use-board-model-draft';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { useWorldMapStore } from '@/stores/world-map-store';

const PARAM_VALUES = [1, 2, 3, 4];

const model = useBoardModelDraft();
const panelStore = useDevBoardPanelStore();
const worldStore = useWorldMapStore();

const notedRules = computed(() => model.rules.value.filter((rule) => rule.outcome !== 'placed'));
</script>

<style scoped>
.model-tab {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-tab__header {
  font-weight: bold;
  opacity: 0.8;
}

.model-tab__rules {
  border-collapse: collapse;
  width: 100%;
}

.model-tab__rules th,
.model-tab__rules td {
  text-align: left;
  padding: 1px 4px;
}

.model-tab__rules tbody tr:hover {
  background: rgb(255 255 255 / 15%);
}

.model-tab__rule--short td {
  color: #ffb4a2;
}

.model-tab__buttons {
  display: flex;
  gap: 2px;
}

.model-tab__notes {
  margin: 0;
  padding-left: 14px;
  opacity: 0.8;
}

.model-tab__params,
.model-tab__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.model-tab__trace {
  padding: 2px 4px;
  background: rgb(255 255 255 / 10%);
}

.model-tab__error {
  margin: 0;
  color: #ffb4a2;
}

.model-tab__status {
  margin: 0;
}
</style>
