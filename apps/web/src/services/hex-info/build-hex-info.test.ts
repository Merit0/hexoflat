import { describe, expect, it } from 'vitest';
import { getPrototype } from '@hexoflat/engine';
import type { THexobject } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { buildHexInfo, heartsFor } from './build-hex-info';

const t = (key: string) => key;
const te = () => false;

function placed(key: THexobjectKey): THexobject {
  return { ...getPrototype(key), id: `test-${key}` };
}

describe('heartsFor', () => {
  it('draws one heart per hp for small creatures', () => {
    expect(heartsFor(3, 5).fills).toEqual([1, 1, 1, 0, 0]);
  });

  it('caps the icons at ten and scales the fill', () => {
    const hearts = heartsFor(30, 100);
    expect(hearts.fills).toHaveLength(10);
    expect(hearts.fills.filter((fill) => fill === 1)).toHaveLength(3);
  });

  it('never shows a living creature with an empty heart row', () => {
    expect(heartsFor(1, 100).fills[0]).toBe(0.5);
    expect(heartsFor(0, 100).fills.every((fill) => fill === 0)).toBe(true);
  });

  it('rounds partial hearts to halves', () => {
    expect(heartsFor(2, 15).fills.slice(0, 2)).toEqual([1, 0.5]);
  });
});

describe('buildHexInfo icon', () => {
  it('uses the skull for creatures', () => {
    const view = buildHexInfo(placed('skeleton-pack'), 'Creature', t, te);
    expect(view.icon).toBe('skull');
    expect(view.rarity).toBeNull();
  });

  it('uses the item own icon for a sword', () => {
    expect(buildHexInfo(placed('sword'), 'Equipment', t, te).icon).toBe('sword');
  });

  it('uses the tower for constructions', () => {
    expect(buildHexInfo(placed('fireplace'), 'Structure', t, te).icon).toBe('tower');
  });

  it('uses a resource icon for trees and mountains', () => {
    expect(buildHexInfo(placed('tree'), 'Resource', t, te).icon).toBe('wood');
    expect(buildHexInfo(placed('mountain'), 'Resource', t, te).icon).toBe('rock');
  });
});
