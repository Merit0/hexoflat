import {
  createKnowledgeState,
  knowledgeStateSchema,
  type KnowledgeState,
} from '@hexoflat/engine/knowledge/state';

const key = (heroId: string) => `hexoflat:knowledge:v1:${heroId}`;

export function readKnowledge(heroId: string): KnowledgeState {
  const raw = localStorage.getItem(key(heroId));
  // Additive migration: only an absent record gets the starting wallet.
  if (raw === null) return createKnowledgeState(heroId);
  const parsed = knowledgeStateSchema.parse(JSON.parse(raw));
  if (parsed.heroId !== heroId) throw new Error('Knowledge save identity mismatch');
  return parsed;
}

export function writeKnowledge(state: KnowledgeState): void {
  localStorage.setItem(key(state.heroId), JSON.stringify(state));
}

/** Web Locks serialize read/validate/write across tabs, not just this component. */
export async function transactKnowledge(
  heroId: string,
  update: (state: KnowledgeState) => boolean,
): Promise<KnowledgeState> {
  const commit = () => {
    const state = readKnowledge(heroId);
    if (update(state)) writeKnowledge(state);
    return state;
  };
  if (navigator.locks) return navigator.locks.request(key(heroId), commit);
  // Fail closed: an unsafe cross-tab claim is worse than asking for a supported browser.
  throw new Error('This browser does not support safe saved challenge transactions.');
}

export function recoverStepPosition(
  state: KnowledgeState | null,
  mapId: string,
  savedRevision = -1,
) {
  const receipt = state?.lastStep;
  if (!receipt || receipt.mapId !== mapId || receipt.revision <= savedRevision) return null;
  return { columnIndex: receipt.columnIndex, rowIndex: receipt.rowIndex };
}
