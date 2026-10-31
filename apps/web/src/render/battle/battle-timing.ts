export const BATTLE_TIMING = {
  enemyTurnDelayMs: 700,
  strikeMs: 2000,
  stepMs: 190,
  slidePerHexMs: 250,
  ledgeFallShakeMs: 320,
  sawEjectMs: 350,
  heartShakeMs: 280,
} as const;

export const BATTLE_MOTION = {
  dropSpreadTiles: 0.16,
  dropRadiusTiles: 0.065,
  maxDropsPerSide: 4,
  toolOrbitTiles: 0.7,
  toolFadeIn: 0.1,
  toolFadeOut: 0.15,
  ejectLiftTiles: 0.45,
  heartShakeTiles: 0.07,
  fallShakeTiles: 0.1,
  shakeWaves: 3,
} as const;
