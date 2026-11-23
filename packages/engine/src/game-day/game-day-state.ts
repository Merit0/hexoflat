import { z } from 'zod';

const counter = z.number().int().nonnegative();

export const gameDaySchema = z
  .object({
    id: z.number().int().positive(),
    startedAt: counter,
    willSpent: counter,
    questsCompleted: counter,
    caveTrips: counter,
  })
  .strict();

export type GameDay = z.infer<typeof gameDaySchema>;
