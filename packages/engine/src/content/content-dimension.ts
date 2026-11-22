import type { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { itemFamilyOfDimension, type EDimension } from '../dimensions/dimensions';
import { DEFAULT_RARITY } from './rarity-rules';

type Rarity = { kind: ERarityKind };
type OwnedContent = {
  dimension: EDimension;
  loot?: { rarity?: Rarity };
  tool?: { rarity?: Rarity };
  equipment?: { rarity?: Rarity };
};

/** D1 adapter: saved-token family replacement belongs to D2. */
export function validateContentDimension(content: OwnedContent, ctx: z.RefinementCtx): void {
  for (const field of ['loot', 'tool', 'equipment'] as const) {
    const item = content[field];
    if (!item) continue;
    // Coins have no rarity; tools/equipment use the same fallback as getPrototype.
    const rarity = item.rarity ?? (field === 'loot' ? undefined : DEFAULT_RARITY);
    if (!rarity) continue;
    const family = rarity.kind === ERarityKind.GOD_EXECUTOR ? 'alient' : rarity.kind;
    if (family !== itemFamilyOfDimension(content.dimension)) {
      ctx.addIssue({
        code: 'custom',
        path: [field, 'rarity', 'kind'],
        message: `Item family ${family} does not belong to ${content.dimension}`,
      });
    }
  }
}
