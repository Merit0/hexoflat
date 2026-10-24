import { computed, ref, watch } from 'vue';
import { BOARD_MODELS } from '@hexoflat/engine/content/boards/models/index';
import type { BoardRecipeInput } from '@hexoflat/engine/content/boards/recipe-schema';
import { adjustRuleCount } from '@hexoflat/engine/boards/board-model-edit';
import { runBoardPipeline } from '@hexoflat/engine/boards/pipeline/run-board-pipeline';
import { summarizeRules } from '@hexoflat/engine/boards/pipeline/trace';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { saveBoardModel } from '@/services/dev/board-model-save-client';

export function useBoardModelDraft() {
  const worldStore = useWorldMapStore();
  const panelStore = useDevBoardPanelStore();

  const draft = ref<BoardRecipeInput | null>(null);
  const hoveredRuleId = ref<string | null>(null);
  const status = ref<string | null>(null);
  const isSaving = ref(false);

  const descriptor = computed(() =>
    worldStore.descriptor?.kind === 'RECIPE' ? worldStore.descriptor : null,
  );
  const activeRecipe = computed(() =>
    descriptor.value ? (draft.value ?? BOARD_MODELS[descriptor.value.recipeId] ?? null) : null,
  );

  const preview = computed(() => {
    if (!descriptor.value || !activeRecipe.value) return null;
    try {
      return runBoardPipeline(activeRecipe.value, {
        seed: descriptor.value.seed,
        params: { ...panelStore.params },
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });

  const previewError = computed(() =>
    preview.value && 'error' in preview.value ? preview.value.error : null,
  );
  const rules = computed(() =>
    preview.value && 'trace' in preview.value ? summarizeRules(preview.value.trace) : [],
  );
  const measures = computed(() =>
    preview.value && 'measures' in preview.value ? preview.value.measures : null,
  );
  const isDirty = computed(() => draft.value !== null);
  const inspectedEntries = computed(() => {
    const coordinates = panelStore.inspectedCoordinates;
    const board = preview.value && 'trace' in preview.value ? preview.value : null;
    return coordinates && board ? [...board.trace.entriesAt(coordinates)] : [];
  });

  watch([hoveredRuleId, preview], () => {
    const board = preview.value && 'trace' in preview.value ? preview.value : null;
    panelStore.setHighlightedCellKeys(
      hoveredRuleId.value && board ? board.trace.ruleCellKeys(hoveredRuleId.value) : [],
    );
  });

  watch(descriptor, () => {
    draft.value = null;
    status.value = null;
  });

  function adjust(ruleId: string, delta: number): void {
    if (!activeRecipe.value) return;
    draft.value = adjustRuleCount(activeRecipe.value, ruleId, delta);
    status.value = null;
  }

  function reset(): void {
    draft.value = null;
    status.value = null;
  }

  function applyToBoard(): void {
    if (activeRecipe.value) worldStore.devRebuildFromRecipe(activeRecipe.value, panelStore.params);
  }

  async function save(): Promise<void> {
    if (!activeRecipe.value) return;
    isSaving.value = true;
    const result = await saveBoardModel(activeRecipe.value);
    isSaving.value = false;

    if (!result.ok) {
      status.value = result.reason ?? 'save failed';
      return;
    }
    applyToBoard();
    status.value = 'Збережено';
  }

  return {
    descriptor,
    rules,
    measures,
    previewError,
    isDirty,
    inspectedEntries,
    hoveredRuleId,
    status,
    isSaving,
    adjust,
    reset,
    applyToBoard,
    save,
  };
}
