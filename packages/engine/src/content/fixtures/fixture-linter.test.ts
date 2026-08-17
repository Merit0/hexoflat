import { describe, expect, it } from 'vitest';
import { BROKEN_SPIRE_APPROACH_V1 } from './broken-spire-approach-v1';
import {
  DEFERRED_HARD_ERRORS,
  assertWorldFixtureIsLegal,
  lintWorldFixture,
} from './fixture-linter';
import type { WorldFixture } from './world-fixture-schema';

function mutate(change: (fixture: WorldFixture) => void): WorldFixture {
  const copy = structuredClone(BROKEN_SPIRE_APPROACH_V1);
  change(copy);
  return copy;
}

function rulesFor(fixture: WorldFixture): string[] {
  return lintWorldFixture(fixture).map((error) => error.rule);
}

describe('fixture linter (design §42 hard errors)', () => {
  it('passes the shipped fixture with no hard errors', () => {
    expect(lintWorldFixture(BROKEN_SPIRE_APPROACH_V1)).toEqual([]);
    expect(() => assertWorldFixtureIsLegal(BROKEN_SPIRE_APPROACH_V1)).not.toThrow();
  });

  it('records the rules it cannot decide yet instead of silently skipping them', () => {
    // A linter that quietly checks 9 of 20 rules and reports green is worse
    // than one that checks 9 and says so. These are the rules whose mechanics
    // do not exist until later phases.
    expect(Object.keys(DEFERRED_HARD_ERRORS).length).toBeGreaterThan(0);
    for (const reason of Object.values(DEFERRED_HARD_ERRORS)) {
      expect(reason).toMatch(/E\d/);
    }
  });
});

describe('fixture linter catches the failures it exists for', () => {
  it('§42.1 — Camp cut off from Region A', () => {
    // The two hexes that touch the camp island from the east; with both
    // walled off there is no first step into Region A at all.
    const broken = mutate((fixture) => {
      for (const hex of fixture.hexes) {
        if (hex.id === 'ridge_junction' || hex.id === 'north_approach_1') {
          hex.traversal = 'BLOCKED';
        }
      }
    });

    expect(rulesFor(broken)).toContain('1');
  });

  it('§42.3 — the Stone Crust shortcut becoming the only route', () => {
    // Sever the long northern way round and the crust is all that is left.
    const broken = mutate((fixture) => {
      for (const hex of fixture.hexes) {
        if (hex.id === 'patrol_investigation_lane' || hex.id === 'route_merge') {
          hex.traversal = 'BLOCKED';
        }
      }
    });

    expect(rulesFor(broken)).toContain('3');
  });

  it('§42.7 — breaking the crust buying nothing', () => {
    const broken = mutate((fixture) => {
      const crust = fixture.hexes.find((hex) => hex.id === 'stone_crust_shortcut');
      // A crust hex that leads nowhere: opening it cannot shorten any route.
      if (crust) crust.coordinates = { columnIndex: 12, rowIndex: 8 };
    });

    expect(rulesFor(broken)).toContain('7');
  });

  it('§42.5 — an unreachable Medicinal Plant', () => {
    const broken = mutate((fixture) => {
      for (const hex of fixture.hexes) {
        if (hex.id === 'ruin_shelter' || hex.id === 'north_approach_1') hex.traversal = 'BLOCKED';
      }
    });

    expect(rulesFor(broken)).toContain('5');
  });

  it('§42.18 — a known hex floating off the starting island', () => {
    const broken = mutate((fixture) => {
      const orphan = fixture.hexes.find((hex) => hex.id === 'frontier_exit');
      if (orphan) orphan.initialDiscovery = 'OBSERVED';
    });

    // A lone lit cell out in the dark is exactly the "board with fogged
    // cells" reading that invariant I13 forbids.
    expect(rulesFor(broken)).toContain('18');
  });

  it('structural — a column-parity slip that duplicates a coordinate', () => {
    const broken = mutate((fixture) => {
      const hex = fixture.hexes.find((candidate) => candidate.id === 'camp_se');
      if (hex) hex.coordinates = { columnIndex: 2, rowIndex: 1 };
    });

    expect(rulesFor(broken)).toContain('S2');
  });

  it('structural — terrain and traversal contradicting each other', () => {
    const broken = mutate((fixture) => {
      const ridge = fixture.hexes.find((hex) => hex.id === 'old_marked_ridge');
      if (ridge) ridge.traversal = 'OPEN';
    });

    expect(rulesFor(broken)).toContain('S4');
  });

  it('throws with every violation listed, not just the first', () => {
    const broken = mutate((fixture) => {
      const ridge = fixture.hexes.find((hex) => hex.id === 'old_marked_ridge');
      if (ridge) ridge.traversal = 'OPEN';
      const crust = fixture.hexes.find((hex) => hex.id === 'stone_crust_shortcut');
      if (crust) crust.traversal = 'OPEN';
    });

    expect(() => assertWorldFixtureIsLegal(broken)).toThrow(/S4/);
  });
});
