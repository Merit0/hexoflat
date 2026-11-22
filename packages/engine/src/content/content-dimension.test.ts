import { describe, expect, it } from 'vitest';
import { CONTENT } from './content-map';
import { ContentDefinitionSchema } from './content-schema';
import { validateContent } from './validate-content';
import { EDimension } from '../dimensions/dimensions';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

const OWNERS = {
  earth: [
    'tree',
    'knowledge-book',
    'coins',
    'rock',
    'mountain',
    'axe',
    'hand',
    'pickaxe',
    'sword',
    'shield',
    'camping-entrance',
    'cave-entrance',
    'homeland-gate',
    'health-bottle',
    'energy-bottle',
    'mana-bottle',
    'fireplace',
    'healing-spring',
    'wood-and-leaves',
    'chest',
    'chest-open',
    'stash-chest',
    'trader-stall',
    'training-grounds',
    'quest-board',
    'treasure-map',
    'stone-wall',
  ],
  underworld: [
    'skeletor',
    'emitter',
    'inferno',
    'lone-skeleton',
    'skeleton-pack',
    'archer-watch',
    'bone-court',
    'cave-exit',
    'grave',
    'bone-charm',
    'crown-shard',
  ],
  heaven: ['return-scroll', 'return-portal'],
  nowhere: [],
};

describe('authored content dimensions', () => {
  it('covers every hexobject exactly once with its specified owner', () => {
    const keys = Object.values(HEXOBJECT_KEYS);
    expect(Object.values(OWNERS).flat().sort()).toEqual([...keys].sort());
    for (const key of keys) expect(OWNERS[CONTENT[key].dimension]).toContain(key);
    expect(() => validateContent()).not.toThrow();
  });

  it.each([undefined, null, 'invalid', ['earth', 'underworld']])(
    'rejects invalid ownership in the real content schema: %j',
    (dimension) => {
      expect(ContentDefinitionSchema.safeParse({ ...CONTENT.tree, dimension }).success).toBe(false);
    },
  );

  it.each(['health-bottle', 'return-scroll', 'bone-charm', 'axe', 'sword'] as const)(
    'rejects conflicting item family on %s, including implicit prototype rarity',
    (key) => {
      const result = ContentDefinitionSchema.safeParse({
        ...CONTENT[key],
        dimension: EDimension.NOWHERE,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].message).toContain('does not belong');
    },
  );

  it('keeps foreign items owned by their catalogue dimension regardless of where they drop', () => {
    expect(CONTENT['return-scroll'].dimension).toBe(EDimension.HEAVEN);
    expect(CONTENT['bone-charm'].dimension).toBe(EDimension.UNDERWORLD);
    expect(CONTENT.coins.dimension).toBe(EDimension.EARTH);
    expect('loot' in CONTENT.coins && CONTENT.coins.loot.rarity).toBeUndefined();
  });
});
