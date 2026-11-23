import { BOARD_QUESTS, catalogueOf } from './quests.content';
import { SEEKER_QUESTS } from './seeker-quests';

export const ALL_QUEST_DEFINITIONS = [...BOARD_QUESTS, ...SEEKER_QUESTS];
export const ALL_QUESTS = catalogueOf(ALL_QUEST_DEFINITIONS);
