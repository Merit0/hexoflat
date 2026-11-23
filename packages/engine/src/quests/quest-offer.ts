import { z } from 'zod';
import { QuestDefinitionSchema } from './quest-definition';

export const QUEST_BOARD_SIZE = 7;

const positiveInteger = z.number().int().positive();
export const questOfferSchema = z
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

export type QuestOffer = z.infer<typeof questOfferSchema>;
