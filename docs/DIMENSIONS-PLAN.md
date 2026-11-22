# Gameplay dimensions

## Status and scope

D0 [DONE — 2026-11-21]: repository audit and implementation specification recorded.
D1 foundation and D2 token identity/migration are complete. D3–D6 remain planned.
Work branch: `implement-game-dimensions`. The user explicitly authorized continuing D2 in the same chat. Do not commit without authorization.

## Decisions

User requirements:

- Every concrete gameplay object belongs to exactly one dimension.
- HEAVEN → SPARK; EARTH → IDOL; UNDERWORLD → GLOOM; NOWHERE → ALIEN.
- ALIEN replaces God Executor, including existing saved tokens. User spelling correction: ALIEN (serialized `alien`).
- Silesia and camping belong to EARTH.
- Dimensions govern generation scope and explicit object relationships.

Implementation defaults proposed by this audit (not additional user decisions):

- NOWHERE is an ownership value, not a new playable location. ALIEN initially retains the old unique-only generation restriction and red presentation; no new drop rate is introduced.
- Preserve cave's current UNDERWORLD generation; Silesia North is EARTH.
- Preserve existing foreign drops, shop stock, placements and skill access through explicit relations. Do not introduce equipment-use restrictions or alter balance in this feature.
- Ownership is immutable through travel, pickup, equip, trade and reload. Source location and current location are separate from ownership.
- Shared algorithms/archetypes are not concrete objects. A sword archetype can produce separately identified EARTH, UNDERWORLD and HEAVEN variants; each actual variant/token has exactly one owner. No concrete object's dimension is an array or inferred from its current board.
- Generic attributes, mathematical rules and reusable asset files can be shared implementation data. Dimension-owned generation profiles explicitly select eligible attributes; do not duplicate stat algorithms or invent exclusive attribute pools without a balance decision.

## D0 audit: current implementation

- `registry/location-token-origin.ts`: `realmOfBoard` derives GLOOM from DUNGEON and IDOL from STATIC. Replace this inference with location ownership.
- `registry/world-map-registry.ts`: MapDefinition lacks dimension; four locations exist.
- `tokens/token-origin.ts`: origin is `{ realm, mapTier }`; default origin is IDOL tier 1. Several acquisition paths use this fallback.
- `tokens/token-schema.ts`: owned tokens store `rarity` but no dimension; ordinary stacks only carry itemKey/amount. Token identity must remain distinct from the `origin: base|unique` discriminator.
- `content/item-types.content.ts`: reusable item types allow multiple realms. Concrete dimensional variants need a canonical resolution contract, not conflicting top-level content and token ownership.
- `tokens/equipment/generator/`: attribute selection knows tier, group, type and RNG, but not dimension. Preserve enabled/type/tool/implemented/deprecated gates and owned-token compatibility.
- `loot/roll-for.ts`, `loot/tokenize-drops.ts`: table selection precedes token minting. Eligibility must apply before draws, including guaranteed entries, stackables and unique rewards.
- `quests/quest-token-origin.ts`: seeker reward realm follows its source location; mapTier is captured. Quest runs need stable dimension context, not the hero's later location.
- `battle/battle-state.ts`, `world/battle-world.ts`: battle captures token origin; grave rolls consume it. Keep foreign creature identity independent of battlefield identity.
- `content/token-uniques.content.ts`: lantern-eater is GLOOM; last-verdict is God Executor and carries b_strike. The latter becomes ALIEN/NOWHERE without changing its key, ID, price, attributes or skill.

## Object ownership inventory

The following is the proposed explicit assignment for all 40 current HEXOBJECT_KEYS. Definitions are in `content/{resources,loot,creatures,tools,constructions,equipment}.content.ts`. Assignment is content identity, not a ban on appearing elsewhere.

| Owner      | Current concrete keys                                                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EARTH      | tree, knowledge-book, coins, rock, mountain, axe, hand, pickaxe, sword, shield, camping-entrance, cave-entrance, homeland-gate, health-bottle, energy-bottle, mana-bottle, fireplace, healing-spring, wood-and-leaves, chest, chest-open, stash-chest, trader-stall, training-grounds, quest-board, treasure-map, stone-wall |
| UNDERWORLD | skeletor, emitter, inferno, lone-skeleton, skeleton-pack, archer-watch, bone-court, cave-exit, grave, bone-charm, crown-shard                                                                                                                                                                                                |
| HEAVEN     | return-scroll, return-portal                                                                                                                                                                                                                                                                                                 |
| NOWHERE    | No current HEXOBJECT_KEY; last-verdict is a separate unique-token definition                                                                                                                                                                                                                                                 |

These are authored defaults to implement, not evidence of dimensions already stored in content. A generic sword key currently also serves as a token type; D2 must distinguish the EARTH catalogue object from the dimension-owned generated variants without reclassifying existing GLOOM/SPARK tokens.

| Other content                                                       | Assignment / concrete resolution                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| camping, silesia, silesia-north                                     | EARTH                                                                                                                              |
| cave / Skeletor Kingdom                                             | UNDERWORLD                                                                                                                         |
| crypt battlefield                                                   | UNDERWORLD; other future battlefield variants declare ownership                                                                    |
| seeker field instances                                              | Capture origin location dimension at creation; generic field recipe is reusable                                                    |
| skeleton-warrior, skeleton-archer, skeleton-king battle enemies     | UNDERWORLD                                                                                                                         |
| hero instances                                                      | EARTH initially; acquiring a skill school does not change ownership                                                                |
| ilva trader                                                         | EARTH                                                                                                                              |
| woodcutter, stonebreaker, scholar, bone-hunter board quests         | EARTH; bone-hunter may target UNDERWORLD enemies                                                                                   |
| seeker-1, seeker-2, seeker-3 cards                                  | EARTH; runs record field source and reward context separately                                                                      |
| bionic / demonic / angelic skill definitions                        | EARTH / UNDERWORLD / HEAVEN respectively; cross-school learning remains allowed                                                    |
| lantern-eater / last-verdict uniques                                | UNDERWORLD / NOWHERE                                                                                                               |
| generated equipment (including disabled types)                      | Concrete variant has one dimension; disabled types stay disabled                                                                   |
| battlefield terrain objects, spawned resources, derived open chests | Resolve an authored concrete variant at creation, preserve through transformations; no unowned runtime object                      |
| profiles, loot tables, board recipes                                | Dimension-owned concrete configurations over shared algorithms; reused tables/recipes require explicit scoped variants or bindings |
| names, adjectives, sprites, materials, stat algorithms              | Reusable supporting data; eligible references validated by dimensional profile, not treated as world objects                       |

D1/D2 must turn this inventory into exhaustive registry checks, including battle-only and dynamically created objects. New registry entries must fail validation until assigned. Counts are an audit aid, never a substitute for exhaustive validation.

## Explicit relationships to preserve

- UNDERWORLD cave loot may contain EARTH coins and health potions; skeleton archer/king tables may contain HEAVEN return-scroll. GLOOM equipment remains generated from the cave's own scope.
- EARTH Ilva stock may contain UNDERWORLD bone-charm and HEAVEN return-scroll. Buyback/listings preserve the sold item's dimension; they are not fresh stock generation.
- EARTH map placements may include UNDERWORLD enemies, graves and HEAVEN portals. Audit drawings/recipes at implementation and enumerate actual foreign keys; do not add an unrestricted allow-all rule.
- EARTH cave-entrance connects to UNDERWORLD cave-exit; reciprocal travel is explicitly allowed. Return portals are HEAVEN objects connecting the source and camp.
- EARTH bone-hunter objectives may observe UNDERWORLD enemy kills. Preserve current objective semantics; unrelated quest redesign is excluded.
- NOWHERE last-verdict may carry EARTH b_strike. Unique authored skills/attributes are checked by authored relations, not rerolled against a new random pool.
- Coins stay EARTH and retain their existing no-rarity-light presentation in every location.

Relations must name the operation (placement, drop, stock, quest target/reward, travel, skill reference). One permission must not implicitly authorize every operation. Ordinary inventory carriage remains permitted across dimensions.

## Target contracts

Engine-owned dimension schema and registry are authoritative. Use one family mapping and one ownership resolver per concrete entity category; avoid independent mutable dimension/family fields that can disagree. If both are serialized, validate their agreement.

Generation receives trusted source dimension, source tier, stable source ID, seed/streams and version. Target ownership is determined by the selected same-dimension variant or an explicit foreign relation. Attributes/names/sprites/prices follow the target item's dimension; provenance retains the actual source. Clients cannot choose reward scope.

Validate eligible entries before RNG. Invalid guaranteed drops are content errors, not silently omitted rewards. Empty optional pools have an explicit empty result; empty required pools refuse without mutation. Preserve independent RNG streams, including Trophy bonus rolls. Any changed output contract needs an explicit generator-version decision and regression fixtures.

Future QuestsGenerator contract: trusted source dimension/tier, eligible objective targets, reward policy, seed and version; output one owned quest plus captured target/reward context. Implement only contracts consumed by existing quests now, not an unused generator framework.

## Phases and acceptance

### D0 — Specification [DONE — 2026-11-21]

Deliver ownership inventory, relation policy, acquisition audit, migration requirements and phased acceptance. Complete: this document. Runtime code unchanged. Defaults above remain clearly distinguished from user requirements.

### D1 — Foundation [DONE — 2026-11-22]

Add dimension schemas/registry/mapping, explicit location ownership and content ownership validation. Replace boardKind inference. Characterize old location-origin behavior first.

Acceptance: EARTH dungeon and UNDERWORLD static fixtures resolve correctly; all authored hexobject definitions assigned; missing owners and contradictory family mappings rejected; no new production EARTH fallback. Existing consumers compile through deliberate adapters until D2/D3.

D1 implementation: dimension enum/schema, frozen registry and canonical family mapping; all 40 authored definitions assigned (27 EARTH, 11 UNDERWORLD, 2 HEAVEN); all four registered locations assigned. Content schema validates ownership and item-family agreement. Location generation now reads explicit ownership through the existing base-token adapter, which refuses NOWHERE. No token/save/content version change. Construction key types moved into `content/construction-keys.ts` to respect the file-size limit; existing type imports remain compatible. Characterization tests passed before implementation (14 tests); targeted foundation/content/acquisition coverage passed afterward (118 tests). Validation complete: engine build, workspace `pnpm lint` (existing warnings only), `pnpm typecheck`, and `pnpm test --concurrency=1 -- --maxWorkers=1` passed. Results: 2,394 engine tests, 295 API tests, 4,223 web tests and 40 Playwright-framework unit tests passed; 2 existing engine tests skipped. Browser E2E was not run: D1 changes authored metadata and origin resolution, covered by engine acquisition characterization and API/web suites; no browser flow changed. `git diff --check` passed. D1 was subsequently committed as `22ed19b7` before D2 began.

| Foundation metric                        | Before D1           | After D1           |
| ---------------------------------------- | ------------------- | ------------------ |
| Authored hexobjects with explicit owner  | 0/40                | 40/40              |
| Registered locations with explicit owner | 0/4                 | 4/4                |
| Location family source                   | boardKind inference | explicit dimension |
| Invalid content owner / family           | unchecked           | schema rejection   |
| Owned-token dimension / ALIEN migration  | absent              | deferred to D2     |

### D2 — Objects and token identity [DONE — 2026-11-22]

Wire concrete variants, stacks, unique definitions, factory validation, inventory identity and ALIEN replacement. Add migration alongside each persisted schema change.

Acceptance: ALIEN replaces God Executor in active code/content; old tokens migrate idempotently with identical IDs/values. Every generated item owns one dimension; foreign variants never merge; transforms preserve ownership. Catalogue lookups cannot override a token's dimensional identity. No disabled types enabled.

D2 implementation:

- User corrected the family spelling to **ALIEN** / `alien` on 2026-11-22; this supersedes the earlier spelling everywhere.
- New tokens carry a required `dimension`. The strict current schema and factory validator reject contradictory or missing ownership. Unique definitions declare one owner and validate it against family. Concrete token variants are identified by their type and dimension; they retain individual token IDs.
- `itemTokenSchema` is the compatibility reader used at persisted nesting points. It derives missing ownership from stored family, maps legacy `god-executor` to `alien`, and updates the legacy realm description reference. It is idempotent, leaves caller data untouched and never rerolls stored values. Explicit invalid ownership is rejected.
- Token generator version is 5 for the new output metadata. All 20 seeded golden tokens are otherwise byte-for-byte unchanged after stripping dimension and restoring the previous version. Stored tokens retain their original generatorVersion.
- Tokenless stackables resolve ownership from their existing authored key through `itemDimensionOf`; no foreign variants of stackable definitions are introduced. Tokens use their own dimension instead of generic sword/shield catalogue ownership. Stack merging rejects tokens and different owners even when stack identifiers coincide.
- Container parsing now returns normalized tokens instead of only validating them. World hydration validates supplied tokens/containers and reports corrupt identity rather than silently dropping equipment/contents.
- Active enum, factory errors, sprite tooling, rarity/light helpers, sorting, tooltips and both locales use ALIEN; unique-only eligibility and red appearance are preserved. No disabled equipment type is enabled.
- No CONTENT_VERSION or aggregate version bump: existing aggregate/nested readers normalize the additive metadata at read time, including current-version records. A subsequent ordinary save persists canonical output. Snapshot checksums are verified before normalization. No RNG policy or loot pool change.
- Tests cover nested inventory/progress/trader/listing/battle-ground/container readers, world round trips, strict refusals, foreign gear equip/sell/buyback/list/reload, stack boundaries and real PostgreSQL legacy-token loading. Characterization passed before changes (10 tests). Validation: engine build, workspace lint (existing warnings only), typecheck, formatting of changed code and `git diff --check` passed. Full workspace suite passed: 2,406 engine tests (2 existing skipped), 4,223 web tests, 296 API tests including real PostgreSQL migration, and 40 Playwright-framework unit tests. Browser E2E was not run; no interaction flow changed, and existing tooltip/render/locale tests cover the family rename. D2 remains uncommitted.

| Token identity metric       | Before D2              | After D2                              |
| --------------------------- | ---------------------- | ------------------------------------- |
| Stored concrete token owner | family only            | explicit validated dimension          |
| Exceptional family          | God Executor           | ALIEN / NOWHERE                       |
| New token output version    | 4                      | 5                                     |
| Legacy token values         | retained               | retained, metadata normalized         |
| Container reader            | validates nested token | validates and normalizes nested token |

### D3 — Generators and acquisition [PLANNED]

Wire loot, token type/attribute/name/sprite/price/skill generation, unique drops, camp claim, chest eager/lazy rolls, seeker rewards, graves/Trophy, harvesting, trader refresh, inventory stock supply and developer fixtures. Remove production missing-context fallbacks.

Acceptance: same-scope and explicit foreign cases tested for every acquisition path; guaranteed entries and overrides obey policy; RNG deterministic; impossible mandatory pools fail atomically; existing prices/caps/roll distributions unchanged except intentional eligibility changes documented with versioning.

### D4 — World and quest relations [PLANNED]

Validate drawings/recipes, spawns, battle terrain/creatures, gates/portals, skills and existing quest references. Capture immutable source context for quest runs, battles and deferred actions.

Acceptance: placement errors identify owner/key/operation; legal foreign placements work; quest rewards and deferred loot retain context after travel/reload; future quest generation contract documented without implementing it.

### D5 — Compatibility and presentation [PLANNED]

Audit aggregate upcasters, worlds, unopened containers, battle snapshots, quests, stock/buyback/listings, journal/replay and client projections. Update both locales, hover/tooltips, rarity/light helpers and sprite tooling. Update relevant canonical web/render skills when those areas change.

Acceptance: old saves load without rerolls/loss/reassignment; God Executor legacy strings remain only in explicit migration readers/tests or clearly historical docs. Owned legacy attributes remain effective. Labels show ALIEN and dimension consistently; no hidden seed/loot disclosure. No blanket content-version bump without examining each persistence contract.

### D6 — Integration and closeout [PLANNED]

Verify acquire → inventory → equip/trade → travel → reload across dimensions, including ALIEN and invalid client scope. Cover real API persistence and selector-free Feature/Page/Component E2E flows.

Acceptance: pnpm lint/typecheck/test and relevant API/E2E checks pass; rebuild engine before web checks; run E2E through `sh scripts/pre-push-e2e.sh <spec> [options]`. Registry completeness covers authored and generated objects; all acquisition routes reviewed. Update plan, CLAUDE and canonical skills. No threshold increases or duplicate frontend rules.

## Migration invariants and completion gate

Legacy GLOOM/IDOL/SPARK tokens map to UNDERWORLD/EARTH/HEAVEN from stored family, never current location. God Executor maps to ALIEN/NOWHERE. Static stackables resolve through their authored key; old map objects use the explicit catalogue/variant migration. Unknown or ambiguous data must produce a diagnostic, not a blanket EARTH assignment. Migration must be idempotent and preserve IDs, attributes, quantities, prices, skill references and source tier.

No phase may defer compatibility for schemas it already changes. D5 verifies the whole chain. Metadata-only migration does not reroll stored tokens or containers. Regeneration/version behavior for unopened legacy containers must be characterized and explicitly tested before changing it.

Feature done: zero unassigned concrete objects; canonical family mapping; all generation uses trusted context; explicit foreign relations; immutable ownership throughout lifecycle; ALIEN migration verified; future quest scope usable; required checks green. New playable realms, new abilities, balance changes, exclusive attribute design and a full QuestsGenerator are outside this plan.
