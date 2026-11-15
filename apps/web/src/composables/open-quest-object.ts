import type { THexobject } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { openKnowledgePanel } from './use-knowledge-panel';

export function openQuestObject(object: THexobject | null): boolean {
  if (object?.hexobjectKey === HEXOBJECT_KEYS.QUEST_BOARD) {
    openKnowledgePanel('quests');
    return true;
  }
  return false;
}
