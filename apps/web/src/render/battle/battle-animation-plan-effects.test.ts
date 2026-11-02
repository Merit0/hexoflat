import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { planBattleAnimation, type AnimatedCreature } from './battle-animation-plan';
import { BATTLE_TIMING } from './battle-timing';

const hero: AnimatedCreature = { id: 'hero', side: 'heroes', pos: { q: 0, r: 0 } };
const ev = (type: string, payload: Record<string, unknown>): DomainEvent => ({ type, payload });

describe('planBattleAnimation effects', () => {
  describe('blood splash hexes', () => {
    const attacker: AnimatedCreature = { id: 'hero', side: 'heroes', pos: { q: 0, r: 0 } };
    const target: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
    const bystander: AnimatedCreature = { id: 's2', side: 'enemies', pos: { q: 0, r: 1 } };
    const landed = (itemKey: string) =>
      ev('STRIKE_LANDED', {
        attackerId: 'hero',
        targetId: 's1',
        fromHex: { q: 0, r: 0 },
        itemKey,
        ring: [{ q: 0, r: 0 }],
      });
    const resolved = (outcome: string, damage: number) =>
      ev('STRIKES_RESOLVED', {
        creatureId: 's1',
        results: [{ strikeId: 'x', attackerId: 'hero', outcome, damage }],
      });
    const swept = (damage: number) =>
      ev('STRIKE_SWEPT', { attackerId: 'hero', victimId: 's2', fromHex: { q: 0, r: 0 }, damage });
    const splashOf = (events: DomainEvent[]) =>
      (planBattleAnimation(events, [attacker, target, bystander])[0] as { splashAt: unknown })
        .splashAt;

    it('marks the target when the weapon hurt it', () => {
      expect(splashOf([landed('sword'), resolved('hit', 2)])).toEqual([{ q: 1, r: 0 }]);
    });

    it('marks nobody when the shield took the whole blow', () => {
      expect(splashOf([landed('sword'), resolved('blocked', 0)])).toEqual([]);
      expect(splashOf([landed('sword'), resolved('hit', 0)])).toEqual([]);
      expect(splashOf([landed('sword')])).toEqual([]);
    });

    it('marks every swept creature that lost health, even when the target blocked', () => {
      expect(splashOf([landed('sword'), resolved('blocked', 0), swept(2)])).toEqual([
        { q: 0, r: 1 },
      ]);
      expect(splashOf([landed('sword'), resolved('hit', 2), swept(2)])).toEqual([
        { q: 1, r: 0 },
        { q: 0, r: 1 },
      ]);
      expect(splashOf([landed('sword'), resolved('hit', 2), swept(0)])).toEqual([{ q: 1, r: 0 }]);
    });

    it('reports the damage dealt to the target and to every swept creature', () => {
      const hitsOf = (events: DomainEvent[]) =>
        (planBattleAnimation(events, [attacker, target, bystander])[0] as { hits: unknown[] }).hits;
      expect(hitsOf([landed('sword'), resolved('hit', 2), swept(1)])).toMatchObject([
        { at: { q: 1, r: 0 }, damage: 2 },
        { at: { q: 0, r: 1 }, damage: 1 },
      ]);
      expect(hitsOf([landed('unarmed'), resolved('hit', 1)])).toMatchObject([{ damage: 1 }]);
    });

    it('shakes the target softly when the shield took the whole blow', () => {
      const stepsOf = (events: DomainEvent[]) =>
        planBattleAnimation(events, [attacker, target, bystander]);
      expect(stepsOf([landed('sword'), resolved('blocked', 0)])[1]).toMatchObject({
        kind: 'shake',
        creatureId: 's1',
        style: 'soft',
        durationMs: BATTLE_TIMING.softShakeMs,
      });
      expect(stepsOf([landed('sword'), resolved('hit', 2)])).toHaveLength(1);
    });

    it('marks nothing for a bare hand, however much damage it did', () => {
      expect(splashOf([landed('unarmed'), resolved('hit', 1), swept(1)])).toEqual([]);
    });
  });

  describe('damage that is not a strike', () => {
    const victim: AnimatedCreature = { id: 'hero', side: 'heroes', pos: { q: 0, r: 0 } };
    const wounded = ev('CREATURE_DAMAGED', { creatureId: 'hero', amount: 2, hp: 3 });

    it('bleeds and shows its number when something other than a blow hurt the creature', () => {
      const steps = planBattleAnimation([wounded], [victim]);
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        kind: 'shake',
        damage: 2,
        durationMs: BATTLE_TIMING.woundMs,
      });
    });

    it('does not double up on damage a strike already shows', () => {
      const foe: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
      const steps = planBattleAnimation(
        [
          ev('STRIKE_LANDED', {
            attackerId: 's1',
            targetId: 'hero',
            fromHex: { q: 1, r: 0 },
            itemKey: 'sword',
            ring: [{ q: 1, r: 0 }],
          }),
          ev('STRIKES_RESOLVED', {
            creatureId: 'hero',
            results: [{ strikeId: 'x', attackerId: 's1', outcome: 'hit', damage: 2 }],
          }),
          wounded,
        ],
        [victim, foe],
      );
      expect(steps.map((s) => s.kind)).toEqual(['strike', 'shake']);
      expect(steps[1]).not.toHaveProperty('damage', 2);
    });
  });

  it('plays the hit, the shake and only then the fall of the creature that died', () => {
    const skeleton: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
    const steps = planBattleAnimation(
      [
        ev('STRIKE_LANDED', {
          attackerId: 'hero',
          targetId: 's1',
          fromHex: { q: 0, r: 0 },
          itemKey: 'sword',
          ring: [{ q: 0, r: 0 }],
        }),
        ev('CREATURE_DAMAGED', { creatureId: 's1', amount: 2, hp: 0 }),
        ev('CREATURE_FELL', { creatureId: 's1' }),
      ],
      [hero, skeleton],
    );
    expect(steps.map((s) => s.kind)).toEqual(['strike', 'shake', 'fall']);
    expect(steps[2]).toMatchObject({
      creatureId: 's1',
      at: { q: 1, r: 0 },
      durationMs: BATTLE_TIMING.deathFadeMs,
    });
  });

  it('swings the enemy weapon, not a hand, when an enemy strikes with its blade', () => {
    const skeleton: AnimatedCreature = { id: 's1', side: 'enemies', pos: { q: 1, r: 0 } };
    const strike = (itemKey: string) =>
      planBattleAnimation(
        [
          ev('STRIKE_LANDED', {
            attackerId: 's1',
            targetId: 'hero',
            fromHex: { q: 1, r: 0 },
            itemKey,
            ring: [{ q: 1, r: 0 }],
          }),
          ev('STRIKES_RESOLVED', {
            creatureId: 'hero',
            results: [{ strikeId: 'x', attackerId: 's1', outcome: 'hit', damage: 1 }],
          }),
        ],
        [hero, skeleton],
      )[0] as { toolKey: string; splashAt: unknown[] };
    const blade = strike('bone-blade');
    expect(blade.toolKey).toBe('sword');
    expect(blade.splashAt).toHaveLength(1);
    const bare = strike('unarmed');
    expect(bare.toolKey).toBe('hand');
    expect(bare.splashAt).toEqual([]);
  });
});
