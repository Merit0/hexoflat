import { describe, expect, it } from 'vitest';
import { stepCost, travelStepBudget } from './math';

const paid = { willZone: 'paid', combatActive: false } as const;
const camp = { willZone: 'free', combatActive: false } as const;

describe('world step prices', () => {
  it('charges one Will per world step and stops at the first unaffordable step', () => {
    expect(stepCost(paid)).toBe(1);
    expect(travelStepBudget(20, 4, paid)).toBe(4);
    expect(travelStepBudget(20, 0, paid)).toBe(0);
  });

  it('does not charge in camp or combat', () => {
    expect(stepCost(camp)).toBe(0);
    expect(travelStepBudget(20, 0, camp)).toBe(20);
    expect(stepCost({ ...paid, combatActive: true })).toBe(0);
  });

  it.each([1, 2, 3, 4, 5])('waives every Nth eligible step for N=%s', (stepFreeEvery) => {
    const costs = Array.from({ length: 20 }, (_, paidSteps) =>
      stepCost(paid, { paidSteps, stepFreeEvery }),
    );
    expect(costs.filter((cost) => cost === 0)).toHaveLength(Math.floor(20 / stepFreeEvery));
    expect(costs[stepFreeEvery - 1]).toBe(0);
  });

  it('previews the affordable prefix, including a free step after the last paid one', () => {
    expect(travelStepBudget(20, 16, paid, { paidSteps: 0, stepFreeEvery: 5 })).toBe(20);
    expect(travelStepBudget(20, 4, paid, { paidSteps: 0, stepFreeEvery: 5 })).toBe(5);
    expect(travelStepBudget(20, 0, paid, { paidSteps: 4, stepFreeEvery: 5 })).toBe(1);
    expect(travelStepBudget(20, 0, paid, { paidSteps: 3, stepFreeEvery: 5 })).toBe(0);
    expect(travelStepBudget(20, 0, paid, { paidSteps: 0, stepFreeEvery: 1 })).toBe(20);
    expect(travelStepBudget(20, 0, paid, { paidSteps: 4, stepFreeEvery: 0 })).toBe(0);
  });
});
