import { z } from 'zod';
import { basisPointsSchema } from '../tokens/token-keys';

export const UNIQUE_ATTRIBUTE_MULTIPLIER = z.number().min(1).parse(1.5);

export const ALIEN_UNIQUE_CHANCE_BP = basisPointsSchema.parse(50);
