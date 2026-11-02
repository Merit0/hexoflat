import { describe, expect, it } from 'vitest';
import { battleOverlayModel } from '@/render/battle/battle-overlay-model';
import { buildDevBattle, type DevBattlefieldOptions } from './dev-battlefield';

const base: DevBattlefieldOptions = {
  seed: 'bone-crypt-1',
  approach: 'west',
  ambush: false,
  squad: 'bone-court',
  withFriend: false,
};

function zoneKeys(options: DevBattlefieldOptions, tone: 'heroZone' | 'enemyZone') {
  const { deploy } = buildDevBattle(options);
  return battleOverlayModel({ projection: null, zones: deploy.zones, mode: null, results: [] })
    .marks.filter((m) => m.tone === tone)
    .map((m) => `${m.hex.q},${m.hex.r}`);
}

describe('dev battlefield', () => {
  it('deploys the chosen squad on a generated field with both zones for a fixed seed', () => {
    const battle = buildDevBattle(base);
    expect(battle.heroIds).toEqual(['merito']);
    expect(battle.deploy.setup.creatures).toHaveLength(4);
    expect(battle.deploy.names).toEqual({ merito: 'Merito' });
    expect(zoneKeys(base, 'heroZone').length).toBeGreaterThan(0);
    expect(zoneKeys(base, 'enemyZone').length).toBeGreaterThan(0);
    expect(buildDevBattle(base)).toEqual(battle);
  });

  it('moves the enemy zone to the flanks on an ambush and hands them the first-round edge', () => {
    const normal = buildDevBattle(base);
    const ambush = buildDevBattle({ ...base, ambush: true });
    expect(zoneKeys({ ...base, ambush: true }, 'enemyZone')).not.toEqual(
      zoneKeys(base, 'enemyZone'),
    );
    const westmost = (b: typeof normal) =>
      Math.min(...b.deploy.setup.creatures.filter((c) => c.side === 'enemies').map((c) => c.pos.q));
    expect(westmost(ambush)).toBeLessThan(westmost(normal));
    expect(ambush.deploy.setup.advantage).toBe('enemies');
    expect(normal.deploy.setup.advantage).toBe('heroes');
  });

  it('adds a hot-seat friend and gives the heroes a bag to swap from', () => {
    const battle = buildDevBattle({ ...base, withFriend: true, squad: 'skeleton-pack' });
    const heroes = battle.deploy.setup.creatures.filter((c) => c.side === 'heroes');
    expect(battle.heroIds).toEqual(['merito', 'lina']);
    expect(heroes.map((h) => h.bag?.map((i) => i.key))).toEqual([
      ['dagger', 'health-potion'],
      ['dagger', 'health-potion'],
    ]);
    expect(battle.deploy.setup.creatures.filter((c) => c.side === 'enemies')).toHaveLength(2);
  });
});
