export const CREATURE_SPRITES = {
  hero: '/hero-asssets/human-hex.png',
  skeleton: '/enemy-assets/enemies-sprites/skeleton-hex.png',
  skeletonKing: '/enemy-assets/boss-hex-images/skeleton-king-hex.png',
} as const;

const KING_KINDS = new Set(['skeleton-king', 'king']);

export function creatureSprite(side: 'heroes' | 'enemies', kind?: string): string {
  if (side === 'heroes') return CREATURE_SPRITES.hero;
  return kind && KING_KINDS.has(kind) ? CREATURE_SPRITES.skeletonKing : CREATURE_SPRITES.skeleton;
}
