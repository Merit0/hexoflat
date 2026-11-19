import { describe, expect, it } from 'vitest';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { executePlayerCommand, type PlayerAggregates } from './execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from './player-commands';
import { emptyProgressState } from './progress-state';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { upcastToken } from '../inventory/upcast-item-tokens';

const HERO = 'hero-1';
const CTX = { devGrantAllowed: true, inventory: { stashOpen: true, battleOpen: false } };

function fresh(): PlayerAggregates {
  return { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) };
}

function setHealth(current: number) {
  return PLAYER_COMMAND_SCHEMAS.DEV_SET_HEALTH.parse({
    type: 'DEV_SET_HEALTH',
    payload: { heroId: HERO, current },
  });
}

function withShield(shield: boolean, revision = 0) {
  const inventory = emptyInventoryState(HERO);
  if (shield) {
    inventory.equip.shield = {
      id: `${HERO}:0`,
      key: HEXOBJECT_KEYS.SHIELD,
      type: 'equipment' as never,
      amount: 1,
    };
    inventory.idSeq = 1;
  }
  return PLAYER_COMMAND_SCHEMAS.DEV_SET_INVENTORY.parse({
    type: 'DEV_SET_INVENTORY',
    payload: { heroId: HERO, revision, inventory },
  });
}

describe('the hero health on the server', () => {
  it('starts at the base maximum and is changed by a dev command only where dev is allowed', () => {
    expect(fresh().progress.health).toEqual({ current: 3, bonus: 0, debt: 0 });
    expect(
      executePlayerCommand(fresh(), setHealth(1), { ...CTX, devGrantAllowed: false }),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const outcome = executePlayerCommand(fresh(), setHealth(1), CTX);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.progress?.health.current).toBe(1);
  });

  it('never goes above the maximum or below nothing', () => {
    const high = executePlayerCommand(fresh(), setHealth(9), CTX);
    if (!high.ok) throw new Error(high.code);
    expect(high.changed.progress?.health.current).toBe(3);
    expect(
      PLAYER_COMMAND_SCHEMAS.DEV_SET_HEALTH.safeParse({
        type: 'DEV_SET_HEALTH',
        payload: { heroId: HERO, current: -1 },
      }).success,
    ).toBe(false);
  });

  it('keeps a full hero full when a shield raises the maximum, and a hurt hero as he was', () => {
    const full = executePlayerCommand(fresh(), withShield(true), CTX);
    if (!full.ok) throw new Error(full.code);
    expect(full.changed.progress?.health).toMatchObject({ current: 4, bonus: 1 });

    const hurtState = fresh();
    hurtState.progress.health = { current: 2, bonus: 0, debt: 0 };
    const hurt = executePlayerCommand(hurtState, withShield(true), CTX);
    if (!hurt.ok) throw new Error(hurt.code);
    expect(hurt.changed.progress?.health).toMatchObject({ current: 2, bonus: 1 });
  });

  it('clamps the health when the shield comes off, so unequipping and re-equipping cannot heal', () => {
    const shielded = fresh();
    shielded.progress.health = { current: 4, bonus: 1, debt: 0 };
    const off = executePlayerCommand(shielded, withShield(false), CTX);
    if (!off.ok) throw new Error(off.code);
    expect(off.changed.progress?.health).toMatchObject({ current: 3, bonus: 0 });
  });

  it('preserves missing bonus hearts across unequip, reload and re-equip', () => {
    const state = fresh();
    state.progress.health = { current: 3, bonus: 1, debt: 0 };
    const off = executePlayerCommand(state, withShield(false), CTX);
    if (!off.ok) throw new Error(off.code);
    const restored = JSON.parse(JSON.stringify({ ...state, ...off.changed })) as PlayerAggregates;
    expect(restored.progress.health.debt).toBe(1);
    const on = executePlayerCommand(restored, withShield(true, restored.inventory.revision), CTX);
    if (!on.ok) throw new Error(on.code);
    expect(on.changed.progress?.health).toEqual({ current: 3, bonus: 1, debt: 0 });
  });

  it('keeps health unchanged when an inventory command leaves the bonus unchanged', () => {
    const state = fresh();
    state.progress.health = { current: 2.5, bonus: 1, debt: 0.5 };
    const outcome = executePlayerCommand(state, withShield(true), CTX);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.progress).toBeUndefined();
    expect(state.progress.health).toEqual({ current: 2.5, bonus: 1, debt: 0.5 });
  });

  it.each(EQUIPMENT_ATTRIBUTES.filter((attribute) => attribute.implemented))(
    'EA-16: $key has a server reader for its stat',
    (attribute) => {
      expect(attribute.stat).toBe('maxHearts');
      const command = withShield(true);
      command.payload.inventory.equip.shield!.token = {
        ...upcastToken(HERO, 'equip.shield', 'shield')!,
        attributes: [{ key: attribute.key, value: 1 }],
      };
      const outcome = executePlayerCommand(fresh(), command, CTX);
      if (!outcome.ok) throw new Error(outcome.code);
      expect(outcome.changed.progress?.health).toEqual({ current: 3.5, bonus: 0.5, debt: 0 });
    },
  );

  it('EA-12: the server applies the shared cap after summing token hearts', () => {
    const command = withShield(true);
    const shield = command.payload.inventory.equip.shield!;
    shield.token = {
      ...upcastToken(HERO, 'equip.shield', 'shield')!,
      attributes: [{ key: 'heart', value: 8 }],
    };
    command.payload.inventory.equip.weapon = {
      ...shield,
      id: `${HERO}:1`,
      key: 'sword',
      amount: 1,
      token: {
        ...upcastToken(HERO, 'equip.weapon', 'sword')!,
        attributes: [{ key: 'heart', value: 8 }],
      },
    };
    const state = fresh();
    const outcome = executePlayerCommand(state, command, CTX);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.progress?.health).toEqual({ current: 8, bonus: 5, debt: 0 });
    expect(state.progress.health).toEqual({ current: 3, bonus: 0, debt: 0 });
  });
});
