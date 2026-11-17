import { itemTokenSchema, type ItemToken } from '../token-schema';
import { refuseToken, type ITokenValidator, type TokenResult } from './token-generation';

export class ZodTokenValidator implements ITokenValidator {
  validate(candidate: unknown): TokenResult<ItemToken> {
    const parsed = itemTokenSchema.safeParse(candidate);
    if (parsed.success) return { ok: true, value: parsed.data };
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return refuseToken('INVALID_TOKEN', issues.join('; '));
  }
}
