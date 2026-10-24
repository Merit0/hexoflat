import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { useBoardModelDraft } from './use-board-model-draft';

describe('useBoardModelDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useWorldMapStore().loadLocationMap('cave');
  });

  it('lists every rule of the current cave with wanted and placed counts', () => {
    const model = useBoardModelDraft();

    expect(model.rules.value.map((rule) => rule.ruleId)).toEqual([
      'rocks',
      'rest',
      'treasure',
      'guard',
    ]);
    for (const rule of model.rules.value) expect(rule.wanted).toBeGreaterThanOrEqual(rule.placed);
  });

  it('adjust marks the draft dirty and changes the preview; reset brings the model back', () => {
    const model = useBoardModelDraft();
    const before = model.rules.value.find((rule) => rule.ruleId === 'rocks')?.placed ?? 0;

    model.adjust('rocks', 3);
    const after = model.rules.value.find((rule) => rule.ruleId === 'rocks')?.placed ?? 0;

    expect(model.isDirty.value).toBe(true);
    expect(after).toBeGreaterThan(before);

    model.reset();
    expect(model.isDirty.value).toBe(false);
    expect(model.rules.value.find((rule) => rule.ruleId === 'rocks')?.placed).toBe(before);
  });

  it('hovering a rule highlights exactly the cells that rule placed', async () => {
    const model = useBoardModelDraft();
    const panelStore = useDevBoardPanelStore();
    const rocks = model.rules.value.find((rule) => rule.ruleId === 'rocks');

    model.hoveredRuleId.value = 'rocks';
    await nextTick();
    expect(panelStore.highlightedCellKeys).toHaveLength(rocks?.placed ?? -1);

    model.hoveredRuleId.value = null;
    await nextTick();
    expect(panelStore.highlightedCellKeys).toEqual([]);
  });

  it('a different tier is passed to the preview params', () => {
    const model = useBoardModelDraft();
    const panelStore = useDevBoardPanelStore();

    panelStore.params.tier = 3;

    expect(model.previewError.value).toBeNull();
    expect(model.rules.value.length).toBeGreaterThan(0);
  });

  it('inspecting a cell returns the trace entries that created it', () => {
    const model = useBoardModelDraft();
    const panelStore = useDevBoardPanelStore();
    const rockKey = model.rules.value.find((rule) => rule.ruleId === 'rocks');
    expect(rockKey?.placed).toBeGreaterThan(0);

    const hovered = useWorldMapStore().map?.tiles.find(
      (tile) => tile.hexobject?.hexobjectKey === 'rock',
    );
    panelStore.inspect(hovered!.coordinates);

    const stages = model.inspectedEntries.value.map((entry) => entry.stage);
    expect(stages).toContain('objects');
    expect(model.inspectedEntries.value.some((entry) => entry.ruleId === 'rocks')).toBe(true);
  });

  it('toggling inspect mode clears the inspected cell', () => {
    const panelStore = useDevBoardPanelStore();
    panelStore.inspect({ columnIndex: 3, rowIndex: 3 });

    panelStore.toggleInspectMode();

    expect(panelStore.inspectMode).toBe(true);
    expect(panelStore.inspectedCoordinates).toBeNull();
  });
});
