import { z } from 'zod';

export const HeroDataSchema = z.object({
  currentHealth: z.number(),
  maxHealth: z.number(),
  attack: z.number(),
  defense: z.number(),
  coins: z.number(),
  kills: z.number(),
  currentEnergy: z.number(),
  maxEnergy: z.number(),
  imgPath: z.string(),
  heroLocation: z.object({ columnIndex: z.number(), rowIndex: z.number() }),
  heroSteps: z.number(),
});
export type HeroData = z.infer<typeof HeroDataSchema>;
