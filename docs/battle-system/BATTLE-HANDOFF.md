# Battle system — hand-off (2026-11-01)

One page for a fresh chat: what exists, what Oleh decided, where the code lives, how it is tested, what is open. The phase plan is `docs/BATTLE-SYSTEM-PLAN.md` (journal at the bottom is the decision history); this file is the current truth when they disagree.

## What a fight is now

1. ATTACK on a squad token starts the battle at once (no deploy card). `squad-flow.ts` prepares the field and calls `battleStore.start()`. Initiative is rolled **once**; the same 1 → 2 → 3 order repeats until the fight ends (no re-rolls).
2. A **melee strike is picked from where the attacker stands** if some free neighbour of the target can be reached with the Will left after the strike (7 Will). `strike` opens `state.reaction`:
   - **block** stage, 5 s (`blockWindowMs`): the defender is active out of turn and raises free shields on the ring around him (capacity = shield in hand); there is no confirm button, the 5 s timer (`reaction-timeout`) or TAKE HIT closes it. The attacker waits and only sees `shieldsRaised`.
   - **aim** stage, 5 s: the attacker picks the hex to strike from among `aimOptions` (reachable ring hexes, his own hex is free) and walks there paying the steps. Not chosen in time → he strikes from where he stands.
   - The real shields are revealed (2.5 s on the board); a shield on the chosen hex blocks. No shield or a single option resolves at once. After the deadline the engine refuses shields and aim (`WINDOW_CLOSED`).
3. **Sweep:** after a melee strike every other living enemy of the attacker's side beside the attacker takes the weapon power (`STRIKE_SWEPT`, no window). Never allies or the swinger; ranged weapons do not sweep. Enemy AI stays out of crowds (`isCrowdedAround`, max 2 around one hero) unless the hero is boxed in (2 or fewer free exits); the hero's `push` opens a box.
4. Hero card: no stage bar, no defense tag, no swap button, no planned-cost line, no "Moved N steps" hint. The **Turn cost** panel shows the price of the NEXT action only (`composables/battle-next-cost.ts`: path price in MOVE, tool use price in ACTION), red when above the Will left. Button label END TURN. Hexes are not coloured in battle; only the real shield sprite is drawn.
5. Hero health has one source (`heroStore`): the battle starts from its current and max health and writes damage back after every command (`followBattleHealth`). Events are logged to the Events tab (`services/battle/battle-event-log.ts`).

## Content facts

- Hero battle items: sword (power 2), wooden shield (2 sides), health potion (use price from the content, not wired into play yet). Axe/pickaxe/scroll give an empty hand; USE on them in a battle says it cannot be used.
- `usePrice` is a global content field (`loot.usePrice`, `usePriceOf`); `content/use-price.test.ts` enforces it for every usable item.
- Crypt battlefield: floor, border wall, 1–2 saws. Ledges, rubble, oil, pillars, boulders are not generated (the engine still supports them). New saw sprite `hex-constructs/saw-token.png`.
- A saw hex is never a strike position: `strikeSideHexes` (`battle-board.ts`) = free neighbours of the target without saws; used by `strikeRing`, `reachRefusal`, AI `reachableFoes` and the decoy-shield overlay (`battle-overlay-model.ts`). Test: `strike.test.ts` (REQ-BTL-005).
- Squads: `lone-skeleton`, `skeleton-pack` (2 warriors), `archer-watch`, `bone-court` (king + 2 warriors; the cave generator places it in the deep spot; its map token uses the king sprite). Warriors 5 hp, king 13 hp, king cleaver power 1.
- Fog: one rule for every board (hero hex + six neighbours; `BY_REGION` removed). Dungeons cover hidden hexes with `fog-hex.png`, the world with `cloud-hex.png`.
- Cave entrance/exit portal is built into the **outer wall** of the entry room (`pieces/entry.ts`; the entry room is the one farthest from the board centre in `pieces/blobs.ts`), so it is on the border, never in the middle.

## Code map

| Area           | Files                                                                                                                                                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine rules   | `packages/engine/src/battle/` — `reaction.ts` (window, aim, sweep), `strike.ts` (reach, ring), `defend.ts`, `turn.ts`, `initiative.ts`, `projection.ts` (what each side may see), `ai/` (`ai-common.ts` crowd + shield guess + aim), `apply-battle.ts` (enemy turn, instant enemy defence), `battle-sim.ts` |
| Engine content | `battle-catalogue.ts`, `content/boards/models/battlefield-crypt.ts`, `content/boards/models/cave.ts`, `content/loot.content.ts`                                                                                                                                                                             |
| Web logic      | `apps/web/src/composables/` — `use-battle-view.ts`, `battle-view.ts`, `battle-hero-card.ts`, `battle-next-cost.ts`, `battle-board-tap.ts`, `battle-tool-hex.ts`, `use-battle-reaction.ts`; `stores/battle-store.ts`; `services/squads/squad-flow.ts`; `services/battle/`                                    |
| Web render     | `render/battle/` (animation plan/sample/queue, timing, look, wound drops), `render/layers/battle-*.ts`, `render/fog-look.ts`                                                                                                                                                                                |
| Test hooks     | `apps/web/src/e2e/battle-hooks.ts` (+ `create-test-api.ts`, `test-api.types.ts`)                                                                                                                                                                                                                            |

## Tests

- Engine unit: per rule (`defend`, `strike`, `sweep`, `enemy-ai`, `initiative`, `projection`, `wounds`, `hands`, `items`, `battlefield`), `balance.test.ts` (500 seeds: 1 hero vs 2 warriors 60–85%, 2 heroes vs the full squad 40–60%), `battle-fuzz.test.ts` (random play with garbage actions; `FUZZ_BATTLES=1500` for a long run), `battle-adhoc.test.ts` (a passive hero is always beaten), `fog-all-maps.test.ts`.
- Web unit: `battle-view*.test.ts`, `battle-view.fuzz.test.ts`, `battle-next-cost.test.ts`, render tests.
- e2e (`apps/playwright/e2e/world/`): `battle-flow.spec.ts` (initiative, block window, shields, timeout, reload, aim, sweep, cost panel, move/undo, end turn, defeat, king sprite, log, hearts, scroll refusal), `squad-actions.spec.ts`, `dungeon-fog.spec.ts` (mist hex, exit on the border). Full suite last run: 93 passed (≈9 min) via `sh scripts/pre-push-e2e.sh`; a subset: `sh scripts/pre-push-e2e.sh e2e/world/battle-flow.spec.ts`.
- Not covered: how it looks (animation, colours, fog art) — only Oleh's eyes. Claude never drives the browser.

## Open / parked

- Potions in battle hands are not wired into play; energy/mana bottles are visual only.
- Only the sword is a hero weapon in battle (adding one = content + `BATTLE_ITEM_BY_HEXOBJECT` + `BATTLE_ITEMS` + texts).
- `stance` (unspent Will) is now unused by rules; `stanceMax` and the field remain. Candidate for removal.
- Unused assets: `battle-tokens/*.svg`, `hex-effects/fog-tile-image.png`.
- The engine still supports ledge/oil/rubble/boulder; no recipe places them.
- Pull (grab an enemy) was removed on purpose and will return with Oleh's design.
- The 1-hero-vs-2-warriors balance band was lowered from 70% to 60% when the sweep arrived.

## Working rules that matter here (Oleh)

Answer in Ukrainian; never commit (give a title/body); no comments in code; every button/input has a `data-testid`; do not change the owner's visual design without a request; no manual browser checks (e2e only); update the skills and CLAUDE.md after every finished feature.
