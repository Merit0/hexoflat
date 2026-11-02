export const BATTLE_TIMING = {
  enemyTurnDelayMs: 700,
  strikeMs: 1000,
  stepMs: 190,
  slidePerHexMs: 250,
  ledgeFallShakeMs: 320,
  sawEjectMs: 350,
  heartShakeMs: 280,
} as const;

export const BATTLE_MOTION = {
  splashStart: 0.55,
  splashSizeTiles: 1.5,
  toolOrbitTiles: 0.7,
  toolTurns: 2,
  toolFadeIn: 0.1,
  toolFadeOut: 0.15,
  ejectLiftTiles: 0.45,
  heartShakeTiles: 0.07,
  fallShakeTiles: 0.1,
  shakeWaves: 3,
} as const;
