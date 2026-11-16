import { ref } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export interface PortalFxHooks {
  enter(portal: IHexCoordinates): Promise<void>;
  exit(portal: IHexCoordinates): Promise<void>;
  release(): void;
}

export const portalFxBusy = ref(false);

let hooks: PortalFxHooks | null = null;
const holds = new Set<symbol>();
const timers = new Set<ReturnType<typeof setTimeout>>();

function refreshBusy(): void {
  portalFxBusy.value = holds.size > 0;
}

function resetPortalFx(): void {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  holds.clear();
  refreshBusy();
}

export function registerPortalFx(next: PortalFxHooks): () => void {
  hooks = next;
  return () => {
    if (hooks !== next) return;
    hooks = null;
    resetPortalFx();
  };
}

function hold(): () => void {
  const token = Symbol('portal-fx-hold');
  holds.add(token);
  refreshBusy();
  return () => {
    if (holds.delete(token)) refreshBusy();
  };
}

export function holdPortalFxFor(durationMs: number): void {
  const release = hold();
  const timer = setTimeout(() => {
    timers.delete(timer);
    release();
  }, durationMs);
  timers.add(timer);
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
