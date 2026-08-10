/**
 * Mirrors the engine's `THeroToolKey` union — HAND | AXE | PICKAXE | THandEquipmentKeys
 * (SWORD | SHIELD) in packages/engine's equipment.content.ts — as a proper enum, so
 * Features can talk about `Tool.HAND` instead of a bare string literal. A local mirror
 * rather than an import from `@hexoflat/engine`: apps/playwright deliberately has no
 * dependency on the engine package (see the note in hex-board.component.ts about why
 * geometry comes from `window.__HEXOFLAT_TEST__` instead) — the five string values
 * here are all this suite needs to know about the type.
 */
export enum Tool {
  HAND = 'hand',
  AXE = 'axe',
  PICKAXE = 'pickaxe',
  SWORD = 'sword',
  SHIELD = 'shield',
}
