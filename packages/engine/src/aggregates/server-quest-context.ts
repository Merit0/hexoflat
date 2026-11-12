import { standsNextToCampObject } from '../content/boards/camp-object-spot';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { QuestApplyContext } from './apply-quest-command';
import type { Presence } from './progress-state';

export function serverQuestContext(presence: Presence | null): QuestApplyContext {
  return { atBoard: standsNextToCampObject(presence, HEXOBJECT_KEYS.QUEST_BOARD) };
}
