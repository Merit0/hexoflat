# Dungeon exit and victory tool scenarios

Date: 2026-11-19. Branch: `equipment-attributes-improvement`.

## Dungeon exit and victory tool regressions (2026-11-19)

- `world/hero-placement.findEntryHex(map, location, rng, fromLocation?)` prefers a destination gate whose WORLD ENTER leads back to `fromLocation`; `travelWorld` supplies the origin for gate travel. If no reciprocal gate can provide a free hex, the existing entry/exit fallback remains. Border crossings and portals keep their existing paths. This fixes cave exit placing the hero near Silesia's general camp entry rather than the cave entrance. No schema/version changes.
- Inventory `equip-token.vue` allows default-hand USE during the victory collection phase via `collectHero`; the hand remains blocked during an active fight. Other unsupported battle items stay blocked. Activation uses the existing `activateBattleHand`, not the world tool.
- Regressions: `travel.test.ts` checks cave return over five seeds; `equip-token-position.test.ts` checks hand activation before/after victory. Browser `board/dungeon-exit.spec.ts` performs three real enter/exit/reload cycles and checks distance 1 from the cave entrance and the saved coordinates. `combat/battle-collect.spec.ts` separately activates a previously hidden tool through mouse wheel and Inventory USE, then actually reads a grave.

Initial browser run found two defects: cave exit returned distance 3 from its entrance (expected 1), and Inventory USE left the battle tool hidden after victory. Mouse-wheel activation passed. Existing pricing-only dungeon exit coverage and wheel-only collect coverage did not catch these cases. The fixes are pinned by engine/component tests and the new browser scenarios.

## Verification

- Targeted engine/component regressions passed before the full run after the fixes.
- Full unit suite: engine 2199 passed / 2 skipped, web 4184, API 272, Playwright helpers 37.
- Typecheck passed for all packages.
- `sh scripts/pre-push-e2e.sh e2e/board/dungeon-exit.spec.ts e2e/combat/battle-collect.spec.ts --retries=0`: 7/7 passed, including all three new scenarios and the existing collection regressions. Dungeon entry/exit and reload checked three consecutive times.
- No commits created; previous staged and unstaged work preserved.
