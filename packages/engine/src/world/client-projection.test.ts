import { describe, expect, it } from 'vitest';
import { cosmeticSeedFor, projectWorldForClient } from './client-projection';
import { createServerWorld, serializeWorld } from './server-world';

describe('what the client sees of a world seed', () => {
  const world = createServerWorld('cave', 'map-1', 'expedition-secret', 'hero-1');
  const sent = projectWorldForClient(serializeWorld(world));

  it('is derived, never the seed the server rolls loot and ambushes from', () => {
    expect(sent.worldSeed).toBe(cosmeticSeedFor(world.worldSeed));
    expect(sent.worldSeed).not.toBe(world.worldSeed);
    expect(JSON.stringify(sent)).not.toContain(world.worldSeed);
    expect(JSON.stringify(sent)).not.toContain('expedition-secret');
  });

  it('hides the descriptor seed the same way and keeps the rest of the descriptor', () => {
    const original = world.descriptor as { seed?: string } | null;
    const shown = sent.descriptor as { seed?: string } | null;
    if (original?.seed) {
      expect(shown?.seed).toBe(cosmeticSeedFor(original.seed));
      expect(shown?.seed).not.toBe(original.seed);
    }
    expect({ ...shown, seed: undefined }).toEqual({ ...original, seed: undefined });
  });

  it('is stable for one map and differs between maps', () => {
    const again = projectWorldForClient(serializeWorld(world));
    const other = projectWorldForClient(
      serializeWorld(createServerWorld('cave', 'map-2', 'expedition-secret', 'hero-1')),
    );
    expect(again.worldSeed).toBe(sent.worldSeed);
    expect(other.worldSeed).not.toBe(sent.worldSeed);
  });
});
