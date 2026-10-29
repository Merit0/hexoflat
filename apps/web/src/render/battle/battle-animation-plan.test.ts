import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { planBattleAnimation, type AnimatedCreature } from './battle-animation-plan';
import { BATTLE_TIMING } from './battle-timing';

const hero: AnimatedCreature = { id: 'hero', side: 'heroes', pos: { q: 0, r: 0 } };
const ev = (type: string, payload: Record<string, unknown>): DomainEvent => ({ type, payload });

describe('planBattleAnimation', () => {
  it('hides an enemy path: fade out at the start, ring + sword without a side, appear at the end', () => {
    const skeleton: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: -1 } };
    const steps = planBattleAnimation(
      [
        ev('TURN_STARTED', { creatureId: 's1', will: 20 }),
        ev('CREATURE_MOVED', { creatureId: 's1', from: { q: 3, r: 0 }, to: { q: 2, r: 0 } }),
        ev('CREATURE_MOVED', { creatureId: 's1', from: { q: 2, r: 0 }, to: { q: 1, r: 0 } }),
        ev('STRIKE_DEALT', {
          attackerId: 's1',
          targetId: 'hero',
          fromHex: null,
          ring: [{ q: 1, r: 0 }],
        }),
        ev('CREATURE_MOVED', { creatureId: 's1', from: { q: 1, r: 0 }, to: { q: 1, r: -1 } }),
        ev('TURN_ENDED', { creatureId: 's1' }),
      ],
      [hero, skeleton],
    );

    expect(steps.map((s) => s.kind)).toEqual(['vanish', 'strike', 'appear']);
    expect(steps[0]).toMatchObject({ creatureId: 's1', at: { q: 3, r: 0 } });
    expect(steps[1]).toMatchObject({ targetId: 'hero', target: { q: 0, r: 0 }, from: null });
    expect(steps[2]).toMatchObject({ creatureId: 's1', at: { q: 1, r: -1 } });
    expect(JSON.stringify(steps)).not.toContain('"q":2');
    expect(steps[0].durationMs).toBe(BATTLE_TIMING.enemyVanishMs);
  });

  it('flies the hero sword from the hex the hero struck from', () => {
    const skeleton: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
    const [strike] = planBattleAnimation(
      [
        ev('STRIKE_DEALT', {
          attackerId: 'hero',
          targetId: 's1',
          fromHex: { q: 0, r: 0 },
          ring: [{ q: 0, r: 0 }],
        }),
      ],
      [hero, skeleton],
    );
    expect(strike).toMatchObject({
      kind: 'strike',
      from: { q: 0, r: 0 },
      target: { q: 1, r: 0 },
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
    expect(steps[2]).toMatchObject({ style: 'hit', durationMs: BATTLE_TIMING.heartShakeMs });
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

  it('plans nothing for a hero walking or for bookkeeping events', () => {
    const walked: AnimatedCreature = { ...hero, pos: { q: 1, r: 0 } };
    expect(
      planBattleAnimation(
        [
          ev('CREATURE_MOVED', { creatureId: 'hero', from: { q: 0, r: 0 }, to: { q: 1, r: 0 } }),
          ev('PHASE_CHANGED', { phase: 'act' }),
        ],
        [walked],
      ),
    ).toEqual([]);
  });
});
