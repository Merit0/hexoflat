import { describe, expect, it } from 'vitest';
import { rejectionWarning } from './battle-warning';

describe('rejectionWarning', () => {
  it('reads the refusal code and the Will price from a refused batch', () => {
    expect(
      rejectionWarning([
        { type: 'BATTLE_REJECTED', payload: { rejected: 'INSUFFICIENT_WILL', cost: 7, left: 2 } },
      ]),
    ).toEqual({ code: 'INSUFFICIENT_WILL', cost: 7 });
    expect(
      rejectionWarning([{ type: 'BATTLE_REJECTED', payload: { rejected: 'TOO_HEAVY' } }]),
    ).toEqual({ code: 'TOO_HEAVY', cost: null });
  });

  it('is silent for an accepted batch', () => {
    expect(rejectionWarning([{ type: 'CREATURE_MOVED', payload: {} }])).toBeNull();
    expect(rejectionWarning([])).toBeNull();
  });
});
