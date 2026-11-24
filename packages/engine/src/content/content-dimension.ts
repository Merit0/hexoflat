import type { z } from 'zod';
import { type ETokenType } from '../abstraction/hexobject-abstraction';
import { tokenTypeOfDimension, type EDimension } from '../dimensions/dimensions';
import { DEFAULT_ITEM_TOKEN_TYPE } from './token-type-rules';

type ItemTokenType = { kind: ETokenType };
type OwnedContent = {
  dimension: EDimension;
  loot?: { tokenType?: ItemTokenType };
  tool?: { tokenType?: ItemTokenType };
  equipment?: { tokenType?: ItemTokenType };
};

/** Authored token types must agree with their single owner. */
export function validateContentDimension(content: OwnedContent, ctx: z.RefinementCtx): void {
  for (const field of ['loot', 'tool', 'equipment'] as const) {
    const item = content[field];
    if (!item) continue;
    // Coins have no tokenType; tools/equipment use the same fallback as getPrototype.
    const tokenType = item.tokenType ?? (field === 'loot' ? undefined : DEFAULT_ITEM_TOKEN_TYPE);
    if (!tokenType) continue;
    const kind = tokenType.kind;
    if (kind !== tokenTypeOfDimension(content.dimension)) {
      ctx.addIssue({
        code: 'custom',
        path: [field, 'tokenType', 'kind'],
        message: `Token type ${kind} does not belong to ${content.dimension}`,
      });
    }
  }
}
