import { z } from 'zod';
import type { ItemToken } from './token-schema';

export interface TokenCarrier {
  amount: number;
  token?: ItemToken;
}

export function tokenEntryIssue(entry: TokenCarrier, key: string): string | null {
  if (!entry.token) return null;
  if (entry.token.type !== key) return `token type ${entry.token.type} differs from the key ${key}`;
  if (entry.amount !== 1) return 'a token entry holds exactly one item';
  return null;
}

export function refineTokenEntry<T extends TokenCarrier>(keyOf: (entry: T) => string) {
  return (entry: T, ctx: z.RefinementCtx): void => {
    const issue = tokenEntryIssue(entry, keyOf(entry));
    if (issue) ctx.addIssue({ code: 'custom', path: ['token'], message: issue });
  };
}

export function withToken<T extends object>(target: T, token: ItemToken | undefined): T {
  return token ? { ...target, token } : target;
}
