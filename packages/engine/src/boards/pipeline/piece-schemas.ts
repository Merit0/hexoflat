import { z } from 'zod';

export function intRange(min: number, max?: number) {
  const bound = max === undefined ? z.number().int().min(min) : z.number().int().min(min).max(max);
  return z.tuple([bound, bound]).refine(([low, high]) => low <= high, {
    message: 'range minimum must not exceed its maximum',
  });
}

export function intOrRange(min: number, max?: number) {
  const single = max === undefined ? z.number().int().min(min) : z.number().int().min(min).max(max);
  return z.union([single, intRange(min, max)]);
}
