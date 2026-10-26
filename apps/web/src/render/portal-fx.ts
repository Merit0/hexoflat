import { ref } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export interface PortalFxHooks {
  enter(portal: IHexCoordinates): Promise<void>;
  exit(portal: IHexCoordinates): Promise<void>;
  release(): void;
}

export const portalFxBusy = ref(false);

let hooks: PortalFxHooks | null = null;
let holds = 0;

export function registerPortalFx(next: PortalFxHooks): () => void {
  hooks = next;
  return () => {
    if (hooks === next) hooks = null;
  };
}

function hold(): () => void {
  holds += 1;
  portalFxBusy.value = true;
  return () => {
    holds = Math.max(0, holds - 1);
    portalFxBusy.value = holds > 0;
  };
}

export function holdPortalFxFor(durationMs: number): void {
  const release = hold();
  setTimeout(release, durationMs);
}

async function playHeld(play: (() => Promise<void>) | undefined): Promise<void> {
  if (!play) return;
  const release = hold();
  try {
    await play();
  } finally {
    release();
  }
}

export function playPortalEnter(portal: IHexCoordinates): Promise<void> {
  return playHeld(hooks ? () => hooks!.enter(portal) : undefined);
}

export function playPortalExit(portal: IHexCoordinates): Promise<void> {
  return playHeld(hooks ? () => hooks!.exit(portal) : undefined);
}

export function releasePortalFx(): void {
  hooks?.release();
}
