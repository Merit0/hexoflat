export { EHexActionType as EHexActionTypeForTests } from '@hexoflat/engine/enums/hex-action-type';
export { deserializeWorld, serializeWorld } from '@hexoflat/engine';

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
