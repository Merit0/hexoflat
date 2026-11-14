import { BOARD_QUESTS, catalogueOf } from './quests.content';
import { SEEKER_QUESTS } from './seeker-quests';

export const ALL_QUESTS = catalogueOf([...BOARD_QUESTS, ...SEEKER_QUESTS]);
