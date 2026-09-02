import { describe, expect, it } from 'vitest';
import { axialNeighbor } from '../utils/hex-utils';
import { WORLD_SECTIONS } from './world-sections.content';
import { WORLD_TERRAIN } from './world-terrain.content';
import { WORLD_ARCHETYPES } from './world-archetypes.content';
import {
  WORLD_SECTION_TAGS,
  WORLD_TERRAIN_KEYS,
  WorldArchetypeDefSchema,
  WorldSectionDefSchema,
  WorldTerrainDefSchema,
} from './world-section-schema';

const hexKey = (h: { q: number; r: number }) => `${h.q}:${h.r}`;

function isContiguous(hexes: { q: number; r: number }[]): boolean {
  const all = new Set(hexes.map(hexKey));
  const seen = new Set<string>([hexKey(hexes[0])]);
  const queue = [hexes[0]];

  while (queue.length) {
    const cur = queue.shift()!;
    for (let dir = 0; dir < 6; dir += 1) {
      const n = axialNeighbor(cur, dir);
      const k = hexKey(n);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }

  return seen.size === all.size;
}

describe('world terrain content', () => {
  it('has an entry for every terrain key', () => {
    for (const key of WORLD_TERRAIN_KEYS) {
      expect(WORLD_TERRAIN[key], `missing terrain "${key}"`).toBeDefined();
    }
  });

  it.each(WORLD_TERRAIN_KEYS)('terrain "%s" passes schema validation', (key) => {
    expect(WorldTerrainDefSchema.safeParse(WORLD_TERRAIN[key]).success).toBe(true);
  });
});

describe('world section content', () => {
  it.each(WORLD_SECTIONS.map((s) => [s.key, s] as const))(
    'section "%s" passes schema validation',
    (_key, section) => {
      const result = WorldSectionDefSchema.safeParse(section);
      if (!result.success) throw new Error(result.error.message);
      expect(result.success).toBe(true);
    },
  );

  it.each(WORLD_SECTIONS.map((s) => [s.key, s] as const))(
    'section "%s" has no duplicate hexes and is contiguous',
    (_key, section) => {
      const keys = section.hexes.map(hexKey);
      expect(new Set(keys).size).toBe(keys.length);
      expect(isContiguous(section.hexes)).toBe(true);
    },
  );

  it.each(WORLD_SECTIONS.map((s) => [s.key, s] as const))(
    'every seam of section "%s" sits on one of its hexes',
    (_key, section) => {
      const hexKeys = new Set(section.hexes.map(hexKey));
      for (const seam of section.seams) {
        expect(hexKeys.has(hexKey(seam))).toBe(true);
      }
    },
  );

  it('has unique section keys', () => {
    const keys = WORLD_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers every section tag at least once', () => {
    const present = new Set(WORLD_SECTIONS.flatMap((s) => s.tags));
    for (const tag of WORLD_SECTION_TAGS) {
      expect(present.has(tag), `no section tagged "${tag}"`).toBe(true);
    }
  });

  it('uses every terrain key at least once', () => {
    const present = new Set(WORLD_SECTIONS.flatMap((s) => s.hexes.map((h) => h.terrain)));
    for (const key of WORLD_TERRAIN_KEYS) {
      expect(present.has(key), `no section uses terrain "${key}"`).toBe(true);
    }
  });

  it('has exactly one CAMP_ANCHOR section', () => {
    const anchors = WORLD_SECTIONS.filter((s) => s.tags.includes('CAMP_ANCHOR'));
    expect(anchors).toHaveLength(1);
  });
});

describe('world archetype content', () => {
  it.each(WORLD_ARCHETYPES.map((a) => [a.key, a] as const))(
    'archetype "%s" passes schema validation',
    (_key, archetype) => {
      const result = WorldArchetypeDefSchema.safeParse(archetype);
      if (!result.success) throw new Error(result.error.message);
      expect(result.success).toBe(true);
    },
  );

  it('every archetype requires only tags that a section actually carries', () => {
    const sectionTags = new Set(WORLD_SECTIONS.flatMap((s) => s.tags));
    for (const archetype of WORLD_ARCHETYPES) {
      for (const tag of archetype.requiredTags) {
        expect(sectionTags.has(tag), `${archetype.key} requires unplaceable tag "${tag}"`).toBe(
          true,
        );
      }
    }
  });

  it('has unique archetype keys', () => {
    const keys = WORLD_ARCHETYPES.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
