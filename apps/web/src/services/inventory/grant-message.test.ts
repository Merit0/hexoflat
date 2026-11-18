import { describe, expect, it } from 'vitest';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import { i18n } from '@/i18n';
import { grantMessage } from './inventory-store-io';

const TOKEN_REFUSALS = ['TOKEN_SOURCE_REQUIRED', 'DUPLICATE_TOKEN', 'INVALID_AMOUNT'] as const;

describe('grant refusal message', () => {
  it.each(TOKEN_REFUSALS)('%s shows the translated reason, not the prototype error', (reason) => {
    const message = grantMessage(reason, 'sword', 10);

    expect(message).toBe(i18n.global.t(`inventory.grantReject.${reason}`));
    expect(message).not.toMatch(/prototype/i);
  });

  it.each(TOKEN_REFUSALS)('%s has a text in en and uk', (reason) => {
    expect(enUi.inventory.grantReject[reason]).toBeTruthy();
    expect(ukUi.inventory.grantReject[reason]).toBeTruthy();
    expect(ukUi.inventory.grantReject[reason]).not.toBe(enUi.inventory.grantReject[reason]);
  });
});
