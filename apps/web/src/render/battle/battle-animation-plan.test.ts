import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { planBattleAnimation, type AnimatedCreature } from './battle-animation-plan';
import { BATTLE_TIMING } from './battle-timing';

const hero: AnimatedCreature = { id: 'hero', side: 'heroes', pos: { q: 0, r: 0 } };
const ev = (type: string, payload: Record<string, unknown>): DomainEvent => ({ type, payload });

describe('planBattleAnimation', () => {
  it('walks an enemy hex by hex like the hero, then swings the tool from where it stands for one second', () => {
    const skeleton: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
    const steps = planBattleAnimation(
      [
        ev('TURN_STARTED', { creatureId: 's1', will: 20 }),
        ev('CREATURE_MOVED', { creatureId: 's1', from: { q: 3, r: 0 }, to: { q: 2, r: 0 } }),
        ev('CREATURE_MOVED', { creatureId: 's1', from: { q: 2, r: 0 }, to: { q: 1, r: 0 } }),
        ev('STRIKE_LANDED', {
          attackerId: 's1',
          targetId: 'hero',
          fromHex: null,
          ring: [{ q: 1, r: 0 }],
        }),
        ev('TURN_ENDED', { creatureId: 's1' }),
      ],
      [hero, skeleton],
    );

    expect(steps.map((s) => s.kind)).toEqual(['walk', 'walk', 'strike']);
    expect(steps[0]).toMatchObject({
      creatureId: 's1',
      from: { q: 3, r: 0 },
      to: { q: 2, r: 0 },
      durationMs: BATTLE_TIMING.stepMs,
    });
    expect(steps[2]).toMatchObject({
      targetId: 'hero',
      target: { q: 0, r: 0 },
      from: { q: 1, r: 0 },
      durationMs: BATTLE_TIMING.strikeMs,
    });
    expect(BATTLE_TIMING.strikeMs).toBe(1000);
  });

  it('walks the hero hex by hex like the map step', () => {
    const steps = planBattleAnimation(
      [
        ev('CREATURE_MOVED', { creatureId: 'hero', from: { q: 0, r: 0 }, to: { q: 1, r: 0 } }),
        ev('CREATURE_MOVED', { creatureId: 'hero', from: { q: 1, r: 0 }, to: { q: 2, r: 0 } }),
      ],
      [{ ...hero, pos: { q: 2, r: 0 } }],
    );
    expect(steps).toEqual([
      {
        kind: 'walk',
        creatureId: 'hero',
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
        durationMs: BATTLE_TIMING.stepMs,
      },
      {
        kind: 'walk',
        creatureId: 'hero',
        from: { q: 1, r: 0 },
        to: { q: 2, r: 0 },
        durationMs: BATTLE_TIMING.stepMs,
      },
    ]);
  });

  it('swings the tool the hero struck with from the hex the hero struck from', () => {
    const skeleton: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
    const [strike] = planBattleAnimation(
      [
        ev('STRIKE_LANDED', {
          attackerId: 'hero',
          targetId: 's1',
          fromHex: { q: 0, r: 0 },
          itemKey: 'sword',
          ring: [{ q: 0, r: 0 }],
        }),
      ],
      [hero, skeleton],
    );
    expect(strike).toMatchObject({
      kind: 'strike',
      from: { q: 0, r: 0 },
      target: { q: 1, r: 0 },
      toolKey: 'sword',
      durationMs: BATTLE_TIMING.strikeMs,
    });
  });

  it('slides along an oil path, shakes on a ledge fall and on lost hearts', () => {
    const pushed: AnimatedCreature = { ...hero, pos: { q: 2, r: 0 } };
    const steps = planBattleAnimation(
      [
        ev('DISPLACED', {
          targetId: 'hero',
          mode: 'push',
          from: { q: 0, r: 0 },
          path: [
            { q: 1, r: 0 },
            { q: 2, r: 0 },
          ],
          slid: true,
          fell: true,
        }),
        ev('CREATURE_DAMAGED', { creatureId: 'hero', amount: 1, hp: 5 }),
      ],
      [pushed],
    );
    expect(steps.map((s) => s.kind)).toEqual(['slide', 'shake', 'shake']);
    expect(steps[0]).toMatchObject({
      path: [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ],
      durationMs: BATTLE_TIMING.slidePerHexMs * 2,
    });
    expect(steps[1]).toMatchObject({ style: 'fall', at: { q: 2, r: 0 } });
    expect(steps[2]).toMatchObject({
      style: 'hit',
      damage: 1,
      durationMs: BATTLE_TIMING.woundMs,
    });
  });

  it('ejects a creature from the saw and ignores boulders', () => {
    const steps = planBattleAnimation(
      [
        ev('DISPLACED', {
          targetId: 'boulder-1',
          from: { q: 5, r: 0 },
          path: [{ q: 6, r: 0 }],
          slid: false,
          fell: false,
        }),
        ev('THROWN_CLEAR', { creatureId: 'hero', from: { q: 1, r: 0 }, to: { q: 0, r: 0 } }),
      ],
      [hero],
    );
    expect(steps).toEqual([
      {
        kind: 'eject',
        creatureId: 'hero',
        from: { q: 1, r: 0 },
        to: { q: 0, r: 0 },
        durationMs: BATTLE_TIMING.sawEjectMs,
      },
    ]);
  });

  it('plans nothing for bookkeeping events', () => {
    expect(planBattleAnimation([ev('PHASE_CHANGED', { phase: 'act' })], [hero])).toEqual([]);
  });
});
