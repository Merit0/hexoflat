import { z } from 'zod';

export const UNIQUE_ATTRIBUTE_MULTIPLIER = z.number().min(1).parse(1.5);
