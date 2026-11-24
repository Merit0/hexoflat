import { baseItemKeySchema } from '../tokens/base-item';
import { z } from 'zod';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { uniqueDropRulesSchema } from '../tokens/unique-drop';
import type { ItemToken } from '../tokens/token-schema';

const itemKeys = Object.values(HEXOBJECT_KEYS) as [THexobjectKey, ...THexobjectKey[]];

const amountRangeSchema = z
  .tuple([z.number().int().min(1), z.number().int().min(1)])
  .refine(([min, max]) => min <= max, { message: 'amount min must not exceed max' });

export const lootEntrySchema = z.object({
  itemKey: z.enum(itemKeys),
  amount: amountRangeSchema,
  baseKey: baseItemKeySchema.optional(),
});
export type LootEntry = z.infer<typeof lootEntrySchema>;

export const weightedLootEntrySchema = lootEntrySchema.extend({
  weight: z.number().int().positive(),
});
export type WeightedLootEntry = z.infer<typeof weightedLootEntrySchema>;

const rollsSchema = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([min, max]) => min <= max, { message: 'rolls min must not exceed max' });

export const lootTableSchema = z
  .object({
    id: z.string().min(1),
    rolls: rollsSchema,
    guaranteed: z.array(lootEntrySchema).optional(),
    entries: z.array(weightedLootEntrySchema),
    uniqueDrops: uniqueDropRulesSchema.optional(),
    alienRoll: z.boolean().optional(),
  })
  .refine((table) => table.entries.length > 0 || table.rolls[1] === 0, {
    message: 'a table that rolls needs at least one entry',
    path: ['entries'],
  });
export type LootTable = z.infer<typeof lootTableSchema>;

export interface LootDrop {
  itemKey: THexobjectKey;
  amount: number;
  guaranteed: boolean;
  token?: ItemToken;
  baseKey?: string;
}
