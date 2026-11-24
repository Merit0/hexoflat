import { z } from 'zod';
import {
  DEFAULT_HERO_ORIGIN,
  heroOriginRefusal,
  heroOriginSchema,
} from '@hexoflat/engine/dimensions/hero-origin';

const fields = {
  currentHealth: z.number(),
  maxHealth: z.number(),
  attack: z.number(),
  defense: z.number(),
  kills: z.number(),
  currentEnergy: z.number(),
  maxEnergy: z.number(),
  imgPath: z.string(),
  heroLocation: z.object({ columnIndex: z.number(), rowIndex: z.number() }),
  heroSteps: z.number(),
};

export const HeroDataSchema = z.strictObject({
  ...fields,
  origin: heroOriginSchema.default(DEFAULT_HERO_ORIGIN),
});
export type HeroData = z.infer<typeof HeroDataSchema>;

const StoredHeroDataSchema = HeroDataSchema.strip();
const HeroDataPatchSchema = z.strictObject({ ...fields, origin: heroOriginSchema }).partial();
export type HeroDataPatch = Partial<Omit<HeroData, 'origin'>>;

export type HeroDataErrorCode =
  'HERO_ORIGIN_IMMUTABLE' | 'HERO_DATA_UNKNOWN_FIELD' | 'HERO_DATA_INVALID';

export class HeroDataError extends Error {
  constructor(
    readonly code: HeroDataErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

function invalid(error: z.ZodError): HeroDataError {
  const unknown = error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys' ? issue.keys : [],
  );
  return unknown.length > 0
    ? new HeroDataError('HERO_DATA_UNKNOWN_FIELD', unknown.join(', '))
    : new HeroDataError('HERO_DATA_INVALID', z.prettifyError(error));
}

export function readHeroData(stored: unknown): { data: HeroData; unknownKeys: string[] } {
  const parsed = StoredHeroDataSchema.safeParse(stored);
  if (!parsed.success) throw invalid(parsed.error);
  const unknownKeys = Object.keys(stored as object).filter(
    (key) => !Object.hasOwn(HeroDataSchema.shape, key),
  );
  return { data: parsed.data, unknownKeys };
}

export function newHeroData(data: HeroData): HeroData {
  const parsed = HeroDataSchema.safeParse(data);
  if (!parsed.success) throw invalid(parsed.error);
  return parsed.data;
}

export function mergeHeroData(stored: unknown, patch: unknown): Record<string, unknown> {
  const { data } = readHeroData(stored);
  const parsed = HeroDataPatchSchema.safeParse(patch);
  if (!parsed.success) throw invalid(parsed.error);
  const refusal = heroOriginRefusal(data.origin, parsed.data.origin);
  if (refusal) throw new HeroDataError(refusal, `${data.origin} -> ${parsed.data.origin}`);
  const merged = { ...(stored as object), ...parsed.data, origin: data.origin };
  readHeroData(merged);
  return merged;
}
