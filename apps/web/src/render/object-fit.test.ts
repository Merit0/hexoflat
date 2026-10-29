import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { hexobjectFitRule } from './object-fit';

describe('hexobject fit rules', () => {
  it('gives creatures, constructions and pickups each their own rule', () => {
    expect(hexobjectFitRule(EHexobjectGroup.CREATURE)).toBe('creature');
    expect(hexobjectFitRule(EHexobjectGroup.CONSTRUCTION)).toBe('construction');
    expect(hexobjectFitRule(EHexobjectGroup.RESOURCE)).toBe('construction');
    expect(hexobjectFitRule(EHexobjectGroup.LOOT)).toBe('pickup');
    expect(hexobjectFitRule(EHexobjectGroup.TOOL)).toBe('pickup');
    expect(hexobjectFitRule(EHexobjectGroup.EQUIPMENT)).toBe('pickup');
    expect(hexobjectFitRule(undefined)).toBe('construction');
  });
});
