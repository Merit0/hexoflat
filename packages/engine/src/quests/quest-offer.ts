import { z } from 'zod';
import { QuestDefinitionSchema } from './quest-definition';

export const QUEST_BOARD_SIZE = 7;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const positiveInteger = z.number().int().positive();
const currentQuestOfferSchema = z
  .strictObject({
    id: z.string().regex(/^qo-[a-f0-9]{32}$/),
    templateId: z.string().min(1),
    variantId: z.string().min(1),
    generationVersion: positiveInteger,
    dayId: positiveInteger,
    serial: positiveInteger,
    definition: QuestDefinitionSchema,
    howKey: z.string().min(1),
  })
  .refine((offer) => offer.definition.id === offer.templateId, {
    path: ['definition', 'id'],
    message: 'The saved definition must identify the authored template',
  });

function without(source: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
}

export function upcastQuestOffer(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.definition)) return raw;
  const definition = without(raw.definition, 'dimension');
  if (isRecord(definition.rewardDropContext))
    definition.rewardDropContext = without(definition.rewardDropContext, 'tokenType', 'realm');
  return { ...raw, definition };
}

export const questOfferSchema = z.preprocess(upcastQuestOffer, currentQuestOfferSchema);

export type QuestOffer = z.infer<typeof questOfferSchema>;
