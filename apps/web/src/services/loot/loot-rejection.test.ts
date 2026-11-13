import { describe, expect, it } from 'vitest';
import en from '@/locales/en/ui.json';
import uk from '@/locales/uk/ui.json';
import { getByPath } from '@/i18n/locale-keys';
import {
  LOOT_REJECT_REASONS,
  lootLocaleKeys,
  lootRejectKey,
  lootRejectReasonOf,
} from './loot-rejection';

const UK_TEXT = {
  NO_ROOM_FOR_LOOT: 'Навколо немає місця для здобичі.',
  BAG_FULL: 'Сумка повна. Звільни місце.',
  STANDING_ON_TARGET: 'Спершу зійди з цього місця.',
  CHEST_EMPTY: 'Скриня порожня.',
  NOT_ADJACENT: 'Підійди ближче.',
};

describe('loot refusal texts', () => {
  it.each(LOOT_REJECT_REASONS)('%s has a Ukrainian and an English text', (reason) => {
    expect(getByPath(uk, lootRejectKey(reason))).toBe(UK_TEXT[reason]);
    expect(String(getByPath(en, lootRejectKey(reason)))).toMatch(/\S/);
  });

  it('registers every key for the orphan-key scan', () => {
    expect(lootLocaleKeys()).toEqual(LOOT_REJECT_REASONS.map(lootRejectKey));
  });

  it('reads the reason from a refused action and ignores unknown codes', () => {
    expect(
      lootRejectReasonOf([{ type: 'LOOT_REJECTED', payload: { heroId: 'h', reason: 'BAG_FULL' } }]),
    ).toBe('BAG_FULL');
    expect(
      lootRejectReasonOf([{ type: 'LOOT_REJECTED', payload: { heroId: 'h', reason: 'NO_HERO' } }]),
    ).toBeNull();
    expect(lootRejectReasonOf([])).toBeNull();
  });
});
