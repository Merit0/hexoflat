import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';

export function recoverStepPosition(
  state: KnowledgeState | null,
  mapId: string,
  savedRevision = -1,
) {
  const receipt = state?.lastStep;
  if (!receipt || receipt.mapId !== mapId || receipt.revision <= savedRevision) return null;
  return { columnIndex: receipt.columnIndex, rowIndex: receipt.rowIndex };
}
