# HEXOFLAT — Resource Ecology & Discovery Rewards

**Implementation Specification:** v0.1  
**Design status:** Candidate — do not promote to canonical without explicit approval/playtest  
**Parent design:** `Hexoflat_Resource_Ecology_and_Discovery_Rewards_Candidate_v0.1.md`  
**Primary design contract:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Audience:** Claude Code / Engineering / QA / Game Design

---

# 0. Implementation Mandates

1. Reuse existing Hero Token, hex grid, pathfinding, Hand/Tool interaction and inventory primitives where possible.
2. Do not add a harvesting minigame for Routine Take.
3. Do not add generic rarity tiers or hidden resource-power statistics to player-facing UI.
4. Resource placement must be habitat-driven and deterministic from world/region seed.
5. Resource definitions must declare at least one meaningful system use before spawn eligibility.
6. Preview and execution must query the same canonical interaction rules.
7. Strategic source states must live in game state, not UI-only state.
8. Terrain/resource transformations must invalidate affected pathfinding and persist in save state.
9. Knowledge state must be explicit and persisted.
10. Hidden resource coordinates must not be surfaced by Expedition Intent unless an approved knowledge rule allows it.
11. Resource regeneration must not support stationary Gather-Will farming loops.
12. Start with three resource types; add the fourth only after readability tests pass.
13. Reward motive rotation must integrate with Region Grammar experience memory rather than run as an unrelated loot system.
14. Quantities may be numeric only as literal counts; do not introduce abstract gathering stats.
15. All important known source states need a board/UI representation.

---

# 1. Exact Incremental Implementation Order

## STEP 1 — Introduce Canonical Resource IDs and Roles

```ts
type ResourceId = 'MEDICINAL_PLANT' | 'STONE_FRAGMENT' | 'TIMBER' | 'BINDING_FIBER'; // disabled by default in v0.1

type ResourceRole = 'RECOVERY' | 'STRUCTURE' | 'UTILITY' | 'CATALYST' | 'UNIQUE_SPECIMEN';

type ResourceRenewalPolicy = 'FINITE' | 'RENEWABLE_WORLD_CYCLE' | 'SYSTEMIC_SOURCE';
```

Do not implement rarity enums in v0.1.

Acceptance:

- every resource entity references a canonical `ResourceDefinition`;
- disabled resource definitions cannot spawn.

---

## STEP 2 — Add Resource Definition Contract

```ts
interface ResourceDefinition {
  id: ResourceId;
  role: ResourceRole;
  displayNameKey: string;
  interactionClass: ResourceInteractionClass;
  habitatDefinitionId?: ResourceHabitatDefinitionId;
  worldTokenAssetId: string;
  inventoryTokenAssetId: string;
  renewalPolicy: ResourceRenewalPolicy;
  systemUses: SystemUseId[];
  recognitionClueIds: ResourceClueId[];
  knowledgeRuleId: ResourceKnowledgeRuleId;
  sourceDefinitionId?: ResourceSourceDefinitionId;
  enabled: boolean;
}

type ResourceInteractionClass = 'ROUTINE_TAKE' | 'STRATEGIC_SOURCE';
```

Validation:

- enabled repeatable resources require `systemUses.length >= 1`;
- strategic sources require a source definition;
- habitat-driven resources require a habitat definition.

---

## STEP 3 — Add Resource Knowledge State

```ts
type ResourceKnowledgeState =
  'UNKNOWN' | 'SEEN' | 'IDENTIFIED' | 'HABITAT_KNOWN' | 'SOURCE_MASTERED';

interface ResourceKnowledgeRecord {
  resourceId: ResourceId;
  state: ResourceKnowledgeState;
  learnedClueIds: ResourceClueId[];
  knownSourceIds: ResourceSourceId[];
  discoveredUseIds: SystemUseId[];
}
```

Transition constraints:

```text
UNKNOWN -> SEEN -> IDENTIFIED -> HABITAT_KNOWN -> SOURCE_MASTERED
```

Allow authored rule events to skip a state only when explicitly configured.

Do not derive knowledge from item quantity/XP.

Acceptance:

- save/load preserves knowledge;
- UI only shows information supported by knowledge state.

---

## STEP 4 — Implement Habitat Definitions

```ts
type ResourceHabitatDefinitionId = string;
type HabitatTag = string;

interface ResourceHabitatDefinition {
  id: ResourceHabitatDefinitionId;
  resourceId: ResourceId;
  requiredTerrainTags: HabitatTag[];
  anyTerrainTags?: HabitatTag[];
  forbiddenTerrainTags?: HabitatTag[];
  boundaryRules?: HabitatBoundaryRule[];
  clueIds: ResourceClueId[];
  minSourceCount: number;
  maxSourceCount: number;
  allowedRegionGrammarIds: RegionGrammarId[];
  habitatTypeWeights: Partial<Record<ResourceHabitatType, number>>;
}

interface HabitatBoundaryRule {
  sourceTag: HabitatTag;
  adjacentTag: HabitatTag;
  minMatches: number;
}
```

Starter medicinal candidate:

- requires/shares `DAMP` or equivalent biome tag;
- prefers boundary adjacent to `STONE_MASS`/shade-compatible terrain;
- uses one distinct ecology clue;
- source count should be cluster-level, not token confetti.

Do not hard-code art-specific biome assumptions into the generic habitat engine.

---

## STEP 5 — Add Resource Clue Model

```ts
type ResourceClueId = string;

type ResourceClueClass =
  'VEGETATION' | 'GEOLOGY' | 'TRACE' | 'SOUND' | 'LIGHT' | 'BOUNDARY' | 'CREATURE_BEHAVIOR';

interface ResourceClueDefinition {
  id: ResourceClueId;
  clueClass: ResourceClueClass;
  resourceFamilyHintKey?: string;
  visibleAssetId?: string;
  environmentStateId?: string;
  visibilityRuleId: VisibilityRuleId;
}
```

Rules:

- prefer environment state/art to floating markers;
- clue can exist before source enters `DISCOVERED` state;
- Scout classification calls knowledge rules, not hidden-coordinate lookup.

---

## STEP 6 — Add Resource Source Entities

```ts
type ResourceSourceId = string;

type ResourceSourceState =
  | 'UNRECOGNIZED'
  | 'AVAILABLE'
  | 'HARVESTED'
  | 'DISTURBED'
  | 'RECOVERING'
  | 'EXHAUSTED'
  | 'TRANSFORMED';

interface ResourceSourceEntity {
  id: ResourceSourceId;
  resourceId: ResourceId;
  coord: HexCoord;
  sourceDefinitionId: ResourceSourceDefinitionId;
  state: ResourceSourceState;
  discoveryState: DiscoveryState;
  lastStateChangeCycle?: WorldCycleId;
  persistent: boolean;
}

interface ResourceSourceDefinition {
  id: ResourceSourceDefinitionId;
  legalActions: ResourceSourceActionId[];
  stateTransitions: ResourceSourceTransition[];
  renewalPolicy: ResourceRenewalPolicy;
  interactionToolIds: ToolId[];
  createsNoise?: boolean;
  topologyEffectId?: TerrainTransformationId;
}
```

Resource source state is canonical world state.

---

## STEP 7 — Implement Routine Take Using Existing Hand Grammar

Existing interaction pattern:

`Hand Token -> overlap Resource Token -> Take`

Add canonical command/event:

```ts
interface TakeResourceCommand {
  type: 'TAKE_RESOURCE';
  actorId: EntityId;
  resourceEntityId: EntityId;
}

interface ResourceTakenEvent {
  type: 'RESOURCE_TAKEN';
  actorId: EntityId;
  resourceId: ResourceId;
  quantity: number;
  sourceEntityId: EntityId;
}
```

Validation:

- Hero is on a legal adjacent interaction hex;
- Hand is active/available according to existing interaction rules;
- resource is visible/discovered;
- inventory can receive it or the fallback choice is displayed.

Candidate flow rule:

- Routine Take must not launch a separate board/minigame;
- animation should be short;
- whether it consumes the current `Act` must be controlled by the parent Hero Turn rules. Do not duplicate action-economy logic in resource code.

---

## STEP 8 — Integrate Stone Crust By-Product

Extend existing Pickaxe transformation event.

On approved `STONE_CRUST -> BROKEN_PASSAGE` transition:

```ts
interface ResourceSpawnedEvent {
  type: 'RESOURCE_SPAWNED';
  resourceEntityId: EntityId;
  resourceId: ResourceId;
  quantity: number;
  coord: HexCoord;
  causeEntityId?: EntityId;
}
```

v0.1 rule:

- transformation may spawn one visible Stone Fragment token according to deterministic transformation config;
- fragment is Routine Take;
- no random mineral loot table in v0.1.

Semantic trace:

`Pickaxe -> Stone Crust breaks -> Passage opens -> Stone Fragment released`

Acceptance:

- pathfinding updates before route continuation preview;
- fragment spawn is deterministic;
- broken passage persists.

---

## STEP 9 — Implement Minimal Inventory Resource Stack Contract

```ts
interface ResourceStack {
  resourceId: ResourceId;
  quantity: number;
}
```

Player-facing rules:

- literal quantity may be numeric if rendering repeated physical tokens becomes unreasonable;
- important unique specimens do not share fungible stacks;
- default Player Board should not permanently list every resource type;
- current context/selected resource can expose count.

Do not build a giant permanent resource dashboard.

---

## STEP 10 — Add Mock System Sinks Before More Spawn Types

Create minimal development/test sinks so every starter resource has purpose.

```ts
type SystemUseId =
  'MOCK_HEALING_ELIXIR' | 'MOCK_ROUTE_STABILIZATION' | 'MOCK_BRIDGE_REPAIR' | 'MOCK_ROPE_GEAR';
```

Initial mapping:

- Medicinal Plant -> `MOCK_HEALING_ELIXIR`;
- Stone Fragment -> `MOCK_ROUTE_STABILIZATION`;
- Timber -> `MOCK_BRIDGE_REPAIR`;
- Binding Fiber -> disabled until `MOCK_ROPE_GEAR` is tested.

Mock sinks exist to validate ecology flow; they are not final Crafting/Healing implementations.

Acceptance:

- no starter resource can be spawned if its configured sink is disabled and no alternative valid use exists.

---

## STEP 11 — Add Habitat Placement Service to Region Generator

```ts
interface ResourceHabitatPlanner {
  plan(input: ResourceHabitatPlanInput): ResourceHabitatPlanResult;
}

interface ResourceHabitatPlanInput {
  seed: string;
  regionId: RegionId;
  regionGrammarId: RegionGrammarId;
  terrain: ReadonlyMap<HexCoordKey, TerrainState>;
  playerProgression: ProgressionSnapshot;
  experienceMemory: ExplorationExperienceMemory;
  rewardPlan: RegionRewardPlan;
}
```

Algorithm:

1. derive legal resource candidates from enabled definitions;
2. remove candidates with no active/future supported sink;
3. filter by Region Grammar and biome tags;
4. find habitat sockets matching terrain/boundary constraints;
5. score candidates against recent resource/habitat memory;
6. respect region reward motive plan;
7. deterministic weighted pick;
8. place clue first;
9. place source(s) inside clue-supported habitat;
10. validate route cost/readability;
11. lint;
12. commit.

Never independently scatter resource tokens after topology generation.

---

## STEP 12 — Add Resource Experience Memory

Extend exploration memory:

```ts
interface ResourceExperienceMemory {
  recentResourceIds: ResourceId[];
  recentHabitatTypes: ResourceHabitatType[];
  recentResourceVerbTags: ResourceVerbTag[];
  recentResourceSinkTags: SystemUseId[];
  recentRewardDimensions: DiscoveryRewardDimension[];
}
```

Candidate windows:

- resource identity: last 4 resource-bearing regions;
- habitat type: last 4;
- dominant interaction: last 3;
- reward dimensions: last 5.

Do not make repetition impossible forever.

---

## STEP 13 — Implement Reward Dimension Model

```ts
type DiscoveryRewardDimension =
  | 'TOPOLOGY'
  | 'KNOWLEDGE'
  | 'CAPABILITY'
  | 'SYSTEM_ACCESS'
  | 'WORLD_STATE'
  | 'NARRATIVE'
  | 'MATERIAL'
  | 'RESOURCE_SOURCE';

interface DiscoveryRewardPlan {
  primary: DiscoveryRewardDimension;
  secondary?: DiscoveryRewardDimension;
  rewardIds: string[];
  optional: boolean;
}
```

Major optional discoveries:

- should normally contain two distinct dimensions;
- linter warning if `primary === secondary`;
- linter warning if recent optional discoveries overuse `MATERIAL`.

Minor discoveries may use one dimension.

---

## STEP 14 — Integrate Reward Motive With Region Grammar Selector

Add to region experience memory:

```ts
type RewardMotiveTag = DiscoveryRewardDimension;
```

Selection flow:

1. grammar selector picks candidate proposition;
2. reward planner checks recent motive history;
3. choose reward dimensions compatible with proposition;
4. resource planner receives the reward plan;
5. region linter validates payoff purpose.

Example:

`RESOURCE_LURE` does not require `MATERIAL` as primary every time. It may deliver:

- `RESOURCE_SOURCE + KNOWLEDGE`;
- `MATERIAL + KNOWLEDGE`;
- `RESOURCE_SOURCE + TOPOLOGY` in a source/shortcut combination.

---

## STEP 15 — Implement Knowledge Events

```ts
type ResourceKnowledgeEvent =
  ResourceSeenEvent | ResourceIdentifiedEvent | HabitatLearnedEvent | ResourceSourceMasteredEvent;
```

Example:

```ts
interface HabitatLearnedEvent {
  type: 'RESOURCE_HABITAT_LEARNED';
  resourceId: ResourceId;
  habitatDefinitionId: ResourceHabitatDefinitionId;
  learnedClueIds: ResourceClueId[];
  cause: 'OBSERVATION' | 'USE' | 'AUTHORED' | 'FACILITY';
}
```

Rules:

- event must correspond to a real player/world interaction;
- no passive hidden XP thresholds in v0.1;
- resource UI updates from the same knowledge record used by Scout/Expedition Intent.

---

## STEP 16 — Scout Resource Reading Hooks

Extend Scout preview API:

```ts
interface ScoutEcologyReadResult {
  clueId: ResourceClueId;
  classification: 'UNKNOWN_ECOLOGY_SIGNAL' | 'LIKELY_RESOURCE_HABITAT' | 'KNOWN_RESOURCE_FAMILY';
  resourceId?: ResourceId;
}
```

Rules:

- classification cannot exceed knowledge state;
- Scout cannot query exact hidden source coords;
- `AWARENESS_INTERRUPT` may trigger on newly visible high-relevance clue if player settings allow;
- relevance may consider pinned Expedition Intent.

---

## STEP 17 — Implement Expedition Intent Candidate

```ts
type ExpeditionIntentId = string;

interface ExpeditionIntent {
  id: ExpeditionIntentId;
  type: 'RESOURCE_NEED';
  resourceId: ResourceId;
  sourceSystemId?: SystemUseId;
  active: boolean;
}
```

Behavior:

- one active resource intent is enough for v0.1;
- highlights **known habitat/source knowledge**, not hidden exact nodes;
- relevant Observed ecology signals may receive subtle contextual emphasis;
- intent auto-resolves or remains optional depending on source system;
- never adds a permanent top-bar quest tracker.

---

## STEP 18 — Implement One Renewable Strategic Source

Do this only after Routine Take + habitats work.

Candidate: persistent Medicinal Patch.

Actions:

```ts
type ResourceSourceActionId = 'PRESERVE_HARVEST' | 'EXTRACT_HARVEST';
```

Candidate state graph:

```text
AVAILABLE --PRESERVE--> HARVESTED/RECOVERING
AVAILABLE --EXTRACT--> DISTURBED
RECOVERING --world-cycle--> AVAILABLE
DISTURBED --longer world-cycle--> RECOVERING -> AVAILABLE
```

Requirements:

- both actions have context-dependent value;
- differences are visibly explained before commit;
- do not show numeric regeneration percentages;
- if playtest shows the choice is trivial or annoying, remove it and revert to direct strategic harvest.

---

## STEP 19 — Add World-Cycle Recovery Service

Do not key renewal to real-time timers.

```ts
interface WorldCycleAdvancedEvent {
  type: 'WORLD_CYCLE_ADVANCED';
  cycleId: WorldCycleId;
  cause: WorldCycleCause;
}
```

Candidate valid causes:

- expedition resolution;
- approved world progression milestone;
- configured batch of World Pulses while the source is not locally farmed.

Anti-farm rule:

- repeated Gather Will while remaining in the same local habitat cannot alone advance a source from harvested to fully available.

Implement explicit test for this invariant.

---

## STEP 20 — Add Known Source Memory

```ts
interface KnownResourceSource {
  sourceId: ResourceSourceId;
  resourceId: ResourceId;
  coord: HexCoord;
  status: 'KNOWN' | 'MASTERED';
  routeAnchorId?: EntityId;
}
```

Rules:

- source becomes Known only through actual discovery/knowledge transition;
- known-source marker is compact and contextual;
- known source may feed future Known Route/Travel planning;
- source state remains actual world state, not assumed always available.

---

## STEP 21 — Add Game Kit/UI Primitives

Required components:

### ResourceToken

Props/state:

- resource identity;
- world/inventory context;
- available quantity if literal stack;
- interaction highlight.

### ResourceSourceVisual

- maps canonical source state to world representation;
- no hidden gameplay state only in tooltip.

### KnownSourceMarker

- compact map marker;
- visible only after knowledge rule permits.

### ExpeditionIntentIndicator

- contextual Player Board state;
- not permanent when no intent exists.

### Habitat clue

- preferably world art/terrain state, not UI widget.

---

## STEP 22 — Semantic Rule Trace

Resource commands emit trace tokens/events consumable by UI and tests.

Examples:

```text
Hand -> Medicinal Plant -> Take -> Bag receives Medicinal Plant
```

```text
Pickaxe -> Stone Crust -> Broken Passage -> Stone Fragment appears -> Route recalculated
```

```text
Observe Ecology Clue -> Resource identified -> Habitat learned -> Future clue classification unlocked
```

```text
Extract Patch -> Resource gained -> Patch Disturbed -> Recovery delayed
```

Rule trace must derive from actual execution events.

---

# 2. Starter Data Definitions

## 2.1 Medicinal Plant

```ts
const MEDICINAL_PLANT: ResourceDefinition = {
  id: 'MEDICINAL_PLANT',
  role: 'RECOVERY',
  displayNameKey: 'resource.medicinalPlant.name',
  interactionClass: 'ROUTINE_TAKE',
  habitatDefinitionId: 'HABITAT_MEDICINAL_STONE_DAMP',
  worldTokenAssetId: 'resource_medicinal_plant_world',
  inventoryTokenAssetId: 'resource_medicinal_plant_token',
  renewalPolicy: 'RENEWABLE_WORLD_CYCLE',
  systemUses: ['MOCK_HEALING_ELIXIR'],
  recognitionClueIds: ['CLUE_MEDICINAL_DAMP_STONE'],
  knowledgeRuleId: 'KNOWLEDGE_MEDICINAL_PLANT',
  enabled: true,
};
```

The vertical slice may spawn loose specimens from a habitat before implementing persistent patch harvesting.

---

## 2.2 Stone Fragment

```ts
const STONE_FRAGMENT: ResourceDefinition = {
  id: 'STONE_FRAGMENT',
  role: 'STRUCTURE',
  displayNameKey: 'resource.stoneFragment.name',
  interactionClass: 'ROUTINE_TAKE',
  worldTokenAssetId: 'resource_stone_fragment_world',
  inventoryTokenAssetId: 'resource_stone_fragment_token',
  renewalPolicy: 'FINITE',
  systemUses: ['MOCK_ROUTE_STABILIZATION'],
  recognitionClueIds: [],
  knowledgeRuleId: 'KNOWLEDGE_STONE_FRAGMENT',
  enabled: true,
};
```

Primary v0.1 source is Stone Crust transformation by-product.

---

## 2.3 Timber

```ts
const TIMBER: ResourceDefinition = {
  id: 'TIMBER',
  role: 'STRUCTURE',
  displayNameKey: 'resource.timber.name',
  interactionClass: 'ROUTINE_TAKE',
  habitatDefinitionId: 'HABITAT_FALLEN_TIMBER',
  worldTokenAssetId: 'resource_timber_world',
  inventoryTokenAssetId: 'resource_timber_token',
  renewalPolicy: 'FINITE',
  systemUses: ['MOCK_BRIDGE_REPAIR'],
  recognitionClueIds: ['CLUE_FALLEN_TIMBER'],
  knowledgeRuleId: 'KNOWLEDGE_TIMBER',
  enabled: true,
};
```

Tree-felling strategic source is deferred.

---

# 3. Habitat Placement Algorithm

## 3.1 Candidate Socket Discovery

For each habitat definition:

1. scan region terrain once;
2. derive candidate source coordinates matching required tags;
3. evaluate boundary rules using neighboring 6 hexes;
4. remove mandatory-route obstruction conflicts;
5. remove interaction-inaccessible coordinates;
6. group adjacent candidates into habitat clusters;
7. choose cluster deterministically based on region seed/reward plan.

Avoid O(resourceDefinitions × regionHexes × repeated pathfinding) when possible; pre-index terrain tags for each generated region.

## 3.2 Route Decision Validation

For `ROUTE_DEVIATION` habitat:

calculate internal values:

```ts
interface ResourceBranchOutcome {
  extraPathHexes: number;
  requiresAdditionalWillCycle: boolean;
  exposureHooks: number;
  knownThreatIntersections: number;
  createsFutureRouteBenefit: boolean;
}
```

The branch is invalid if:

- cost is zero and resource is guaranteed useful, making choice automatic;
- cost is extreme relative to current context with no compensating benefit;
- mandatory progression secretly depends on collecting it.

Values are internal only.

---

# 4. Reward Planner Algorithm

```ts
function planDiscoveryReward(ctx: RewardContext): DiscoveryRewardPlan {
  const legalDimensions = getLegalRewardDimensions(ctx.grammar, ctx.progression);

  const primary = seededWeightedPick(
    legalDimensions.map((dim) => ({
      value: dim,
      weight:
        baseRewardWeight(dim) *
        noveltyRewardMultiplier(dim, ctx.memory) *
        propositionFitMultiplier(dim, ctx.grammar) *
        currentNeedMultiplier(dim, ctx),
    })),
    ctx.seed,
  );

  const secondary = ctx.isMajorDiscovery
    ? chooseCompatibleSecondary(primary, legalDimensions, ctx)
    : undefined;

  return buildRewardPlan(primary, secondary, ctx);
}
```

Rules:

- `MATERIAL + MATERIAL` is invalid for major optional discovery;
- `RESOURCE_SOURCE + MATERIAL` is allowed only when source discovery itself changes future sourcing;
- authored mystery sockets may force `NARRATIVE` as one dimension;
- critical campaign reward plans are authored/validated separately.

---

# 5. Knowledge Classification Algorithm

```ts
function classifyResourceClue(
  clue: ResourceClueDefinition,
  knowledge: ResourceKnowledgeRecord | undefined,
  scout: ScoutState,
): ScoutEcologyReadResult {
  if (!knowledge || knowledge.state === 'UNKNOWN') {
    return { clueId: clue.id, classification: 'UNKNOWN_ECOLOGY_SIGNAL' };
  }

  if (knowledge.state === 'SEEN' || knowledge.state === 'IDENTIFIED') {
    return { clueId: clue.id, classification: 'LIKELY_RESOURCE_HABITAT' };
  }

  if (
    (knowledge.state === 'HABITAT_KNOWN' || knowledge.state === 'SOURCE_MASTERED') &&
    scout.capabilities.includes('FRONTIER_READING')
  ) {
    return {
      clueId: clue.id,
      classification: 'KNOWN_RESOURCE_FAMILY',
      resourceId: knowledge.resourceId,
    };
  }

  return { clueId: clue.id, classification: 'LIKELY_RESOURCE_HABITAT' };
}
```

Exact thresholds may change, but no branch can leak hidden source coordinates.

---

# 6. Strategic Source Recovery Algorithm

Candidate source recovery requires a world-cycle policy.

```ts
interface ResourceRecoveryPolicy {
  requiredWorldCycles: number;
  requiresPlayerAbsentFromLocalRegion: boolean;
  minimumExpeditionTransitions?: number;
}
```

Internal counts are allowed.

Player-facing UI should use source visual states:

- Harvested;
- Recovering;
- Available.

Do not show `2/5 cycles` unless later usability testing proves exact cadence is decision-critical and explicitly approved.

---

# 7. Save / Load Contracts

Persist:

```ts
interface ResourceEcologySaveState {
  knowledge: ResourceKnowledgeRecord[];
  sourceStates: ResourceSourceEntity[];
  knownSources: KnownResourceSource[];
  inventory: ResourceStack[];
  activeExpeditionIntent?: ExpeditionIntent;
  resourceExperienceMemory: ResourceExperienceMemory;
}
```

Requirements:

- committed source IDs remain stable;
- deterministic regeneration cannot duplicate already committed source entities;
- source transformations survive save/load;
- resource knowledge cannot regress due missing cached UI data.

---

# 8. Procedural Generation Rules

1. Habitat placement occurs after topology/terrain assignment, before final region commit.
2. Habitat definition must match actual world terrain tags.
3. Clue placement must be spatially/semantically connected to source.
4. Resource branch cannot block mandatory exit.
5. Secret resource source cannot become only path to critical progression.
6. Major reward motive is selected before exact resource identity where possible.
7. Resource density is capped by habitat clusters, not raw token count.
8. Recent-resource penalty applies across differently shaped regions.
9. A source with no sink is a hard generation error in development builds.
10. Binding Fiber remains disabled until three-resource slice passes acceptance.

---

# 9. UI/UX Behavior

## 9.1 World Resource Token

Hover/select:

- no permanent tooltip wall;
- context hint only when relevant;
- Hand overlap exposes `Take` if valid.

## 9.2 Resource Source

Selecting source shows only valid actions.

Example:

- `Harvest`;
- later `Preserve` / `Extract` if the strategic source system is active.

Known permanent consequences are previewed before commit.

## 9.3 Inventory

Player Board default:

- no giant resource list;
- show selected/quick relevant resources;
- Bag mode can show stacks.

## 9.4 Knowledge

On demand:

- known uses;
- known habitat cue;
- known sources;
- no undiscovered coordinates.

## 9.5 Expedition Intent

When active:

- compact Player Board indicator;
- known source/habitat map cues can emphasize;
- disappears when unpinned/resolved;
- no top bar.

---

# 10. Game Kit Contract

## Resource Token

| Field       | Value                                               |
| ----------- | --------------------------------------------------- |
| Represents  | One resource or literal stack                       |
| Player Verb | Take / inspect / use in another system              |
| States      | World / Held / Consumed                             |
| Source      | Habitat, terrain transformation, authored placement |
| Sink        | Healing/Crafting/World interaction                  |
| Reusable    | Global                                              |
| UI Form     | Small token                                         |

## Resource Source Object

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Represents  | Persistent harvestable source/habitat                        |
| Player Verb | Inspect / Harvest / strategic action where enabled           |
| States      | Available / Harvested / Disturbed / Recovering / Transformed |
| Source      | Procedural habitat or authored world entity                  |
| Sink        | May persist, recover, or transform                           |
| Reusable    | Global primitive with resource-specific visual grammar       |
| UI Form     | World object/hex feature, not full card                      |

## Known Source Marker

| Field       | Value                                                     |
| ----------- | --------------------------------------------------------- |
| Represents  | Player has learned a persistent source location           |
| Player Verb | inspect / route planning                                  |
| States      | Known / Mastered                                          |
| Source      | Knowledge progression                                     |
| Sink        | hidden only if source ceases to exist by known world rule |
| Reusable    | Global                                                    |
| UI Form     | Small contextual marker                                   |

## Expedition Intent Marker

| Field       | Value                               |
| ----------- | ----------------------------------- |
| Represents  | Current self-selected resource need |
| Player Verb | pin / unpin                         |
| States      | Active / Resolved                   |
| Source      | Crafting/Healing/player planning    |
| Sink        | completion/unpin                    |
| Reusable    | Global planning primitive           |
| UI Form     | compact Player Board marker         |

---

# 11. Test Fixtures

## Fixture R1 — Medicinal Teaching Habitat

Map:

- Camp-known edge;
- one Stone Mass boundary;
- damp terrain tags;
- one visible clue;
- one Medicinal Plant source branch.

Assertions:

- clue can be Observed before exact source;
- source is reachable;
- Take works from adjacent hex;
- knowledge transitions are persisted;
- source can become Known after configured learning event.

## Fixture R2 — Stone Passage By-Product

Map:

- main detour;
- Stone Crust shortcut;
- Pickaxe available.

Assertions:

- Crust is initially blocked/destructible;
- Pickaxe opens passage;
- Stone Fragment spawns deterministically;
- pathfinding route changes;
- Take puts fragment in inventory;
- save/load preserves passage and inventory.

## Fixture R3 — Resource Lure

Map:

- direct route to exit;
- optional medicinal habitat branch;
- branch causes meaningful extra path or pulse exposure.

Assertions:

- both routes legal;
- no automatic collection;
- resource need can influence intent UI;
- branch remains optional.

## Fixture R4 — Reward Variety

Generate deterministic sequence of at least 20 regions.

Assertions:

- no excessive `MATERIAL` reward streak beyond configured warning threshold;
- major optional discoveries normally have two dimensions;
- resource identity repetition penalty operates.

## Fixture R5 — No Local Respawn Farm

Player remains beside harvested renewable source and repeatedly Gather Will.

Assertion:

- source does not return to Available solely from local repeated Gather Will below approved recovery conditions.

## Fixture R6 — Knowledge Leak

Player pins Medicinal Plant intent but has only `SEEN` knowledge.

Assertion:

- hidden exact sources remain hidden;
- only rule-legal known clues/habitats are emphasized.

## Fixture R7 — Inventory Full

Attempt Take with no available storage.

Assertions:

- resource is not destroyed silently;
- clear contextual explanation/action appears;
- source/world token remains where possible.

---

# 12. Property / Invariant Tests

## I1 — Determinism

Same world seed + generation version + committed state => same habitat/resource plan.

## I2 — Purpose

Every enabled spawned repeatable resource has at least one valid `systemUse`.

## I3 — No Hidden Exact Leak

Knowledge/Scout/Intent APIs cannot return exact hidden source coordinates unless explicit discovery rule permits.

## I4 — Critical Reachability

Removing all optional resource branches does not make critical progression unreachable.

## I5 — Persistent Mutation

Terrain/source permanent transformations survive save/load.

## I6 — Interaction Accessibility

Every spawned interactable source has at least one legal Hero interaction hex.

## I7 — No Local Farm

Repeated local Gather Will cannot infinitely regenerate recurring resources without required world-cycle conditions.

## I8 — Reward Diversity

Major optional discovery planner cannot generate `MATERIAL + MATERIAL`.

## I9 — Knowledge Monotonicity

Resource knowledge cannot regress during normal gameplay.

## I10 — Source State Visibility

If a known source state changes and affects availability, the player-facing representation changes.

## I11 — No Disabled Spawn

Disabled resources never spawn.

## I12 — Preview Equals Execution

Known source transformation consequences shown in preview equal final canonical rules unless hidden information explicitly intervenes.

---

# 13. Generator Linter Extensions

Add resource ecology issues:

```ts
type ResourceLintIssueCode =
  | 'RESOURCE_WITHOUT_USE'
  | 'HABITAT_MISMATCH'
  | 'SOURCE_NO_INTERACTION_HEX'
  | 'RESOURCE_REPETITION_HIGH'
  | 'REWARD_MOTIVE_REPETITION_HIGH'
  | 'TOKEN_DENSITY_HIGH'
  | 'CRITICAL_ROUTE_RESOURCE_GATED'
  | 'HIDDEN_SOURCE_LEAK'
  | 'STRATEGIC_CHOICE_DOMINATED'
  | 'LOCAL_RESPAWN_FARM_POSSIBLE';
```

Hard errors:

- RESOURCE_WITHOUT_USE;
- HABITAT_MISMATCH for committed source;
- SOURCE_NO_INTERACTION_HEX;
- CRITICAL_ROUTE_RESOURCE_GATED without fallback;
- HIDDEN_SOURCE_LEAK;
- LOCAL_RESPAWN_FARM_POSSIBLE.

Warnings initially:

- repetition;
- token density;
- dominated strategic choice.

---

# 14. Developer Debug View

Debug-only overlay may show:

- habitat candidate cells;
- selected habitat cluster;
- clue visibility region;
- source state;
- reward dimensions;
- recent-resource repetition score;
- sink/use IDs;
- knowledge state;
- renewal policy;
- path branch outcome vectors.

Never ship this as normal player-facing UI.

---

# 15. Telemetry Events

Suggested events:

```ts
RESOURCE_SIGNAL_OBSERVED;
RESOURCE_SOURCE_DISCOVERED;
RESOURCE_TAKEN;
RESOURCE_IGNORED_AFTER_DISCOVERY;
RESOURCE_USED;
RESOURCE_HABITAT_LEARNED;
RESOURCE_SOURCE_MASTERED;
RESOURCE_INTENT_PINNED;
RESOURCE_INTENT_RESOLVED;
RESOURCE_ROUTE_DEVIATION_COMMITTED;
RESOURCE_SOURCE_STATE_CHANGED;
DISCOVERY_REWARD_GRANTED;
DISCOVERY_REWARD_DIMENSIONS;
```

Telemetry payloads should avoid personal data and focus on gameplay state.

---

# 16. Acceptance Criteria — Vertical Slice

The v0.1 implementation is acceptable only if all are true:

1. Three starter resources exist with canonical definitions and at least one usable/mocked sink each.
2. Medicinal Plant is placed through a habitat rule, not uniform random scatter.
3. The player can observe at least one habitat clue before exact source discovery.
4. Existing Hand interaction performs Routine Take without a separate minigame.
5. Stone Crust transformation opens topology and can create a deterministic Stone Fragment by-product.
6. Resource source/world mutation persists through save/load.
7. Resource knowledge persists and controls what Scout/Intent can reveal.
8. One Resource Lure region produces a genuine route decision.
9. Hidden exact source coordinates are not leaked by the need-tracking system.
10. Major discovery reward planner supports at least `MATERIAL`, `KNOWLEDGE`, `TOPOLOGY`, and `NARRATIVE` dimensions.
11. A deterministic multi-region generation test demonstrates reward-motive and resource anti-repetition logic.
12. No resource source needed for critical progression can be permanently exhausted without a fallback.
13. Repeated local Gather Will cannot be exploited as an infinite immediate farming loop.
14. Resource tokens/source visuals do not overwhelm board readability at target desktop layout.
15. All resource interactions generate semantic rule trace usable by QA/tests.

---

# 17. Playtest Acceptance Gates

Do not expand the resource library until these are observed:

## Gate A — Habitat Learning

At least a majority of testers can predict where the starter medicinal resource is likely to appear after being taught through play rather than a text tutorial.

## Gate B — Low Friction

Routine Take is not cited as a repetitive interruption.

## Gate C — Route Relevance

Players sometimes deviate from shortest path because a resource/source opportunity is meaningful.

## Gate D — Purpose Recognition

Players can name a use for collected starter resources without opening a large encyclopedia.

## Gate E — Reward Variety

Players do not report that all optional exploration feels like “go off-route for crafting materials.”

## Gate F — No Grind

Across repeated expeditions, players are not forced into the same maintenance collection circuit.

If a gate fails, redesign before adding more resource types.

---

# 18. Implementation Sequence Summary for Claude Code

Implement in this exact order:

1. Resource IDs/roles.
2. Resource definitions and validation.
3. Knowledge state.
4. Habitat definitions.
5. Clue definitions.
6. Source entity/state model.
7. Routine Take integration.
8. Stone Crust by-product integration.
9. Inventory stack representation.
10. Mock sinks.
11. Habitat planner.
12. Resource experience memory.
13. Discovery reward dimension model.
14. Reward motive integration with Region Grammar.
15. Knowledge events.
16. Scout ecology reading.
17. Expedition Intent.
18. One strategic renewable source.
19. World-cycle recovery / anti-farm.
20. Known Source memory.
21. Game Kit/UI primitives.
22. Semantic rule trace.
23. Linter extensions.
24. Fixtures/property tests.
25. Telemetry.
26. Playtest gates.

Do not skip directly to large crafting trees, dozens of resources, farming, economy, or full Camp production before the vertical slice proves **habitat reading + route decision + downstream use** is fun.

---

**End of Resource Ecology & Discovery Rewards Implementation Specification v0.1**
