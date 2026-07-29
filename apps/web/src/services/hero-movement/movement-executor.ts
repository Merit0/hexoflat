import type { IHexCoordinates } from '@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface';

export const HERO_MOVEMENT_STEP_DELAY_MS = 190;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function executeMovementRoute(
  route: IHexCoordinates[],
  onStep: (coord: IHexCoordinates, index: number) => void | boolean | Promise<void | boolean>,
  stepDelayMs = HERO_MOVEMENT_STEP_DELAY_MS,
): Promise<void> {
  for (let index = 0; index < route.length; index++) {
    const shouldContinue = await onStep(route[index], index);
    if (shouldContinue === false) {
      break;
    }

    if (index < route.length - 1) {
      await sleep(stepDelayMs);
    }
  }
}
