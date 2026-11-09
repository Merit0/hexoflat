import { z } from 'zod';

export const CAMP_FIRST_CHEST_REWARD = 'camp-first-chest';

export const progressStateSchema = z
  .object({
    claimedRewards: z.array(z.string().min(1)).max(1000),
  })
  .strict();
export type ProgressState = z.infer<typeof progressStateSchema>;

export function emptyProgressState(): ProgressState {
  return { claimedRewards: [] };
}
