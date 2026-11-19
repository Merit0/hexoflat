import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import {
  executePlayerCommand,
  type PlayerCommandContext,
} from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { emptyProgressState } from '../aggregates/progress-state';
import { sumEquippedHeartPoints } from '../combat/heart-points';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { attributeRowsOf } from './attribute-display';
import { isTokenType } from './game-tokens';
import type { ItemToken } from './token-schema';

const HERO = 'hero-1';
const DEV: PlayerCommandContext = {
  devGrantAllowed: true,
  inventory: { stashOpen: false, battleOpen: false },
};

function grantCommand(payload: Record<string, unknown>) {
  return PLAYER_COMMAND_SCHEMAS.DEV_GRANT_ITEM.safeParse({
    type: 'DEV_GRANT_ITEM',
    payload: { heroId: HERO, revision: 0, amount: 1, ...payload },
  });
}

function grantTokens(payload: Record<string, unknown>, ctx = DEV): ItemToken[] {
  const command = grantCommand(payload);
  if (!command.success) throw new Error(command.error.message);
  const outcome = executePlayerCommand(
    { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) },
    command.data,
    ctx,
  );
  if (!outcome.ok) throw new Error(outcome.code);
  return outcome.changed
    .inventory!.bag.filter((cell) => cell !== null && isTokenType(cell.key))
    .map((cell) => cell!.token!);
}

const shieldSpec = {
  type: HEXOBJECT_KEYS.SHIELD,
  realm: ERarityKind.IDOL,
  mapTier: 1,
};

describe('LG5e: DEV_GRANT_ITEM with a token spec', () => {
  it('sets the given attributes and price on a factory token of the given realm and tier', () => {
    const [token] = grantTokens({
      key: HEXOBJECT_KEYS.SHIELD,
      token: { ...shieldSpec, realm: ERarityKind.GLOOM, mapTier: 3, attributes: [], price: 77 },
    });

    expect(token).toMatchObject({
      type: HEXOBJECT_KEYS.SHIELD,
      rarity: ERarityKind.GLOOM,
      mapTier: 3,
      attributes: [],
      price: 77,
    });
    expect(token.id.startsWith('dev:hero-1.')).toBe(true);
    expect(token.description.some((line) => line.key.includes('.attr.'))).toBe(false);
  });

  it('describes a given heart attribute and counts it as half a heart', () => {
    const [token] = grantTokens({
      key: HEXOBJECT_KEYS.SHIELD,
      token: { ...shieldSpec, attributes: [{ key: 'heart', value: 1 }] },
    });

    expect(token.attributes).toEqual([{ key: 'heart', value: 1 }]);
    expect(token.description.some((line) => line.key.startsWith('content.tokens.attr.'))).toBe(
      false,
    );
    expect(attributeRowsOf(token)).toMatchObject([
      {
        key: 'heart',
        labelKey: 'content.tokens.attrLabel.heart',
        formatKey: 'content.tokens.attrFormat.hearts',
        value: 0.5,
      },
    ]);
    expect(sumEquippedHeartPoints([{ key: token.type, token }])).toBe(0.5);
  });

  it('gives every piece its own id and keeps the spec on each', () => {
    const tokens = grantTokens({
      key: HEXOBJECT_KEYS.SWORD,
      amount: 2,
      token: { ...shieldSpec, type: HEXOBJECT_KEYS.SWORD, price: 120 },
    });

    expect(tokens).toHaveLength(2);
    expect(new Set(tokens.map((token) => token.id)).size).toBe(2);
    expect(tokens.map((token) => token.price)).toEqual([120, 120]);
  });

  it('rolls the price and attributes when the spec does not give them', () => {
    const [token] = grantTokens({ key: HEXOBJECT_KEYS.SHIELD, token: shieldSpec });

    expect(token.price).toBeGreaterThanOrEqual(40);
    expect(token.price).toBeLessThanOrEqual(600);
  });

  it.each([
    ['a type that differs from the key', { key: HEXOBJECT_KEYS.SWORD, token: shieldSpec }],
    [
      'an unknown attribute',
      {
        key: HEXOBJECT_KEYS.SHIELD,
        token: { ...shieldSpec, attributes: [{ key: 'luck', value: 1 }] },
      },
    ],
    [
      'a stack type',
      { key: HEXOBJECT_KEYS.COINS, token: { ...shieldSpec, type: HEXOBJECT_KEYS.COINS } },
    ],
    [
      'the god-executor realm',
      { key: HEXOBJECT_KEYS.SHIELD, token: { ...shieldSpec, realm: ERarityKind.GOD_EXECUTOR } },
    ],
    ['a zero price', { key: HEXOBJECT_KEYS.SHIELD, token: { ...shieldSpec, price: 0 } }],
    ['tier 5', { key: HEXOBJECT_KEYS.SHIELD, token: { ...shieldSpec, mapTier: 5 } }],
  ])('refuses %s in the command schema', (_name, payload) => {
    expect(grantCommand(payload).success).toBe(false);
  });

  it('is refused outside dev', () => {
    expect(() =>
      grantTokens(
        { key: HEXOBJECT_KEYS.SHIELD, token: shieldSpec },
        { ...DEV, devGrantAllowed: false },
      ),
    ).toThrow('FORBIDDEN');
  });
});
