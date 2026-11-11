import { describe, expect, it } from 'vitest';
import { buyTargetOf, describeShopDrop, resolveShopTarget } from './shop-drop';

function element(data: Record<string, string>): HTMLElement {
  const node = document.createElement('div');
  Object.assign(node.dataset, data);
  return node;
}

describe('resolveShopTarget', () => {
  it('a bag cell under the pointer wins over the pane around it', () => {
    const target = resolveShopTarget([
      element({ dropContainer: 'bag', dropIndex: '7' }),
      element({ zone: 'bag' }),
    ]);
    expect(target).toEqual({ kind: 'bag-cell', index: 7 });
  });

  it('goods cells are not targets, their pane is', () => {
    const target = resolveShopTarget([element({ tradeCell: '' }), element({ zone: 'goods' })]);
    expect(target).toEqual({ kind: 'zone', zone: 'goods' });
  });

  it('knows the trader banner and the buyback row, and nothing else', () => {
    expect(resolveShopTarget([element({ zone: 'trader' })])).toEqual({
      kind: 'zone',
      zone: 'trader',
    });
    expect(resolveShopTarget([element({ zone: 'buyback' })])).toEqual({
      kind: 'zone',
      zone: 'buyback',
    });
    expect(resolveShopTarget([element({ zone: 'stash' })])).toBeNull();
    expect(resolveShopTarget([])).toBeNull();
  });
});

describe('buyTargetOf', () => {
  it('a bag cell is a cell, the bag pane is auto, the trader side is no buy', () => {
    expect(buyTargetOf({ kind: 'bag-cell', index: 2 })).toEqual({ container: 'bag', index: 2 });
    expect(buyTargetOf({ kind: 'zone', zone: 'bag' })).toBe('auto');
    expect(buyTargetOf({ kind: 'zone', zone: 'goods' })).toBeNull();
  });
});

describe('describeShopDrop', () => {
  const ok = (price: number, amount: number) => ({ ok: true as const, price, amount });

  it('names the deal with its price', () => {
    expect(describeShopDrop({ deal: 'buy', preview: ok(24, 1) })).toMatchObject({
      id: 'buy',
      tone: 'ok',
      price: 24,
    });
    expect(describeShopDrop({ deal: 'buy', preview: ok(36, 3) })).toMatchObject({
      id: 'buySplit',
      count: 3,
      price: 36,
    });
    expect(describeShopDrop({ deal: 'sell', preview: ok(18, 1) })?.id).toBe('sell');
    expect(describeShopDrop({ deal: 'buyback', preview: ok(18, 1) })?.id).toBe('buyback');
  });

  it('turns refusals into red labels', () => {
    const refused = (reason: 'NOT_ENOUGH_COINS' | 'NOT_TRADEABLE' | 'CONTAINER_FULL') =>
      describeShopDrop({ deal: 'buy', preview: { ok: false, reason, price: null } });
    expect(refused('NOT_ENOUGH_COINS')).toMatchObject({ id: 'cantAfford', tone: 'bad' });
    expect(refused('NOT_TRADEABLE')).toMatchObject({ id: 'notInterested', tone: 'bad' });
    expect(refused('CONTAINER_FULL')).toMatchObject({ id: 'cant', tone: 'bad' });
    expect(describeShopDrop(null)).toBeNull();
  });
});
