import { describe, expect, it } from 'vitest';
import { BOARD_MODELS } from '../content/boards/models';
import { RecipeSchema } from '../content/boards/recipe-schema';
import { adjustRuleCount, ruleCount } from './board-model-edit';

describe('board model editing', () => {
  const cave = BOARD_MODELS.cave;

  it('adjustRuleCount moves a range rule up and down together without touching the original', () => {
    const before = structuredClone(cave);
    const more = adjustRuleCount(cave, 'rocks', 1);
    const fewer = adjustRuleCount(cave, 'rocks', -1);

    expect(ruleCount(more, 'rocks')).toEqual([4, 7]);
    expect(ruleCount(fewer, 'rocks')).toEqual([2, 5]);
    expect(cave).toEqual(before);
  });

  it('adjustRuleCount moves a fixed count and never goes below zero', () => {
    expect(ruleCount(adjustRuleCount(cave, 'treasure', 2), 'treasure')).toBe(3);
    let recipe = cave;
    for (let i = 0; i < 5; i += 1) recipe = adjustRuleCount(recipe, 'treasure', -1);
    expect(ruleCount(recipe, 'treasure')).toBe(0);
    expect(RecipeSchema.safeParse(recipe).success).toBe(true);
  });

  it('adjustRuleCount rejects an unknown rule', () => {
    expect(() => adjustRuleCount(cave, 'nope', 1)).toThrow(/no rule/);
    expect(ruleCount(cave, 'nope')).toBeNull();
  });
});
