export { EHexActionType as EHexActionTypeForTests } from '@hexoflat/engine/enums/hex-action-type';
export { deserializeWorld, serializeWorld } from '@hexoflat/engine';
import { MAP_BOUND_WORLD_COMMANDS } from '@hexoflat/engine/aggregates/world-player-commands';

const MAP_BOUND: ReadonlySet<string> = new Set(MAP_BOUND_WORLD_COMMANDS);

export function onHeldMap(
  type: string,
  payload: Record<string, unknown>,
  progressState: unknown,
): Record<string, unknown> {
  if (!MAP_BOUND.has(type) || 'expectedMapId' in payload) return payload;
  const presence = (progressState as { presence?: { mapId: string } | null }).presence;
  return { ...payload, expectedMapId: presence?.mapId ?? 'no-map-held' };
}

type Relocator = {
  relocateFixture(userId: string, heroId: string, raw: unknown): Promise<unknown>;
};

export async function placeHeroIn(
  world: Relocator,
  userId: string,
  heroId: string,
  locationKey: string,
): Promise<void> {
  const previous = process.env.HEXOFLAT_E2E_FIXTURES;
  process.env.HEXOFLAT_E2E_FIXTURES = '1';
  try {
    await world.relocateFixture(userId, heroId, { locationKey });
  } finally {
    if (previous === undefined) delete process.env.HEXOFLAT_E2E_FIXTURES;
    else process.env.HEXOFLAT_E2E_FIXTURES = previous;
  }
}
