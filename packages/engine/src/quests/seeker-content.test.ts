import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_RULES } from '../knowledge/math';
import {
  SEEKER_CARDS,
  seekerCardFailures,
  seekerCleanWill,
  seekerWorstCaseWill,
} from './seeker-content';

describe('seeker cards', () => {
  it('REQ-QST-009: every card with one fix fits the Will capacity', () => {
    for (const card of SEEKER_CARDS) {
      const { steps, stepCost, backMultiplier } = card.params;
      expect(card.entryWill + (steps + 1 + backMultiplier) * stepCost).toBeLessThanOrEqual(
        KNOWLEDGE_RULES.capacity,
      );
    }
    expect(SEEKER_CARDS.map(seekerCleanWill)).toEqual([30, 30, 36]);
    expect(SEEKER_CARDS.map(seekerWorstCaseWill)).toEqual([34, 34, 44]);
  });

  it('REQ-QST-009: an over-capacity card is reported', () => {
    const heavy = { ...SEEKER_CARDS[0], entryWill: 49 };
    expect(seekerCardFailures([heavy])).toContain('seeker-1: over Will capacity');
    expect(seekerCardFailures()).toEqual([]);
  });

  it('REQ-QST-021: every card has its own tableRule', () => {
    const rules = SEEKER_CARDS.map((card) => card.tableRule);
    expect(rules.every((rule) => rule.length > 0)).toBe(true);
    expect(new Set(rules).size).toBe(rules.length);
  });

  it('chains the cards by a clean run of the previous one', () => {
    expect(SEEKER_CARDS.map((card) => card.requiresCleanOf)).toEqual([
      null,
      'seeker-1',
      'seeker-2',
    ]);
  });
});
