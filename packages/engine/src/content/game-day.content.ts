import { z } from 'zod';

const threshold = z.number().int().positive();
const rulesSchema = z
  .object({
    willSpent: threshold,
    questsCompleted: threshold,
    caveTrips: threshold,
  })
  .strict();

export const GAME_DAY_RULES = Object.freeze(
  rulesSchema.parse({ willSpent: 150, questsCompleted: 5, caveTrips: 3 }),
);
