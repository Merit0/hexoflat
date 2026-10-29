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
  swordDropTiles: 1.1,
  swordLength: 0.42,
  ejectLiftTiles: 0.45,
  heartShakeTiles: 0.07,
  fallShakeTiles: 0.1,
  shakeWaves: 3,
} as const;
