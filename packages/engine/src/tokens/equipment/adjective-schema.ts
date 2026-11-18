import { z } from 'zod';
import {
  ADJECTIVE_BANDS,
  distinctValues,
  itemGroupSchema,
  materialSchema,
  type TItemGroup,
  type TMaterial,
} from './equipment-keys';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const wordSchema = z.string().trim().min(1);

export const adjectiveSchema = z
  .strictObject({
    key: z.string().regex(SLUG),
    band: z.enum(ADJECTIVE_BANDS),
    material: materialSchema.optional(),
    groups: z
      .array(itemGroupSchema)
      .min(1)
      .refine(distinctValues, 'a group is listed twice')
      .optional(),
    en: wordSchema,
    uk: z.strictObject({ m: wordSchema, f: wordSchema, n: wordSchema, pl: wordSchema }),
  })
  .refine(
    (adjective) => adjective.band !== 'plain' || adjective.material !== undefined,
    'a plain adjective names a material',
  );
export type Adjective = z.infer<typeof adjectiveSchema>;

export interface AdjectiveTarget {
  group: TItemGroup;
  materials: readonly TMaterial[];
}

export function adjectiveFits(adjective: Adjective, target: AdjectiveTarget): boolean {
  if (adjective.material !== undefined && !target.materials.includes(adjective.material)) {
    return false;
  }
  return adjective.groups === undefined || adjective.groups.includes(target.group);
}
