import { describe, expect, it } from 'vitest';
import { buildDevBattlefield } from './dev-battlefield';

const base = { seed: 'bone-crypt-1', approach: 'west', ambush: false, showZones: true, mode: null };

describe('dev battlefield', () => {
  it('shows the generated field with both deployment zones for a fixed seed', () => {
    const view = buildDevBattlefield(base);
    const tones = new Set(view.overlay.marks.map((m) => m.tone));
    expect(tones).toEqual(new Set(['heroZone', 'enemyZone']));
    expect(view.scene.creatures).toHaveLength(5);
    expect(view.banner.round).toBe(1);
    expect(buildDevBattlefield(base)).toEqual(view);
  });

  it('moves the enemy zone to the flanks on an ambush and hands them the first-round edge', () => {
    const normal = buildDevBattlefield(base);
    const ambush = buildDevBattlefield({ ...base, ambush: true });
    const enemyZone = (v: typeof normal) =>
      v.overlay.marks.filter((m) => m.tone === 'enemyZone').map((m) => `${m.hex.q},${m.hex.r}`);
    expect(enemyZone(ambush)).not.toEqual(enemyZone(normal));
    const westmost = (v: typeof normal) =>
      Math.min(...v.scene.creatures.filter((c) => c.side === 'enemies').map((c) => c.pos.q));
    expect(westmost(ambush)).toBeLessThan(westmost(normal));
  });

  it('turns the zones off and shows move prices when the hero holds the turn', () => {
    for (let n = 1; n <= 20; n++) {
      const view = buildDevBattlefield({ ...base, seed: `s${n}`, showZones: false, mode: 'move' });
      const heroTurn = view.scene.activeId === 'merito';
      expect(view.overlay.marks.some((m) => m.tone === 'heroZone')).toBe(false);
      expect(view.overlay.marks.some((m) => m.tone === 'reachable')).toBe(heroTurn);
    }
  });
});
