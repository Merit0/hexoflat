import { Assets, type Spritesheet, type Texture } from 'pixi.js';

export const BLOOD_SPLASH_SHEET =
  '/hex-assets/hex-effects/blood-splash/blood-splash-sprites-vfx.json';

let frames: Texture[] = [];
let loading: Promise<void> | null = null;

export function preloadBloodSplash(): Promise<void> {
  loading ??= Assets.load<Spritesheet>(BLOOD_SPLASH_SHEET)
    .then((sheet) => {
      frames = sheet.animations['splash'] ?? [];
    })
    .catch((error: unknown) => {
      console.warn(`[blood-splash] failed to load "${BLOOD_SPLASH_SHEET}"`, error);
    });
  return loading;
}

export function bloodSplashFrames(): readonly Texture[] {
  return frames;
}

export function splashFrameIndex(progress: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}
