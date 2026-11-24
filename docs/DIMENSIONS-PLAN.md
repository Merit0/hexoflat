# Gameplay dimensions

## Status and scope

D0 [DONE — 2026-11-21]: repository audit and implementation specification recorded.
D0–D6 are complete. The planned dimension implementation, compatibility audit and integration verification are finished.
Work branch: `implement-game-dimensions`. The user explicitly authorized continuing subsequent phases in this chat. Do not commit without authorization.

## Decisions

User requirements:

- Every concrete gameplay object belongs to exactly one dimension.
- HEAVEN → SPARK; EARTH → IDOL; UNDERWORLD → GLOOM; NOWHERE → ALIEN.
- ALIEN replaces God Executor, including existing saved tokens. User spelling correction: ALIEN (serialized `alien`).
- Silesia and camping belong to EARTH.
- Dimensions govern generation scope and explicit object relationships.
- User clarification (2026-11-22): private base definitions cannot drop in another dimension. Dimensions may also share an explicitly authored group of items/tokens; coins and scrolls can drop everywhere. This supersedes a blanket ban on all foreign items.
- Keep ownership separate from availability: `dimension` is the single owner; `sharedWith: 'all' | Dimension[]` extends the eligible source dimensions. Sharing never reclassifies the base; a token made from a shared base takes the carrier dimension and its light (D4 of the dimensions audit).
- Unique gameplay properties, attributes and skills are manually authored and copied unchanged. Instance ID, source tier and generation metadata are provenance, not randomized unique properties.

Implementation defaults proposed by this audit (not additional user decisions):

- NOWHERE is an ownership value, not a new playable location. ALIEN initially retains the old unique-only generation restriction and red presentation; no new drop rate is introduced.
- Preserve cave's current UNDERWORLD generation; Silesia North is EARTH.
- Preserve existing mixed loot through explicit sharing: coins, Return Scroll and potions are shared with all dimensions. Private equipment bases require distinct concrete catalogue entries. Placements and skill access still use explicit relations. Do not introduce equipment-use restrictions or alter balance in this feature.
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

The following is the explicit assignment for all 38 current HEXOBJECT_KEYS. Definitions are in `content/{resources,loot,creatures,tools,constructions,equipment}.content.ts`. Assignment is content identity, not a ban on appearing elsewhere.

| Owner      | Current concrete keys                                                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EARTH      | tree, knowledge-book, coins, rock, mountain, axe, hand, pickaxe, sword, shield, camping-entrance, cave-entrance, homeland-gate, health-bottle, energy-bottle, mana-bottle, fireplace, healing-spring, wood-and-leaves, chest, chest-open, stash-chest, trader-stall, training-grounds, quest-board, treasure-map, stone-wall |
| UNDERWORLD | skeletor, emitter, inferno, lone-skeleton, skeleton-pack, archer-watch, bone-court, cave-exit, grave                                                                                                                                                                                                                         |
| HEAVEN     | return-scroll, return-portal                                                                                                                                                                                                                                                                                                 |
| NOWHERE    | No current HEXOBJECT_KEY; last-verdict is a separate unique-token definition                                                                                                                                                                                                                                                 |

This D0 assignment inventory is now implemented and validated by D1–D6. A generic sword key still identifies shared type mechanics; concrete baseKey/token ownership distinguishes the EARTH catalogue object from generated dimension-owned variants without reclassifying existing GLOOM/SPARK tokens.

| Other content                                                       | Assignment / concrete resolution                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| camping, silesia, silesia-north                                     | EARTH                                                                                                                                  |
| cave / Skeletor Kingdom                                             | UNDERWORLD                                                                                                                             |
| crypt battlefield                                                   | UNDERWORLD; other future battlefield variants declare ownership                                                                        |
| seeker field instances                                              | Capture origin location dimension at creation; generic field recipe is reusable                                                        |
| skeleton-warrior, skeleton-archer, skeleton-king battle enemies     | UNDERWORLD                                                                                                                             |
| hero instances                                                      | EARTH initially; acquiring a skill school does not change ownership                                                                    |
| ilva trader                                                         | EARTH                                                                                                                                  |
| woodcutter, stonebreaker, scholar board quests                      | EARTH: Silesia resource gathering, camping Book of Will                                                                                |
| bone-hunter board quest                                             | UNDERWORLD: cave execution; accepted and claimed at the Earth board                                                                    |
| seeker-1, seeker-2, seeker-3 cards                                  | EARTH; runs record field source and reward context separately                                                                          |
| bionic / demonic / angelic skill definitions                        | EARTH / UNDERWORLD / HEAVEN respectively; cross-school learning remains allowed                                                        |
| lantern-eater / last-verdict uniques                                | UNDERWORLD / NOWHERE                                                                                                                   |
| generated equipment (including disabled types)                      | Concrete variant has one dimension; disabled types stay disabled                                                                       |
| battlefield terrain objects, spawned resources, derived open chests | Resolve an authored concrete variant at creation, preserve through transformations; no unowned runtime object                          |
| profiles, loot tables, board recipes                                | Owned board configurations and trusted source bindings for reused loot/profile algorithms; private/shared item eligibility is explicit |
| names, adjectives, sprites, materials, stat algorithms              | Reusable supporting data; eligible references validated by dimensional profile, not treated as world objects                           |

The registry/content validators and tests now cover this inventory, including battle-only definitions and generated item ownership. New concrete entries must declare an owner before validation passes. Counts are an audit aid, never a substitute for exhaustive validation.

## Explicit relationships to preserve

- UNDERWORLD cave loot may contain EARTH coins and health potions; skeleton archer/king tables may contain HEAVEN return-scroll. GLOOM equipment remains generated from the cave's own scope.
- EARTH Ilva stock may contain HEAVEN return-scroll. Buyback/listings preserve the sold item's dimension; they are not fresh stock generation.
- Current UNDERWORLD cave/crypt recipes explicitly reuse EARTH terrain and the cave chest. HEAVEN return portals use their own endpoint relation. Any future foreign enemy/grave placement must be authored for that specific placement; there is no unrestricted allow-all rule.
- EARTH cave-entrance connects to UNDERWORLD cave-exit; reciprocal travel is explicitly allowed. Return portals are HEAVEN objects connecting the source and camp.
- Every quest has one execution dimension and one or more existing execution locations. Bone-hunter belongs to UNDERWORLD/cave; accepting or claiming it at the EARTH board does not change its scope. Earth gathering quests cannot count cave work. HEAVEN has no location or current quest. This user clarification supersedes the original D0 bone-hunter assignment.
- NOWHERE last-verdict may carry EARTH b_strike. Unique authored skills/attributes are checked by authored relations, not rerolled against a new random pool.
- Coins stay EARTH and retain their existing no-rarity-light presentation in every location.

Relations must name the operation (placement, drop, stock, quest target/reward, travel, skill reference). One permission must not implicitly authorize every operation. Ordinary inventory carriage remains permitted across dimensions.

## Target contracts

Engine-owned dimension schema and registry are authoritative. Use one family mapping and one ownership resolver per concrete entity category; avoid independent mutable dimension/family fields that can disagree. If both are serialized, validate their agreement.

Generation receives trusted source dimension, source tier, stable source ID, seed/streams and version. The token takes the trusted source (carrier) dimension, also from a shared base (D4 of the dimensions audit). Attributes/names/sprites/prices follow the target item's dimension; provenance retains the actual source. Clients cannot choose reward scope.

Validate eligible entries before RNG. Invalid guaranteed drops are content errors, not silently omitted rewards. Empty optional pools have an explicit empty result; empty required pools refuse without mutation. Preserve independent RNG streams, including Trophy bonus rolls. Any changed output contract needs an explicit generator-version decision and regression fixtures.

Future QuestsGenerator contract: trusted execution dimension and existing location keys, source tier, eligible objective targets, reward policy, seed and version. Output must pass QuestDefinitionSchema (required dimension + nonempty matching locations); map-object placement must target one of those locations and an own/shared object. New runs capture tokenOrigin before any deferred generation. Generated reward pools use that source; an authored rewardOrigin is an explicit reward-source relation. Only execution-dimension events advance counting objectives. Heaven becomes eligible only after a real Heaven location is authored. No generator class or unused framework is implemented.

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
- Tests cover nested inventory/progress/trader/listing/battle-ground/container readers, world round trips, strict refusals, foreign gear equip/sell/buyback/list/reload, stack boundaries and real PostgreSQL legacy-token loading. Characterization passed before changes (10 tests). Validation: engine build, workspace lint (existing warnings only), typecheck, formatting of changed code and `git diff --check` passed. Full workspace suite passed: 2,406 engine tests (2 existing skipped), 4,223 web tests, 296 API tests including real PostgreSQL migration, and 40 Playwright-framework unit tests. Browser E2E was not run; no interaction flow changed, and existing tooltip/render/locale tests cover the family rename. D2 was subsequently committed as `60706c5f` before D3 began.

| Token identity metric       | Before D2              | After D2                              |
| --------------------------- | ---------------------- | ------------------------------------- |
| Stored concrete token owner | family only            | explicit validated dimension          |
| Exceptional family          | God Executor           | ALIEN / NOWHERE                       |
| New token output version    | 4                      | 5                                     |
| Legacy token values         | retained               | retained, metadata normalized         |
| Container reader            | validates nested token | validates and normalizes nested token |

### D3 — Generators and acquisition [DONE — 2026-11-22]

Wire loot, token type/attribute/name/sprite/price/skill generation, unique drops, camp claim, chest eager/lazy rolls, seeker rewards, graves/Trophy, harvesting, trader refresh, inventory stock supply and developer fixtures. Remove production missing-context fallbacks.

Acceptance: private and explicitly shared cases tested for every acquisition path; guaranteed entries and overrides obey policy; RNG deterministic; impossible mandatory pools fail atomically; existing prices/caps/roll distributions unchanged except intentional eligibility changes documented with versioning.

D3 implementation:

- `content/base-items.content.ts` authors twelve distinct concrete bases: sword/shield/axe/pickaxe for each of EARTH, UNDERWORLD and HEAVEN. They reference common mechanical archetypes; `ItemTypeDefinition.realms` is a compatibility constraint on mechanics, not the concrete item catalogue. No disabled type is enabled.
- `BaseItemRegistry` snapshots and validates owners, references, duplicates, enabled types and optional attribute allowlists. Base selection considers only own/shared definitions. Explicit `baseKey` requests cannot bypass eligibility; a shared EARTH base minted in HEAVEN makes a HEAVEN/SPARK token (D4 of the dimensions audit).
- Generated tokens persist `baseKey`; known base references must agree with the type; the owner may differ for a shared base (D4 of the dimensions audit). Old base tokens derive their historical concrete key from stored family/type at read time without changing IDs, rolled values or stored generatorVersion. New output version is 6. The twenty golden rolls differ only in baseKey and output version.
- Selected base attribute allowlists filter the pool before count/pick RNG and also constrain explicit overrides/injected output. Existing caps, type/tool gates and tier ranges still apply. Names, sprites, prices and base skills follow the token (carrier) dimension, not the base owner (D4 of the dimensions audit); default shared algorithms and existing sprite fallback behavior are preserved.
- `sharedWith` is authored on concrete bases, unique definitions and ordinary catalogue objects. Default availability is owner only. Coins/scroll/potions explicitly allow all sources.
- Loot validates guaranteed entries and filters weighted candidates before RNG, including named `baseKey` entries. Empty required pools and invalid guarantees report content errors without partial results. Containers, eager/lazy chest generation, quest chests and grave/Trophy streams use captured source origin. Existing loot weights/amounts are unchanged.
- Trader refresh derives its source from authored token origin or stall ownership; quest rewards use the quest location dimension (`rewardDropContext` sets only the tier). Fresh generation uses eligible definitions; carried goods/buyback/listings retain their original token identity. Camp claim and developer specifications use the same factory; dev specs can name baseKey and receive a refusal for a foreign private base.
- Raw legacy pickup materializes the existing catalogue object with its own family, rather than recoloring it to the current map. Already tokenized pickups retain the complete token. New chest/grave generation requires explicit origin. Inventory stock and raw pickup cannot silently mint with missing origin. Fieldless historical quest runs retain their explicitly documented camp-origin compatibility reader. Dev-only default grants are explicitly EARTH, not a production location fallback. The unscoped low-level roll helper remains useful for pure table simulations; authoritative container/world paths always pass source dimension.
- Unique catalogues can be queried by dimension; scoped unique-drop selection and unique minting honor own/shared eligibility and preserve manually authored properties. No production unique-drop rules currently consume `resolveUniqueDrop`; this phase does not invent a new chance table or unique-spawning mechanic.
- Characterization before changes: 39 existing factory/unique/acquisition tests passed. Golden loot fixtures retain their expected placements and counts; old simulation fixtures now supply their actual cave/camp provenance. Validation complete: engine build, workspace lint (existing warnings only), typecheck, formatting of changed TypeScript and `git diff --check HEAD` passed. `pnpm test --concurrency=3 --continue -- --maxWorkers=1` passed: 2,426 engine tests (2 existing skipped), 4,223 web tests, 296 API tests with real PostgreSQL, and 40 Playwright-framework unit tests — 6,985 passed total. The final client collection fixture supplies cave origin, and the loot-secrecy predictor uses the correct public cave dimension while remaining unable to reproduce server-secret rolls. Browser E2E was not run; this phase changes engine generation contracts and test fixtures without adding a UI interaction. No commit was created for D3; existing staging was preserved, with final fixes/document status left in the working tree.

| Generation metric                      | Before D3                | After D3                                      |
| -------------------------------------- | ------------------------ | --------------------------------------------- |
| Concrete base catalogue                | shared type + family     | 12 authored base definitions with stable keys |
| Private EARTH base requested in HEAVEN | no concrete key boundary | explicit refusal                              |
| Shared tokens                          | implicit mixed tables    | authored all/selected-dimension availability  |
| Unique properties                      | authored                 | authored, scope-filtered                      |
| New token output version               | 5                        | 6                                             |
| Legacy owned tokens                    | retained                 | retained, concrete identity normalized        |

### D4 — World and quest relations [DONE — 2026-11-22]

Validate drawings/recipes, spawns, battle terrain/creatures, gates/portals, skills and existing quest references. Capture immutable source context for quest runs, battles and deferred actions.

Acceptance: placement errors identify owner/key/operation; legal foreign placements work; quest rewards and deferred loot retain context after travel/reload; future quest generation contract documented without implementing it.

Implementation (2026-11-22):

- Drawings and recipes require dimension. Location registry ownership derives from the recipe and is checked against the execution-location catalogue. The cave explicitly permits existing EARTH chest/rock/stone-wall placements; crypt recipes permit rock/stone-wall. These placement permissions never grant drop eligibility. Resolved pipeline output, static legends/editor saves and authoritative resource spawners/respawns enforce ownership/sharing with errors naming recipe, operation, key and dimensions. Board serializers preserve the new metadata.
- Concrete battle actors, hand items and terrain have dimensions. Enemy deployment validates creature, hand and battlefield relations; traveling heroes and their existing inventory remain portable. Skills declare their school ownership and parse through the skill schema; cross-school learning remains allowed.
- Physical gates enumerate their exact existing endpoints. Unauthored gates refuse before Will cost or world mutation. Border travel remains within one dimension. The Heaven return portal explicitly connects Silesia/north/cave to the Earth camp without introducing a Heaven location.
- All quests require existing locations of one dimension; the execution dimension is derived from them and not stored. Bone-hunter executes in UNDERWORLD/cave; woodcutter/stonebreaker execute in EARTH Silesia sectors, scholar in EARTH camping, seekers in EARTH Silesia. Entrance placement/entry enforce those relations. RESOURCE_GATHERED, HALL_ANSWERED and BATTLE_CLOSED carry trusted execution dimensions; missing/foreign dimensions cannot advance counting objectives. Base rewards take the quest location dimension, so the dungeon shield remains GLOOM at the camp board.
- New worlds, expedition runs/copied fields, pending tile actions and squad battles capture tokenOrigin. Reloads, descriptor changes, travel and later caller contexts do not replace it. Existing metadata-free saves retain the established source fallback; hydrated worlds snapshot it on their next write. Historical quest fields retain their stored origin/tier fallback. No rerolls or version/schema reset. New fieldless test/standalone expedition creation also captures the authored quest source.
- Characterization passed before implementation. New regressions cover missing/foreign quest scopes, absence of Heaven quest locations, dungeon rewards at camp, illegal placement/gates, legal existing foreign objects and source stability through reloads. Existing grave expectations/snapshots were refreshed to the current drop table; no loot weights or content were added.

D4 verification: `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test --concurrency=3 --continue -- --maxWorkers=1` passed. 7,004 tests passed: 2,445 engine, 4,223 web, 296 API with real PostgreSQL and 40 Playwright framework tests; two existing battle-balance tests remain skipped. Browser E2E was not part of this phase. Existing lint/build warnings remain; no limits were raised and no new import cycles were added.

| Boundary                | Before D4                                | After D4                                                   |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Current quests          | no execution dimension/location contract | seven scoped quests; no Heaven execution location          |
| Counting progress       | event shape alone                        | matching trusted execution dimension required              |
| Dungeon board reward    | camp source by default                   | captured/authored quest source; GLOOM shield at camp       |
| Placement and travel    | structural validation                    | own/shared or explicit operation/endpoint relation         |
| Deferred source context | partial location/tier derivation         | snapshots on new worlds, runs, pending actions and battles |

### D5 — Compatibility and presentation [DONE — 2026-11-22]

Audit aggregate upcasters, worlds, unopened containers, battle snapshots, quests, stock/buyback/listings, journal/replay and client projections. Update both locales, hover/tooltips, rarity/light helpers and sprite tooling. Update relevant canonical web/render skills when those areas change.

Acceptance: old saves load without rerolls/loss/reassignment; God Executor legacy strings remain only in explicit migration readers/tests or clearly historical docs. Owned legacy attributes remain effective. Labels show ALIEN and dimension consistently; no hidden seed/loot disclosure. No blanket content-version bump without examining each persistence contract.

D5 implementation (2026-11-22):

- Existing token readers already normalize stored families/owners/base keys across inventory, traders, listings, containers, world objects and battle/quest drops. Characterization and round-trip tests verify identity, version, attributes, prices, quantities and tiers survive. Unrolled legacy chest contents stay null during hydration; no regeneration or loot-table change is introduced.
- Quest parsing now snapshots a missing source from the stored field dimension/tier (or the explicit historical camp origin). World hydration fills only a missing battle source from the saved world source. Existing explicit sources remain authoritative. No CONTENT_VERSION, aggregate schema version or token generator version change is needed.
- Quest projections now carry the visible ground item's complete normalized token, fixing loss of its dimension/name/sprite/rarity on the client. Quest and battle projections expose public dimension metadata while keeping seed, token secret and unopened container contents private. BattleProjection's type now agrees with the runtime removal of tokenOrigin.
- Inventory/map/battle hover cards, battle panel and quest details/run panels share an English/Ukrainian DimensionLabel. Ownership comes from the token first, otherwise the authored catalogue; no current-location recoloring. ALIEN is shown as the Nowhere-owned unique family. Coins retain Earth ownership and no rarity light.
- Quest and battle loot render the existing stored token sprite/light through itemLook. Quest render signatures include concrete token identity/appearance so replacing a same-key token refreshes the display. Lights are preloaded; dynamic textures retain ready-listener cleanup, hidden loot remains hidden and coins have no frame.
- Sprite tooling already uses canonical family names and rejects ALIEN base sprites; the audit found no legacy names outside the compatibility reader/tests. No sprites, content entities or entity-specific cleanup helpers were added.

| Audited boundary                              | Compatibility outcome                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory v1–v3 and progress v1–v11 upcasters | Existing historical upcasters retained; current schema readers normalize metadata without rerolls                                                     |
| Stock, buyback and listings                   | Stored tokens, prices, serials and quantities preserved; repeated parsing is idempotent                                                               |
| Worlds and unopened containers                | Existing catalogue/token hydration retained; null contents stay unrolled; hidden contents excluded from projection                                    |
| Battle snapshots and quest documents          | Missing source captured from known saved context; existing source and rolled loot preserved                                                           |
| Generic checksummed snapshots                 | Raw checksum verified before token normalization; legacy attributes and ids survive load/save                                                         |
| Journal/replay and item ledger                | Historical events retained; replay returns current normalized aggregate projections without another move or ledger write (real PostgreSQL regression) |
| Client projections and hover/render helpers   | Visible token identity retained; public dimension shown; private generation data stays server-side                                                    |
| Locales and sprite tooling                    | English/Ukrainian labels wired to shared presentation; canonical families and unique-only ALIEN remain enforced                                       |

D5 verification: `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test --concurrency=3 --continue -- --maxWorkers=1` passed. 7,038 tests passed: 2,450 engine, 4,251 web, 297 API with real PostgreSQL and 40 Playwright framework tests; two existing battle-balance tests remain skipped. Focused regressions cover source recovery/idempotence, legacy checksummed snapshots and attributes, journal replay without duplicate ledger writes, localized labels, token-owned hover details and loot sprite/light updates with cleanup. Browser E2E remains D6. Existing lint/build warnings remain; no thresholds were raised or new import cycles introduced.

### D6 — Integration and closeout [DONE — 2026-11-22]

Verify acquire → inventory → equip/trade → travel → reload across dimensions, including ALIEN and invalid client scope. Cover real API persistence and selector-free Feature/Page/Component E2E flows.

Acceptance: pnpm lint/typecheck/test and relevant API/E2E checks pass; rebuild engine before web checks; run E2E through `sh scripts/pre-push-e2e.sh <spec> [options]`. Registry completeness covers authored and generated objects; all acquisition routes reviewed. Update plan, CLAUDE and canonical skills. No threshold increases or duplicate frontend rules.

D6 implementation and final audit (2026-11-22):

- Added selector-free `hero/dimensions.spec.ts` with DimensionItemsFeature → CampingMapPage → DimensionItemsComponent. Five scenarios verify GLOOM/SPARK equipment through real Earth/Underworld gates and reload, ALIEN/Nowhere unique equipment through the same travel, and GLOOM/ALIEN sale, persisted buyback and repurchase. Each check compares the entire stored token, including id, ownership, base/unique identity, attributes, skills, price, sprite, tier and generator version, plus the visible dimension labels.
- Guarded E2E hooks read an owned token and arrange an existing authored unique with the normal factory, then save through the existing DEV_SET_INVENTORY fixture pipeline. The fixture seed is separate from the encoded public source id. No production acquisition mechanic, entity or dimension location was introduced. Heaven's equipment is exercised as carried gear because Heaven has no location yet.
- Added six real-PostgreSQL boundary regressions: forged dimension/origin/tokenOrigin/client metadata is refused before world state changes; private EARTH bases requested from SPARK/GLOOM are refused without an inventory change. Existing replay, save/load and source-pool tests remain in the full suite.
- Browser acquisition coverage includes real chest OPEN/TAKE/reload, quest sword pickup and token look after reload, and Return Scroll portal checks (including the one-way Underworld route and skill refusal). Tests use the dedicated pre-push stack, one Chromium worker and zero retries; the existing slow quest acquisition case is explicitly included.
- Registry completeness is enforced by the existing exhaustive content/board/base/unique/skill/quest/battle validators and their tests. The audit covers 39 hexobjects, twelve enabled concrete equipment bases, the two authored uniques, all existing locations/quests/skills and native battle definitions. Supporting mechanics/profile tables remain shared algorithms with explicit source bindings; disabled equipment categories stay disabled.

| Acquisition / lifecycle route           | Trusted scope and final coverage                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| World chest, grave and Trophy loot      | Captured world/battle source → scoped table/pool → token factory; source/loot/API tests and browser chest pickup/reload                                |
| Quest chest and quest board rewards     | Saved run source or authored execution/reward source; quest source/reward tests and real browser quest acquisition                                     |
| First camp chest                        | Explicit camp origin through the ordinary factory; existing camp-claim/API tests                                                                       |
| Trader fresh stock                      | Authored trader source or stall owner, with own/shared pools; existing stock generation and API tests                                                  |
| Trader buyback and listings             | Existing token retained instead of reminting; API persistence/replay tests and GLOOM/ALIEN browser buyback                                             |
| Raw placed pickup / stock grants        | Stored token retained; catalogue-owned legacy materialization or explicitly supplied source required; pickup/source tests                              |
| Legacy tokenless inventory              | Established historical upcaster only; current owned tokens never reroll; snapshot/aggregate/API compatibility tests                                    |
| Developer fixtures                      | Explicit scoped base specs refuse foreign keys; unique fixture uses authored content, guarded fixture pipeline and independent seed/source identifiers |
| Inventory, equipment, travel and reload | Full token equality after real equip/gates/reload; own/shared availability never recolors a carried item                                               |

D6 verification (2026-11-22):

- `E2E_INCLUDE_SLOW=1 sh scripts/pre-push-e2e.sh e2e/hero/dimensions.spec.ts e2e/slow/hero/token-look.spec.ts e2e/camp/return-portal.spec.ts e2e/hero/loot-chest.spec.ts --workers=1 --retries=0`: **15 Chromium scenarios passed**, including all five new dimension cases. Dedicated servers ran the current code; database schema check reported no changes.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm e2e:map:check` and `pnpm test --concurrency=3 --continue -- --maxWorkers=1` passed. **7,044 workspace tests passed**: 2,450 engine, 4,251 web, 303 API with real PostgreSQL and 40 Playwright framework tests. Two existing battle-balance tests remain skipped. Existing lint/build and unmapped-file informational warnings remain; no thresholds were raised or new import cycles added.
- Production build inspection found none of the new E2E-only unique fixture/read hook identifiers in its JavaScript bundles. No content/aggregate/generator version changes, database reset, new playable dimension locations or unique-spawn mechanics were needed.

All planned implementation acceptance criteria are met. Heaven locations, new dimension content, deferred equipment categories and a full QuestsGenerator remain intentionally outside this completed plan.

## Migration invariants and completion gate

Legacy GLOOM/IDOL/SPARK tokens map to UNDERWORLD/EARTH/HEAVEN from stored family, never current location. God Executor maps to ALIEN/NOWHERE. Static stackables resolve through their authored key; old map objects use the explicit catalogue/variant migration. Unknown or ambiguous data must produce a diagnostic, not a blanket EARTH assignment. Migration must be idempotent and preserve IDs, attributes, quantities, prices, skill references and source tier.

No phase may defer compatibility for schemas it already changes. D5 verifies the whole chain. Metadata-only migration does not reroll stored tokens or containers. Regeneration/version behavior for unopened legacy containers must be characterized and explicitly tested before changing it.

Feature done: zero unassigned concrete objects; canonical family mapping; all generation uses trusted context; explicit foreign relations; immutable ownership throughout lifecycle; ALIEN migration verified; future quest scope usable; required checks green. New playable realms, new abilities, balance changes, exclusive attribute design and a full QuestsGenerator are outside this plan.

Content correction (2026-11-22): removed the unapproved charm item entirely from the registry, loot, shop, asset and documentation. The registry contained 39 objects after that correction. No compatibility helpers remain. The local development database was cleaned once (714 documents and 78 item-ledger rows; zero remaining references), and its schema was verified current.
Removal validation: engine build, workspace lint/typecheck, 399 affected engine tests and 33 affected web tests passed. The earlier full D3 suite remains recorded above as historical validation before this content correction. No entity-specific compatibility code remains in the working tree or staging area.

### Content correction — 2026-11-22

The registry now contains 38 objects. Removed the unapproved crown trophy from the registry, loot catalogue, boss guarantees and fixture expectations. The boss keeps guaranteed coins and its existing optional loot pool. Local owned copies were removed once with an external backup; no per-item compatibility reader or cleanup method was added.

Validation: six battle-collection Chromium scenarios passed with two workers and no retries, including the former boss-drop failure. Engine build, workspace typecheck and lint passed. Workspace tests passed 4,251 web and 40 framework checks; the changed boss RNG exposed a container test that compared tokenized contents to raw drops, now corrected and passing (5 tests), with 12 trader checks also passing. A separate API cave-exit fixture failed to find a second free adjacent hex in the full run; its isolated file passed all 51 checks. No unrelated API fixture changes were made. Economy simulation remains within its target (195.3 mean sell value/run, 2.56 runs to the sword); fewer guaranteed drops reduce cramped-space losses to 10.3%.
