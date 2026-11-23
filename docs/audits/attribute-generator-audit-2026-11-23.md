# Attribute generator audit — 2026-11-23

Branch `attribute-generator-improvments` (after quest generator phase 5). Independent audit: the earlier
[equipment-attributes-audit.md](../architecture/equipment-attributes-audit.md) and
[loot-generator-audit-2026-11-18.md](../architecture/loot-generator-audit-2026-11-18.md) were read for context only.
Oleh's game-design decisions (ranges, caps, the uncapped Will, price by realm range) are treated as intended
behaviour; where they cause a measurable problem it is listed as a **decision for Oleh**, not as a bug.

## 1. Scope and method

| Layer               | Files                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generator core      | `packages/engine/src/tokens/equipment/generator/*` (contracts, pool filter, count/value rollers, weighted picker, streams, level, profile provider)                                                                                         |
| Schemas             | `tokens/equipment/{attribute-profile,equipment-attribute,equipment-type,adjective}-schema.ts`, `equipment-keys.ts`, `tokens/token-schema.ts`, `tokens/base-item.ts`                                                                         |
| Factory integration | `tokens/factory/{token-factory,create-token-factory,token-validator,validate-factory-content,price-generator,name-generator,base-item-picker,type-picker}.ts`, `tokens/attribute-rules.ts`, `tokens/registries.ts`, `base-item-registry.ts` |
| Content             | `content/{attribute-profiles,equipment-attributes,item-types,base-items,token-uniques}.content.ts`, `content/validate-equipment.ts`                                                                                                         |
| Readers             | `tokens/equipment/{hero-stats,item-stats,stat-values,harvest-bonus}.ts`, `battle/{strike-pipeline,trophy-bonus,shield-stats}.ts`, `tokens/attribute-display.ts`                                                                             |

Method: full reading, then the existing suites (`vitest run src/tokens src/content/... src/battle`: 76 files, 717 passed,
2 skipped — the known `balance.test.ts` skips), then two scratch probes run with `tsx` against the real factory and content:

- `distribution.ts` — 20 000 tokens per type × tier (sword, shield, axe, pickaxe; tiers 1–4; three realms);
- `validation.ts` — eight hand-made content faults pushed through `equipmentContentFailures`, `createTokenFactory` and `resolveHeroStats`.

The probes are not committed; their results are quoted below.

## 2. Verdict

The core is **well built**: small single-purpose parts behind interfaces (`IAttributeProfileProvider`, `IAttributePoolFilter`,
`ICountRoller`, `IWeightedPicker`, `IValueRoller`), a composition root with overridable parts, one named RNG stream per step
(value streams keyed by attribute key, so adding an attribute does not move other values), frozen profile snapshots,
a strict final validator that every injected factory step still passes through, and Zod schemas for every piece of content.
Measured count distributions match `countWeights` within 0.6 points for every type and tier, and there were no refusals in 320 000 mints.

The weaknesses are not in the dice but **around them**:

1. Content rules are expressed per **group**, while effects exist per **type**. That gap already produces a lot of attributes
   that have no effect (§3, F1–F2).
2. Content validation is split across two validators and misses several rules the readers depend on. A content mistake
   either has no visible effect or crashes at runtime (§3, F3–F6).
3. Some magic constants and duplicated data contradict the claim that a new attribute needs only data (§3, F7–F10).

No security or determinism defect was found.

## 3. Findings

Severity: **P1**: affects players now. **P2**: hidden defect, triggered by the next content change. **P3**: code quality or extensibility.

### F1 — P1. Axes and pickaxes roll combat attributes that can never work

`crit`, `crit-dmg` and `trophy` are `groups: ['weapon']`. Axe and pickaxe are group `weapon`, so they enter the pool
(`pool-filter.ts` `generatable`). A hero never fights with them: `BATTLE_ITEM_BY_HEXOBJECT` (`battle/battle-catalogue.ts:167`)
knows only sword, shield and potion, and `squads/inventory-loadout.ts` turns any other hand item into an empty hand.
So `strike-pipeline.ts` (crit chance and multiplier) and `battle/trophy-bonus.ts` never read a tool. The tooltip still
shows the line (`attribute-display.ts` `attributeRowsOf`), and the line moves the token into a higher name band and price third.

Measured share of tools carrying at least one such dead attribute:

| tier | axe   | pickaxe |
| ---- | ----- | ------- |
| 1    | 24.8% | 24.5%   |
| 2    | 39.4% | 39.3%   |
| 3    | 51.1% | 51.4%   |
| 4    | 64.8% | 64.4%   |

The prior plan only checks that `yield` is tool-only (EA-3). The reverse rule ("combat-only attributes stay off tools") was never stated.

**Fix.** Pick one of these options; the first is content-only:
(a) `onlyTypes: ['sword']` on `crit`, `crit-dmg`, `trophy`;
(b) a symmetric `requires: { tool: false }` / `excludes: { tool: true }` in the attribute schema, enforced by the pool filter and `typeFailure`;
(c) derive "battle-usable" from the battle catalogue and add `requires: { battle: true }`.
(b) is the most extendable, because new swords such as maces then need no edits. Then add a conformance test (see F11) that every implemented attribute has a reader for every type it can roll on.
Owned tokens keep their lines (no reroll).

### F2 — P1 (decision for Oleh). `crit-dmg` without `crit` is dead in 71–86% of cases

It is already recorded as a "balance issue", but the size of it was not measured. Among tokens that carry `crit-dmg`:

| type    | t2    | t3    | t4    |
| ------- | ----- | ----- | ----- |
| sword   | 81.3% | 74.9% | 71.0% |
| axe     | 85.7% | 82.6% | 79.4% |
| pickaxe | 86.2% | 81.6% | 78.8% |

On tier 4 about 16% of all swords show a multiplier that does nothing. Worse, the test
`equipment-attribute-generator.test.ts:97` ("crit-dmg appears without crit on the same item") **locks the weakness in** as
required behaviour. The generator has no notion of an attribute dependency, so this cannot be fixed in content today.

**Fix options (Oleh chooses):**
(a) schema `requires: { attributes: ['crit'] }` and a generator that recomputes eligibility after each pick
(`pick()` loop: filter `remaining` by `requires.attributes ⊆ picked`), plus validator `typeFailure` checking the same on overrides;
(b) when `crit-dmg` is picked, force-pick `crit` as a pair (counts as 2);
(c) give `crit-dmg` a standalone effect.
(a) keeps the count distribution honest and is reusable for future pairs (`counter` → `defense-plus`, …). Replace the test at :97 with the chosen rule.

### F3 — P2. Mixed aggregates on one stat pass validation and crash every stat read

`resolveStat` (`stat-values.ts:17`) throws when two definitions of one `stat` disagree on `aggregate`. No validator checks it.
Probe: flip `focus` (deprecated, same stat as `wisdom`) to `aggregate: 'max'` → `equipmentContentFailures` returns `[]`,
and `resolveHeroStats` throws for **any** equipment, including a plain sword. `resolveHeroStats` runs inside
`executePlayerCommand` and battle, so one content typo would break every hero command at runtime.

**Fix.** Add a content rule in `validate-equipment.ts`: per stat, one aggregate. Also add one cap semantic (F5) and one scope (F8).

### F4 — P2. Base-item attribute allowlists are not checked against the type

`BaseItemRegistry` (`base-item-registry.ts:24`) checks only that each allowlisted key exists. It does not check group,
`onlyTypes`, tool, implemented or profile presence. Probe: `earth-sword` with `attributes: ['fog']` builds a factory without
error, and all 2 000 tier-4 swords come out with **0 attributes**, so the band and price are silently low. No base item uses an
allowlist yet, so this is a trap for the first content author who does.

**Fix.** In the registry or in `validateFactoryContent`, run `typeFailure` + group + `implemented` for each allowlisted key against
the base item's type. Require that at least one key is generatable at some tier.

### F5 — P2. `cap` has two meanings, and both break for `min` stats

`cap` is used as (1) a per-item ceiling (`profileEntryFailures`, `validateProfiles`, `uniqueFailure`) and (2) the total equipment
ceiling (`resolveStat`). For `aggregate: 'min'` (`smart-step`, lower is better) an upper cap is meaningless as a total limit, and as a
per-item check it is inverted. Probe: `smart-step` `cap: 3` is reported as "max 5 is above its cap 3" for every tier, while at
runtime `Math.min(3, min(values))` would turn every-5th-step boots into every-3rd-step boots, a buff.
Uniques are checked only against `cap`, so `will` (no cap) or `smart-step` on a unique is unbounded.

**Fix.** Split the field into `itemMax` (per item, checked by profiles and uniques) and `totalCap` (applied by `resolveStat`).
For a `min` aggregate, write the cap as a floor (`totalFloor`) or forbid it in the schema with a refinement.

### F6 — P2. Silent no-ops that validation should report

From the probes, all of these pass with `[]`:

- an `implemented` attribute with no profile row in any tier (P4: `force` set implemented). It will never roll, and nobody is told;
- a profile weight for a group where no enabled or planned type can carry the attribute because of `onlyTypes` (P6);
- shield `block.sides` ≠ `base.blockSides` (P5). The two fields mean the same thing (see F9). Only a shield-specific unit test
  (`equipment-content.test.ts:309`) guards it, and content validation does not.

**Fix.** Add these three checks to `validate-equipment.ts`. Report the first as a warning if Oleh wants "implemented but not yet rolled".

### F7 — P2. The validator hardcodes the Block attribute key and limit

`token-validator.ts:14-15`: `MAX_BLOCK_SIDES = 6`, `BLOCK_ATTRIBUTE_KEY = 'shield'`. Probe P7: raising `shield.cap` to 8 in content
still refuses a 7-side shield with "A shield cannot exceed six block sides". This is the only attribute-specific code in a
generic validator, and it duplicates `shield.cap: 6`. A second sides attribute (e.g. a unique-only one) would bypass it.

**Fix.** Make it a generic rule: for every hero-scoped stat with a total cap, `type base + Σ token values of that stat ≤ totalCap`.
Read it from the registry, not from a constant.

### F8 — P2. One stat name, two scopes (`critPoints`)

`crit` (item scope, cap 10) and the planned `hero-crit` (hero scope, cap 25) both map to `critPoints`. `resolveItemStats` and
`resolveHeroStats` each see only their scope, and `strike-pipeline.ts:136` reads only the item value. When `hero-crit` is enabled
there is no defined way to combine them, and each scope applies a different cap. Related: `resolveItemStats` returns the type
`HeroStats`, a misleading name for item bonuses.

**Fix.** Make one stat belong to one scope (validated), e.g. `weaponCritPct` and `heroCritPct`, and write the combination in the
strike pipeline. Rename the return type to `EquipmentStats` (alias `HeroStats` kept for compatibility).

### F9 — P3. Duplicate and unread content fields

- `base.damage` (sword 2, axe/pickaxe 1) and `base.defense` (shield 2) have **no reader** anywhere in the engine or web.
  Damage comes from `strike` (half-hearts). There are two fields for one concept.
- Block sides live in both `block.sides` and `base.blockSides`, and the readers use `block?.sides ?? base?.blockSides` in three places
  (`hero-stats.ts:29,34`, `battle/shield-stats.ts:18`).

**Fix.** Keep one source per concept. Either `base.damage` replaces `strike`, or delete `base.damage`/`base.defense`. Make
`base.blockSides` the only sides field and drop `block.sides`, or the reverse. Do it together with the F7 generic total-cap rule.

### F10 — P3. Hidden couplings

- Band and price use the attribute **count** clamped to 3 bands (`PRICE_BANDS = 3`, `ADJECTIVE_BANDS.length = 3`), while
  `ATTRIBUTE_MAX_COUNT = 2`. If `maxCount` rises to 3, tokens with 2 and 3 attributes become indistinguishable in name and price,
  and no check would catch it. Add a validation that `maxCount + 1 ≤ bands`, or derive the band from a normalized count.
- The default crit multiplier ×2 is a literal in `strike-pipeline.ts:57` (`Math.max(2, …)`), outside content.
- The four tiers are hardcoded in five places: `mapTierSchema`, `attributeProfilesSchema` (strict `tier-1…4`),
  `ATTRIBUTE_PROFILE_TIERS`, the `ROWS` tuple type and `COUNT_WEIGHTS`. A fifth tier touches all of them. Derive the schema keys from
  `MAP_TIERS`, and type `ROWS.tiers` as `Record<TMapTier, Range>`.
- `ROWS` in `attribute-profiles.content.ts:16` is `Record<string, …>`: a typo in a key is only found at runtime validation.
  Type it as `Record<AttributeKeyOf<typeof EQUIPMENT_ATTRIBUTES>, …>` (or `satisfies`).

### F11 — P3. Per-attribute copy-paste tests instead of one conformance suite

Every new attribute adds another near-identical file (`block-`, `crit-`, `heal-on-block-`, `heart-`, `trophy-`, `wisdom-`,
`yield-generation.test.ts`): "rolls only on X", "tier ceilings", "refuses overrides on Y", "deprecated not generated".
This contradicts "a new attribute needs only data". A table-driven conformance test over `EQUIPMENT_ATTRIBUTES ×
EQUIPMENT_TYPES × tiers` would cover all of them from content: eligibility = pool filter = validator, values within the profile,
deprecated excluded, every implemented key has a reader for every eligible type (catches F1), and every dependency is honoured (F2).
Keep only attribute-specific behaviour tests (effects) in separate files.

### F12 — P3. Duplicated logic and dead paths

- Two content validators with overlapping profile rules: `validate-equipment.ts:117` (`profileEntryFailures`, list of strings) and
  `validate-factory-content.ts:12` (`validateProfiles`, throws). Also two adjective filters: `adjectivesFor` (`validate-equipment.ts:148`) and
  `adjectivesForType` (`name-generator.ts:12`). Merge them into one rule module that both call.
- `createBase` validates attributes and the base allowlist twice: once at `token-factory.ts:137/145`, then again inside `validator.validate`.
  This is harmless, but the first pair can go because the final validation covers it.
- `resolveGenerationLevel(null, ctx.mapTier)` (`token-factory.ts:131`): the container level is never passed. The function and its
  test ("container level wins") describe a path production does not have. Either wire `containerLevel` or remove the parameter.
- `RealmTypePicker.pick` random branch is unreachable from `createBase` (the base item always fixes the type), yet it shares
  `stream('type')` with `pickBaseItem`. Remove it or document it as an injection seam only.
- The generator builds its own parsed index (`RegistryAttributePoolFilter`) from raw content while the validator uses
  `AttributeRegistry`: two copies of the same registry. Pass the registry in.
- `EquipmentAttributeGenerator.generate` builds a new Zod schema on every call (`generatedAttributesSchema(maxCount)`). Build it once per profile.

### F13 — P3 (decision for Oleh). Price and name ignore tier and value

`RangePriceGenerator.generate(realm, attributeCount, rng)` (`price-generator.ts:28`) does not see the tier or the rolled values. A tier-1
sword with `crit 2 + will 1` and a tier-4 sword with `crit 10 + will 40` fall in the same price third. A dead attribute (F1/F2) raises
the price too. This follows D4/EA3 as decided. A possible alternative: a per-attribute "power" weight in content
(`value / profileMax`) that selects the band, so price and adjective follow real strength.

### F14 — P3 (risk note). Uncapped Will grows with the slot count

`will` rolls on all six groups up to +40 (tier 4), with no total cap (Oleh, 2026-11-19). Today only hands roll it. When clothing and jewelry
are enabled (8 slots plus jewelry bases), the theoretical total is about +320 over a base of 50, while one cave trip costs up to 38.
Re-check this before enabling clothing.

## 4. Challenges to the earlier audits

| Earlier claim                                                    | Finding                                                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| "A new attribute of an existing stat needs only data" (EA-16)    | True only for the happy path. Mixed aggregate crashes (F3), cap semantics (F5), hardcoded Block rule (F7), and a new test file per attribute (F11) |
| "Attributes appear only on types of their groups" = correct pool | Group is the wrong granularity: tools get combat-only attributes (F1)                                                                              |
| `crit-dmg` independent of `crit` — "recorded balance issue"      | Measured at 71–86% dead, and a test enforces it (F2)                                                                                               |
| "Factory rejects unknown/wrong-group/over-cap profile entries"   | True, but base allowlists, implemented-without-profile and unreachable weights are not checked (F4, F6)                                            |

## 5. Improvement plan

One phase per chat, ask before every commit. Owned tokens are never rerolled, and no `CONTENT_VERSION` bump is needed unless noted.

| Phase   | Content                                                                                                                                                                                                                                                                                  | Findings                   | Size | Needs Oleh                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---- | ------------------------- |
| **AG1** | Validation hardening in one rule module: one aggregate per stat, one scope per stat, base allowlist vs type, implemented-without-profile, unreachable weights, `block.sides` = `base.blockSides`, `maxCount + 1 ≤ bands`; merge the two profile validators and the two adjective filters | F3 F4 F6 F8(check) F10 F12 | S–M  | no                        |
| **AG2** | Conformance test suite driven by content (eligibility = pool = validator, ranges, deprecated, reader exists per eligible type), replacing the per-attribute generator audit files                                                                                                        | F11 (+ guards F1/F2)       | M    | no                        |
| **AG3** | Tool vs combat eligibility: schema `excludes.tool` (or option a/c), pool filter + `typeFailure`, content flags on `crit`/`crit-dmg`/`trophy`; tooltip unchanged for owned tokens                                                                                                         | F1                         | S    | choose option             |
| **AG4** | Attribute dependencies: `requires.attributes`, dynamic eligibility in the pick loop, validator check, replace test `:97`                                                                                                                                                                 | F2                         | M    | yes (rule)                |
| **AG5** | Cap model: `itemMax` / `totalCap` (floor for `min`), generic total-cap rule in the validator replacing `MAX_BLOCK_SIDES`; content default crit multiplier                                                                                                                                | F5 F7 F10(×2)              | M    | confirm field names       |
| **AG6** | Content cleanup: single damage and sides fields, typed `ROWS` keys, tiers derived from `MAP_TIERS`, registry injected into the pool filter, drop the duplicate factory checks, decide `containerLevel`, cache the output schema                                                          | F9 F10 F12                 | M    | `strike` vs `base.damage` |
| AG7     | Optional balance work: power-based band and price, a Will total review before clothing                                                                                                                                                                                                   | F13 F14                    | M    | yes                       |

Order: AG1 → AG2 first (cheap, and they turn every later change into a red test), then AG3 (removes the most visible player
problem), then AG4/AG5, which change schemas. AG6 is pure refactoring under the AG2 net. AG7 only on request.

Acceptance for each phase: engine tests are green, the probe numbers are re-run (F1 dead-tool share 0% for new mints after AG3;
`crit-dmg`-without-`crit` 0% after AG4 if option a/b), `validateContent` stays green on real content, and each new
validation rule has one failing-content test.

## 6. Progress

Oleh's decisions (2026-11-23): AG3 option (b) `excludes: { tool: true }`; AG4 option (a) `requires.attributes`;
AG6 keeps `strike` and `block.sides` and deletes `base.damage`, `base.defense` and `base.blockSides`; AG7 is not done now.

### AG1 — done (2026-11-23)

1. One rule module: `packages/engine/src/tokens/equipment/equipment-content-rules.ts`. The content check
   (`equipmentContentFailures`, `tokenContentFailures`) and the factory (`validateFactoryContent`) call the same functions.
   The factory throws the first failure.
2. The profile rule (`profileEntryFailures`: unknown, blocked, foreign group, max above cap) has one implementation.
   The factory now also refuses blocked attributes in profiles.
3. The adjective filter has one implementation (`adjectivesFor`); `adjectivesForType` is removed.
4. The pool filter and the new checks share one eligibility predicate (`attributeFitsType`, `attributeGeneratable`).
5. New content rules:
   - one aggregate per stat for all attributes (F3);
   - one scope per stat for implemented attributes only (F8). `hero-crit` shares `critPoints` with `crit` and will fail
     this rule when it is implemented, so the F8 split must be done first;
   - an implemented, not deprecated attribute must have a profile row (F6);
   - a profile weight for a group with types must be reachable by at least one of them (F6). Groups without types
     (`burden`, `charm`) are skipped;
   - `block.sides` = `base.blockSides` when both exist (F6);
   - `maxCount + 1` ≤ min(adjective bands, price bands) (F10);
   - a base allowlist key must be known, implemented, not deprecated and fit the base type, and a non-empty list
     must hold one key that a tier rolls on that type (F4).
6. The stat rules and the profile-row rule run only in the content check, not in the factory: factory test fixtures
   implement every stat-bearing attribute on purpose.
7. The test `dimension-pools.test.ts` used `heart` on a sword allowlist (the F4 trap: it passed on zero attributes).
   It now uses `crit` and checks that attributes are rolled.

Tests: `equipment-content-rules.test.ts` (one failing-content test per rule, 12 tests). Engine 2482 passed, 2 skipped;
typecheck, lint and engine build passed. Token golden snapshots did not change, so generation is the same.
Not in AG1: unique attributes still skip the group check (see the review note on F1/F11), F12 dead paths stay for AG6.

### AG2 — done (2026-11-23)

1. `packages/engine/src/tokens/equipment/generator/attribute-conformance.test.ts` (110 tests, about 1 s) is driven by
   the real content: every attribute × every equipment type (enabled and planned) × every tier.
   - Eligibility: the generator pool, the factory validator and `attributeGeneratable` + a profile weight agree.
   - Rolled values: 1000 seeds per type and tier roll every allowed value of each eligible attribute and nothing else.
   - Factory overrides: on every token type and tier, `min` and `max` are accepted and reach the stat reader with that
     value; `min − 1`, `max + 1` and ineligible attributes are refused.
   - Deprecated: each rolled attribute, when deprecated, stops rolling and still works on an owned token.
   - Readers: `STAT_READS` names where each implemented stat is read (`inventory`, `battle`, `tool`); a new implemented
     stat fails until it is listed. Attributes that roll on a type the reader never sees must equal `AWAITING_AG3`
     (crit, crit-dmg and trophy on axe and pickaxe). AG3 empties that list.
2. The decided ranges `[min, max, step]` per tier for every rolled attribute are pinned in one table:
   `content/attribute-profile-decisions.test.ts`. A new rolled attribute fails until its decided ranges are added.
3. Deleted, because the suite covers them: `block-`, `crit-`, `heal-on-block-`, `heart-`, `trophy-`, `wisdom-` and
   `yield-generation.test.ts`. Effect tests (battle, world, API, E2E) stay.
4. Mutation check: dropping the `onlyTypes` rule fails 20 tests; dropping the tool rule of the validator fails 8 tests.

The test "crit-dmg appears without crit" (`equipment-attribute-generator.test.ts`) stays until AG4 replaces it.
Engine 2537 passed, 2 skipped; typecheck and lint passed.

### AG3 — done (2026-11-23)

1. Schema: `EquipmentAttributeDefinition.excludes?: { tool: true }`, the mirror of `requires.tool`. An attribute
   cannot have both.
2. One eligibility rule: `attributeFitsType` (pool filter and content rules) and `typeFailure` (factory validator)
   refuse an attribute with `excludes.tool` on a type with `tool !== null`. The content check refuses an exclusion when
   the attribute's groups hold no type without a tool.
3. Content: `crit`, `crit-dmg` and `trophy` have `excludes: { tool: true }`. New axes and pickaxes roll only `will`
   and `yield`.
4. Owned tokens are not rerolled: stored tokens are read by `itemTokenSchema`, which does not check attribute rules,
   and the tooltip still shows their lines. Only new mints and factory overrides are refused.
5. The conformance suite now requires an empty list of attributes that roll on a type their reader never sees
   (`AWAITING_AG3` removed), so the F1 share of new mints is 0%.
6. Golden tokens: only the axe and pickaxe entries changed. `TOKEN_GENERATOR_VERSION` stays, like the earlier pool
   content changes (A08, A09, crit).

Tests: `equipment-content-rules.test.ts` AG3 block (marked attributes, schema refusal, content refusal, owned axe with
`crit` read and shown, new override refused), `generator-parts.test.ts` axe pool. Engine 2541 passed, 2 skipped; API
312 and web 4417 passed; typecheck, lint and engine build passed.

### AG4 — done (2026-11-23)

1. Schema: `requires` is `{ tool?: true, attributes?: string[] }` (at least one field, no self requirement).
   Content: `crit-dmg` has `requires: { attributes: ['crit'] }`.
2. Generator: before every pick it offers only pool entries whose requirements are already picked. The pick and
   value streams are unchanged, so a token changes only when a dependent attribute was eligible too early.
3. Validator: `dependencyFailure` (`attribute-rules.ts`) refuses a sheet where an attribute misses its requirement.
   The factory validator and both unique checks call it.
4. Content rules (`dependencyFailures`, base allowlists): unknown requirement, requirement cycle,
   `requirements + 1 > maxCount`, a requirement that cannot roll on a type and tier where the dependent rolls, and a
   base allowlist that holds a dependent without its requirement.
5. Tests: the old "crit-dmg appears without crit" is now "crit-dmg appears only together with crit"; the conformance
   suite checks requirements in every rolled token and refuses a dependent override without its requirement; the
   AG4 block in `equipment-content-rules.test.ts` has one failing-content test per rule. Mutation check: a generator
   that ignores requirements fails 4 tests. Golden tokens: one sword changed (`crit-dmg` alone became `trophy`).
6. Probe, 20 000 swords per tier:

   | tier | crit (before → after) | crit-dmg (before → after) | crit-dmg without crit |
   | ---- | --------------------- | ------------------------- | --------------------- |
   | 2    | ≈ 26% → 30.8%         | ≈ 12% → 1.5%              | 0                     |
   | 3    | ≈ 35% → 40.4%         | ≈ 17% → 2.6%              | 0                     |
   | 4    | ≈ 44% → 51.8%         | ≈ 22% → 4.4%              | 0                     |

   The "before" values are computed from the weights. Every `crit-dmg` now works. `crit` is more common, because
   `crit-dmg` no longer takes the first pick. **Decision for Oleh:** keep this, or raise the `crit-dmg` weight
   (content only, `attribute-profiles.content.ts`).

Engine 2549 passed, 2 skipped; API 312 and web 4417 passed; typecheck, lint and engine build passed.

### Key rename `crit` → `crit-chance` (2026-11-23, done)

Decision (Oleh): rename the key and the label. Delete all outdated code, with no read-time key translation.

1. Content: `crit-chance` (en "Crit Chance", uk «Шанс криту»), same stat, values, cap, icon and `excludes.tool`. `crit-dmg` has `requires: { attributes: ['crit-chance'] }`.
2. Deleted: the `crit` and `focus` definitions, their profile rows and their `attrLabel`/`attrHint` texts in en and uk; `wisdom-compatibility.test.ts`; the legacy `focus` path of the e2e hook `grantLegacyWisdomToken` and its spec.
3. Effect on saves: a stored token that holds `crit` or `focus` keeps the line, but has no effect and shows no row.
4. Golden tokens: one sword changed only the key `crit` → `crit-chance` (the value stream is named by key).
5. Checks: engine 2545 passed, 2 skipped; API 312; web 4408; typecheck, lint, engine build; e2e `combat/equipment-crit.spec.ts` and `hero/equipment-wisdom.spec.ts` 9/9 passed.

### AG5 — cap model (2026-11-23, done)

Field names as proposed in §5: `itemMax` and `totalCap`. No floor field: no `min` aggregate needs one, so the schema forbids both
fields on a `min` aggregate.

1. Schema `equipment-attribute-schema.ts`: `cap` is replaced by optional `itemMax` and `totalCap`. Refusals: "a min aggregate
   cannot have itemMax or totalCap", "itemMax cannot be above totalCap".
2. `itemMax` is checked by `profileEntryFailures` (profile `max`) and by `uniqueFailure` (unique values).
   New content rule `itemMaxFailures`: an implemented, not deprecated, non-`min` attribute without `itemMax` fails.
3. `totalCap` is applied by `resolveStat` to the equipped total (`totalCapOf`, the strictest of one stat), as `cap` was.
4. F7: `MAX_BLOCK_SIDES` and `BLOCK_ATTRIBUTE_KEY` are deleted. The generic rule `totalCapFailure` checks one item: type base of
   the stat (`typeBaseStats`, new `tokens/equipment/type-base-stats.ts`, also used by `resolveHeroStats`) plus its token values,
   aggregated, against `totalCap`. It runs with the requirement check as `attributeSetFailure` in the token validator, in
   `uniqueContentFailures` and in the factory content check (before, uniques in content were never checked for sides).
   Probe P7 again: `shield` `itemMax 7`, `totalCap 8` accepts a 7-side unique shield; with `totalCap 6` it is refused as
   "Item stat blockSides 7 is above its totalCap 6".
5. Content values. Every old `cap` became `itemMax` = `totalCap` with the same number, except:
   - `shield`: `itemMax 5`, `totalCap 6` (one shield is base 1 + 5; the old validator constant gave the same limit);
   - `will`: `itemMax 40` (tier-4 maximum), no `totalCap` (Oleh, 2026-11-19). Before, a unique `will` had no limit.
   - `smart-step` (`min`): neither field, as before.
6. F10: the default crit multiplier ×2 is `BATTLE_RULES.critMultiplier` (schema `int ≥ 2`), passed to `BaseStrikeDamage`.
   `BATTLE_RULES.maxShieldSides` (6) stays: it is the battle limit for every creature, enemies included.
7. Behaviour of the game is unchanged: golden tokens are unchanged, no stored token is rechecked.
8. Tests: `equipment-content-rules.test.ts` block "AG5 F5" (schema refusals, missing `itemMax`, unique `will` 41, total rule
   from content, equipped total), `strike-pipeline.test.ts` "AG5 default crit multiplier"; old `cap` messages updated.
   Mutations (remove the total rule, the `itemMax` rule, either schema refusal, hardcode ×2, drop `totalCap` in `resolveStat`)
   each fail a test. Engine 2551 passed, 2 skipped; API 312; web 4408; typecheck, lint, engine build passed.

### AG6 — content cleanup (2026-11-23, done)

Decision (Oleh): keep `strike` and `block.sides`, delete the `base` copies. `containerLevel`: no production path passes it, so it is
deleted (Oleh: delete all outdated code).

1. F9: `base.damage`, `base.defense` and `base.blockSides` are deleted from the schema and from sword, shield, axe and pickaxe.
   Hand types have no `base`; `base` is optional and holds `hearts` and `will`. The readers `block?.sides ?? base?.blockSides`
   (`hero-stats.ts`, `shield-stats.ts`, `type-base-stats.ts`) read only `block.sides`. The AG1 rule `blockSidesFailures` and
   its test are deleted, because there is one field now.
2. F10 tiers: `mapTierSchema = z.literal(MAP_TIERS)`; `ATTRIBUTE_PROFILE_TIERS` is mapped from `MAP_TIERS` and
   `TAttributeProfileTier` is `tier-${TMapTier}`; `attributeProfilesSchema` keys come from it; `ATTRIBUTE_PROFILES` is built
   from `MAP_TIERS`; `ROWS.tiers` and `COUNT_WEIGHTS` are `PerMapTier<T>`, a tuple with the length of `MAP_TIERS`. Probe: a
   fifth range in one row is a type error ("Source has 5 element(s) but target allows only 4").
3. F10 `ROWS` keys: `EQUIPMENT_ATTRIBUTES` keeps literal keys (`attribute<K>()`, `as const`), exported as
   `EquipmentAttributeKey`; `ROWS` is `Partial<Record<EquipmentAttributeKey, ProfileRow>>`. Probe: `crit-chanse` is a type error.
4. F12 registry: `RegistryAttributePoolFilter` and `createEquipmentAttributeGenerator` take an `AttributeRegistry`; the factory
   passes its own. The pool filter's own parse and `DUPLICATE_ATTRIBUTE` check are deleted (the registry refuses duplicates).
5. F12 duplicate checks: `createBase` no longer calls `validateAttributes` and the allowlist check before `validator.validate`,
   which runs both.
6. F12 dead paths: `generation-level.ts` (`resolveGenerationLevel`, `DEFAULT_GENERATION_LEVEL`) and its test are deleted, the
   level is `ctx.mapTier` (already checked by `sourceRefusal`). `RealmTypePicker.pick(realm, key)` lost its random branch and
   its `rng`; `TypeRegistry.forRealm` (used only there) and its test are deleted.
7. F12 schema: the generator caches its output schema per `maxCount`.
8. Golden tokens are unchanged. Tests: block "AG6 F10" in `equipment-content-rules.test.ts` (profile keys = `MAP_TIERS`, missing
   or extra tier refused, `mapTierSchema`), base table test rewritten. Engine 2547 passed, 2 skipped; API 312; web 4408;
   typecheck, lint, engine build passed.

Still open from §5: AG7 (power-based band and price, Will total review), only on request. Not in any phase: unique attributes skip
the group check (AG1 note).
