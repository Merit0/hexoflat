import { describe, expect, it } from 'vitest';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { executePlayerCommand, type PlayerAggregates } from './execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from './player-commands';
import { emptyProgressState } from './progress-state';

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

function withShield(shield: boolean) {
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
    payload: { heroId: HERO, revision: 0, inventory },
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
});
