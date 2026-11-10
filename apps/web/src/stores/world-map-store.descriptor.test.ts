import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { seedFakeSession } from '@/test-support/fake-session';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
}));

describe('useWorldMapStore: descriptors follow the location', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-descriptor');
  });

  it('keeps the location its own descriptor instead of the one it was left from', () => {
    const world = useWorldMapStore();
    world.goToLocation('camping');
    const campHash = (world.descriptor as { drawingHash?: string }).drawingHash;

    world.goToLocation('silesia');
    const silesiaHash = (world.descriptor as { drawingHash?: string }).drawingHash;
    world.goToLocation('camping');

    expect(silesiaHash).not.toBe(campHash);
    expect((world.descriptor as { drawingHash?: string }).drawingHash).toBe(campHash);
  });
});
