# HEXOFLAT — Region Grammar Generator

**Implementation Specification:** v0.1  
**Design status:** Candidate — do not promote to canonical without playtest approval  
**Parent design:** `Hexoflat_Region_Grammar_Generator_Candidate_v0.1.md`  
**Primary design contract:** Hexoflat Master Design & Implementation Guide v1.0  
**Audience:** Claude Code / Engineering / QA / Game Design

---

# 0. Implementation Mandates

1. Preserve the existing hex coordinate/pathfinding implementation where possible.
2. Do not expose region/chunk boundaries to the player.
3. Do not render ungenerated/UNKNOWN rectangular-board cells merely because they exist in an engine array.
4. Generation must be deterministic from seed + committed world state + generation version.
5. Generate a proposition graph before generating hex coordinates.
6. Preview and execution must use the same traversal/interaction rules.
7. Terrain manipulation must mutate canonical world state, not only visuals.
8. A generated critical route must be valid for the guaranteed progression state.
9. Routine resource pickup remains direct interaction; do not introduce harvesting mini-games without a meaningful design reason.
10. All decision-relevant known state must have board/UI representation.
11. Generator diagnostics may use numeric scores internally; do not expose them as RPG stats to the player.
12. Implement the six-grammar vertical slice before the extended grammar library.

---

# 1. Exact Incremental Implementation Order

## STEP 1 — Introduce Generation Versioning

Add:

```ts
type GenerationVersion = string;

interface WorldGenerationMeta {
  worldSeed: string;
  generationVersion: GenerationVersion;
}
```

Requirements:

- save file records generation version;
- region seed derivation includes generation version;
- changing generator code must not silently reinterpret already committed regions in existing saves;
- previously committed region topology is serialized or reproducibly versioned.

Acceptance:

- same save + same version produces identical frontier generation;
- changing version can intentionally produce a new world on new-game seed without mutating old committed topology.

---

## STEP 2 — Add Region Proposition Model

```ts
type RegionGrammarId =
  | 'FORKED_RIDGE'
  | 'POCKET_BASIN'
  | 'RESOURCE_LURE'
  | 'SECRET_FRACTURE'
  | 'RETURNING_LOOP'
  | 'LANDMARK_RING';

type RegionDecisionType =
  'ROUTE' | 'TOOL' | 'RISK' | 'INFORMATION' | 'RESOURCE' | 'TIMING' | 'POSITION' | 'RETURN_PATH';

type RegionNoveltyTag =
  | 'DETOUR_OR_BREAK'
  | 'COMMIT_BEFORE_PULSE'
  | 'RESOURCE_DEVIATION'
  | 'SECRET_READING'
  | 'FUTURE_SHORTCUT'
  | 'LANDMARK_APPROACH';

interface RegionProposition {
  grammarId: RegionGrammarId;
  primaryQuestionKey: string;
  decisionTypes: RegionDecisionType[];
  noveltyTags: RegionNoveltyTag[];
  minimumMeaningfulChoices: number;
  requiredCapabilities: CapabilityId[];
  optionalCapabilities: CapabilityId[];
  fallbackPolicy: RegionFallbackPolicy;
}
```

`primaryQuestionKey` is internal/localizable design metadata and is never shown as a region label to the player.

---

## STEP 3 — Add Abstract Topology Graph

Generation must create a graph before axial hex embedding.

```ts
type RegionNodeRole =
  | 'ENTRY'
  | 'TRANSIT'
  | 'FORK'
  | 'LANDMARK'
  | 'RESOURCE'
  | 'SHELTER'
  | 'OBSTRUCTION'
  | 'SECRET'
  | 'EXIT'
  | 'MERGE';

interface RegionGraphNode {
  id: string;
  role: RegionNodeRole;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

interface RegionGraphEdge {
  from: string;
  to: string;
  traversal: 'OPEN' | 'DESTRUCTIBLE' | 'CONDITIONAL' | 'SECRET';
  semanticRole?: 'MAIN' | 'DETOUR' | 'SHORTCUT' | 'RETURN' | 'OPTIONAL';
}

interface RegionTopologyGraph {
  nodes: RegionGraphNode[];
  edges: RegionGraphEdge[];
}
```

Acceptance:

- topology graph passes graph-level validation before any hex is allocated.

---

## STEP 4 — Implement Grammar Selector With Experience Memory

```ts
interface ExplorationExperienceMemory {
  recentGrammarIds: RegionGrammarId[];
  recentNoveltyTags: RegionNoveltyTag[];
  recentGeometryTags: GeometryTag[];
  recentVerbTags: InteractionVerbTag[];
  recentMotiveTags: RewardMotiveTag[];
  recentLandmarkTags: LandmarkSemanticTag[];
}
```

Initial history windows are tunable internal parameters.

Candidate defaults for vertical slice:

- grammar memory: last 4 committed regions;
- proposition/novelty memory: last 5;
- geometry memory: last 4;
- dominant verb memory: last 3;
- motive memory: last 4.

Selection algorithm:

1. list grammars legal for current progression/biome;
2. remove impossible grammars;
3. apply strong penalty to recent primary novelty tags;
4. apply moderate penalty to repeated geometry/verb/motive;
5. add context bonus for current expedition needs/signals;
6. weighted deterministic pick using region seed;
7. generate;
8. lint;
9. reroll with deterministic attempt index if rejected.

Do not guarantee maximal novelty. Familiar grammar should occasionally return in a new system context.

---

## STEP 5 — Implement Six Vertical-Slice Graph Builders

### 5.1 FORKED_RIDGE

Required graph:

```text
ENTRY -> FORK -> DETOUR -> MERGE -> EXIT
          \
           -> OBSTRUCTION(DESTRUCTIBLE) -> SHORTCUT -> MERGE
```

Validation:

- DETOUR is always open;
- shortcut benefit is meaningful;
- obstruction is Stone Crust for v0.1;
- removing obstruction never disconnects world state;
- shortcut can produce a future route consequence hook.

### 5.2 POCKET_BASIN

```text
ENTRY -> NECK -> BASIN_CENTER -> EXIT_A
                       \
                        -> EXIT_B
```

Required:

- basin has greater local width than neck;
- one resource/discovery signal exists beyond neck;
- at least one candidate Gather-Will endpoint has different exposure from another.

### 5.3 RESOURCE_LURE

```text
ENTRY -> MAIN_ROUTE -> EXIT
             \
              -> RESOURCE_BRANCH -> REJOIN(optional)
```

Required:

- resource branch is optional;
- resource purpose exists;
- branch adds route/time/exposure opportunity cost;
- no repeated pickup spam.

### 5.4 SECRET_FRACTURE

```text
ENTRY -> NORMAL_ROUTE -> EXIT
             \
              -> SECRET_CLUE -> SECRET_FRACTURE -> SECRET_PAYOFF
```

Required:

- main progression remains available without secret;
- clue can be observed before direct tool interaction;
- secret payoff cannot be mandatory campaign continuation in v0.1.

### 5.5 RETURNING_LOOP

```text
ENTRY -> OUTBOUND -> EXIT/FRONTIER
            \
             -> RETURN_GATE -> KNOWN_WORLD_SOCKET
```

Required:

- known world socket is real and compatible;
- opening loop materially shortens later return navigation;
- return gate state persists.

### 5.6 LANDMARK_RING

```text
          APPROACH_A
         /          \
ENTRY --             LANDMARK -- EXIT_A
         \          /
          APPROACH_B
                       \-> EXIT_B(optional)
```

Required:

- landmark occupies/references a stable world entity;
- landmark can be signaled while OBSERVED where visibility rules permit;
- at least two approach geometries differ.

---

## STEP 6 — Hex Embedding Service

```ts
interface HexRegionEmbedder {
  embed(input: HexRegionEmbeddingInput): HexRegionEmbeddingResult;
}

interface HexRegionEmbeddingInput {
  seed: string;
  entrySocket: FrontierSocket;
  topology: RegionTopologyGraph;
  occupiedCoords: Set<string>;
  biomeContext: BiomeContext;
  minHexCount: number;
  maxHexCount: number;
}
```

Algorithm outline:

1. orient entry edge away from occupied known mass where possible;
2. assign coarse direction vectors to graph edges;
3. convert graph edges into hex corridors/arcs;
4. inflate selected nodes into pockets/chambers;
5. carve hard terrain boundaries around traversable footprint;
6. add small shape noise within allowed envelopes;
7. validate path semantics against graph roles;
8. reject collisions with committed incompatible topology;
9. expose frontier sockets at designated exit nodes.

Important:

- random noise may perturb shape but cannot destroy the proposition;
- do not generate all open hexes first and infer topology afterward.

---

## STEP 7 — Terrain Semantic Assignment

Minimum v0.1 terrain/traversal states:

```ts
type TraversalState = 'OPEN' | 'BLOCKED' | 'DESTRUCTIBLE';

type TerrainSemantic = 'GROUND' | 'STONE_MASS' | 'STONE_CRUST' | 'FRACTURED_STONE' | 'SHELTER';
```

Rules:

- `STONE_MASS` = BLOCKED, no base Pickaxe traversal;
- `STONE_CRUST` = DESTRUCTIBLE, Pickaxe-valid;
- `FRACTURED_STONE` = signal/knowledge state that may map to destructible secret;
- `SHELTER` affects World Pulse proposition only when that system is active.

Do not add terrain movement-cost numbers to player-facing UI.

---

## STEP 8 — Frontier Signal System

```ts
type FrontierSignalClass = 'STRUCTURE' | 'ECOLOGY' | 'THREAT' | 'PASSAGE' | 'MYSTERY';

interface FrontierSignalState {
  id: string;
  signalClass: FrontierSignalClass;
  sourceEntityId?: string;
  sourceHex?: HexCoord;
  revealedMeaning: 'UNKNOWN' | 'CLASSIFIED' | 'IDENTIFIED';
  visibleFrom: HexCoord[];
}
```

Rules:

- prefer environment/world-object rendering over floating UI markers;
- Scout may change `revealedMeaning` but does not magically reveal hidden content;
- signal visibility must use the same world visibility rules used by actual discovery.

Acceptance:

- a signal can motivate a route before the underlying payoff is Discovered.

---

## STEP 9 — Resource Habitat Contracts

```ts
type ResourceInteractionMode = 'ROUTINE_TAKE' | 'STRATEGIC_HARVEST';

type ResourceHabitatType =
  'SAFE_TEACHING' | 'ROUTE_DEVIATION' | 'THREAT_ADJACENT' | 'TERRAIN_GATED' | 'KNOWLEDGE_GATED';

interface ResourceDefinition {
  id: ResourceId;
  interactionMode: ResourceInteractionMode;
  habitatTags: string[];
  sourceStateTransitions?: ResourceSourceTransition[];
  systemUses: SystemUseId[];
  recognitionClues: string[];
}

interface ResourceHabitatPlacement {
  resourceId: ResourceId;
  habitatType: ResourceHabitatType;
  coords: HexCoord[];
  clueEntityIds: string[];
  propositionRole: 'PRIMARY' | 'SECONDARY';
}
```

Rules:

- resource placement requires at least one `systemUses` entry;
- Resource Lure grammar must not place a resource with no current/future utility;
- a habitat cluster should teach a reusable world cue;
- routine Take uses existing Hand Tool interaction grammar.

---

## STEP 10 — Persistent Topology Mutation

Existing Pickaxe/terrain action should emit canonical domain events.

```ts
interface TerrainTransformedEvent {
  type: 'TERRAIN_TRANSFORMED';
  hex: HexCoord;
  from: TerrainSemantic;
  to: TerrainSemantic;
  cause: InteractionCause;
  actorId: EntityId;
}
```

Stone Crust transition:

`STONE_CRUST / DESTRUCTIBLE -> BROKEN_PASSAGE / OPEN`

If `BROKEN_PASSAGE` is not already a terrain semantic, add it.

After transformation:

1. update traversal state;
2. invalidate/recompute affected pathfinding cache;
3. refresh route preview;
4. update region persistent consequence state;
5. allow NPC/companion pathfinding to use the passage if their rules permit;
6. serialize mutation.

Semantic trace example:

`Pickaxe → Stone Crust breaks → blocked edge opens → route graph changes`

---

## STEP 11 — Integrate Gather Will / World Pulse Hooks

Region grammar can tag specific hex groups:

```ts
type WorldPulseExposure = 'SHELTERED' | 'EXPOSED' | 'NEUTRAL';

interface RegionPulseHook {
  coords: HexCoord[];
  exposure: WorldPulseExposure;
  behaviorHookIds: string[];
}
```

Vertical slice World Pulse behavior should remain minimal.

Recommended first behavior:

- one patrol/known threat advances one behavior step;

or, if enemies are not ready:

- one clearly represented environmental state changes.

Do not implement multiple unrelated Pulse subsystems before the positional decision is proven fun.

---

## STEP 12 — Scout Hooks

Reuse existing movement range parameter internally.

Add capability flags:

```ts
type ScoutCapability = 'WAYPOINT' | 'AWARENESS_INTERRUPT' | 'TRAIL_SENSE' | 'FRONTIER_READING';
```

### WAYPOINT

Allows one forced intermediate route coordinate if legal.

### AWARENESS_INTERRUPT

On `SignificantRevealEvent` during movement:

- pause route;
- preserve remaining movement budget;
- expose `CONTINUE | STOP | ACT`.

### TRAIL_SENSE

Route preview may display **known** terrain consequences.

### FRONTIER_READING

Can classify a visible signal class without revealing exact hidden payoff.

---

## STEP 13 — Discovery-State Integration

Use parent system state machine:

`UNKNOWN → OBSERVED → DISCOVERED → UNDERSTOOD`

Region-specific rules:

- region boundaries never change discovery state themselves;
- signals can be OBSERVED independently of payoff content;
- a Landmark may become OBSERVED before its approach hexes are DISCOVERED;
- secret content can remain UNKNOWN even inside a broadly UNDERSTOOD area if the clue was never interpreted, but known decision-relevant effects cannot stay engine-only.

Avoid “reveal every cell” completion requirements.

---

## STEP 14 — Known Route Foundation

When Returning Loop or later mastery creates a known connection:

```ts
interface KnownRouteEdge {
  id: string;
  fromAnchorId: EntityId;
  toAnchorId: EntityId;
  path: HexCoord[];
  status: 'KNOWN' | 'MASTERED';
  createdBy: 'DISCOVERY' | 'TERRAIN_TRANSFORMATION' | 'AUTHORED';
}
```

v0.1 may only record the edge and show route affordance.

Fast travel / Route Pattern execution remains deferred until parent World Travel design is finalized.

---

# 2. Generator Algorithms

## 2.1 Deterministic Region Seed

```text
regionSeed = hash(
  worldSeed,
  generationVersion,
  entrySocket.q,
  entrySocket.r,
  entrySocket.direction,
  committedRegionCount
)
```

Each rejected generation attempt derives:

`attemptSeed = hash(regionSeed, attemptIndex)`

Do not call global unseeded random APIs inside generation.

---

## 2.2 Grammar Selection Pseudocode

```ts
function selectGrammar(ctx: GeneratorContext): RegionGrammarId {
  const candidates = allGrammars
    .filter((g) => isUnlocked(g, ctx.progression))
    .filter((g) => isCompatibleWithBiome(g, ctx.biome))
    .filter((g) => hasRequiredFallback(g, ctx));

  const weighted = candidates.map((g) => ({
    grammar: g,
    weight:
      baseWeight(g) *
      noveltyMultiplier(g, ctx.memory) *
      geometryMultiplier(g, ctx.memory) *
      verbMultiplier(g, ctx.memory) *
      motiveMultiplier(g, ctx.memory) *
      contextMultiplier(g, ctx),
  }));

  return seededWeightedPick(weighted, ctx.seed);
}
```

No multiplier may become zero solely because a grammar was recently seen; repetition should be suppressed, not made impossible forever.

---

## 2.3 Meaningful Branch Validation

For each claimed choice branch, calculate internal route outcomes:

```ts
interface BranchOutcomeVector {
  traversable: boolean;
  pathHexes: number;
  requiresTool: boolean;
  consumesPersistentSource?: boolean;
  exposureHooks: number;
  resourceOpportunities: number;
  discoveryOpportunities: number;
  createsPersistentConnection: boolean;
}
```

A fork is meaningful if at least one non-cosmetic dimension differs between viable branches.

Reject:

- equal paths with same consequences;
- shortcut longer than detour unless it has a separate benefit;
- tool branch that is always strictly better without tradeoff across repeated use.

Do not expose this vector to the player.

---

## 2.4 Recent Similarity Score

Internal only.

```text
similarity =
  propositionWeight * propositionMatch
+ geometryWeight * geometryMatch
+ verbWeight * verbMatch
+ motiveWeight * motiveMatch
+ landmarkWeight * landmarkMatch
```

Candidate linter thresholds should initially be generous and tuned from generated-sample review.

Do not optimize toward maximum mathematical dissimilarity; coherent biome identity still matters.

---

## 2.5 Region Embedding

Recommended method for current hex game:

1. graph node positions in coarse 2D local coordinates;
2. snap to axial coordinates;
3. connect nodes using existing hex path primitives on a temporary empty local grid;
4. inflate pockets using controlled rings/flood fill;
5. add hard terrain shell;
6. insert graph-required obstruction/gate hexes;
7. validate pathfinding;
8. translate local coords to world coords at frontier socket;
9. test collision;
10. retry orientation/seed if invalid.

Do not use unrestricted cellular automata/noise as the primary topology generator for v0.1.

Noise may decorate the shell only after gameplay paths exist.

---

# 3. Procedural Parameters — Candidate Defaults

All values are internal tuning parameters.

```ts
interface RegionGenerationTuning {
  minOpenHexes: number; // candidate 9
  maxOpenHexes: number; // candidate 26
  minFrontierExits: number; // candidate 1
  maxFrontierExits: number; // candidate 4
  maxGenerationAttempts: number; // candidate 12
  maxTrivialInteractionDensity: number;
  recentGrammarWindow: number;
  recentPropositionWindow: number;
  recentGeometryWindow: number;
  recentVerbWindow: number;
  recentMotiveWindow: number;
}
```

These are not player-facing and may change freely during playtesting.

---

# 4. Resource Ecology Algorithm

## 4.1 Placement Preconditions

Before placing a resource:

1. resource is unlocked/valid for world context;
2. at least one consuming/use system exists now or is intentionally being teased;
3. region habitat tags are compatible;
4. recent resource repetition is acceptable;
5. resource does not overcrowd the route;
6. placement supports proposition rather than merely filling empty space.

## 4.2 Habitat Placement

Prefer clusters/patterns over independent random tiles.

Example medicinal plant habitat:

```text
habitat clue: damp shaded ground / specific vegetation state
resource nodes: 1–3 clustered within/near clue geometry
```

Once the player understands the habitat, later Scout/knowledge rules may surface the clue earlier.

## 4.3 Anti-Grind Telemetry

Record:

- number of repeated pickups of same resource between meaningful uses;
- distance traveled solely for maintenance resource;
- frequency player ignores visible resource;
- percentage of resource nodes collected;
- time from need creation to sufficient source discovery;
- known-habitat revisit count.

High ignored-resource rate may indicate clutter/oversupply.
High repeated-maintenance travel may indicate grind.

---

# 5. Generator Linter

Implement a headless linter callable in tests and developer tooling.

```ts
interface RegionLintResult {
  valid: boolean;
  errors: RegionLintIssue[];
  warnings: RegionLintIssue[];
  diagnostics: RegionDiagnostics;
}
```

## Hard Errors

- duplicate coordinates;
- no legal entry continuation;
- mandatory exit unreachable for guaranteed player state;
- critical route requires unavailable tool with no fallback;
- committed-world collision;
- secret is only route to critical continuation;
- interaction target has no legal adjacent Hero hex;
- Returning Loop points to invalid known-world socket;
- resource required for proposition but source placement failed;
- player can spawn inside blocked/destructible terrain.

## Warnings / Reject-by-policy Candidate

- no meaningful branch difference;
- same dominant proposition repeated too recently;
- same geometry repeated too recently;
- too many repeated tool interactions;
- excessive dead ends;
- landmark not observable from intended signal zone;
- shortcut benefit negligible;
- Resource Lure branch has irrelevant resource;
- secret clue too close to payoff to create observation;
- route decision visually unreadable at target zoom.

---

# 6. Automated Agent Profiles

For generation validation, simulate at least these capability profiles:

## PROFILE_A — Starter

- current base Scout range;
- no waypoint;
- no advanced signal classification;
- Pickaxe availability according to fixture.

## PROFILE_B — Scout Waypoint

- waypoint enabled;
- same tools as fixture.

## PROFILE_C — No Pickaxe

Used to verify that non-critical Stone Crust propositions retain fallback routes.

## PROFILE_D — Pickaxe

Used to verify that destructible shortcuts actually create different route outcomes.

Agents do not need combat intelligence in v0.1; path/legal-interaction validation is enough.

---

# 7. UI Contracts

## 7.1 Unknown Board

- do not render outer rectangular bounds;
- do not show disabled unknown hex grid;
- show only discovered/observed world and fog frontier treatment.

## 7.2 Region Boundary

Never rendered.

## 7.3 Route Preview

Reuse existing route trail and final total-distance number.

Add only contextual indicators required by unlocked Scout capabilities:

- known terrain consequence marker;
- waypoint;
- significant frontier signal cue;
- tool-valid shortcut hint.

Do not turn route preview into a panel full of numbers.

## 7.4 Frontier Signals

Preferred order of representation:

1. world art/object silhouette;
2. animation/audio/environment effect;
3. minimal marker only if needed;
4. contextual hint on hover/tap;
5. full explanation on demand.

## 7.5 Terrain Transformation

On Pickaxe interaction:

- tool overlays/targets Stone Crust using existing interaction grammar;
- allowed action appears;
- action resolves;
- Stone Crust visibly changes to Broken Passage;
- route preview updates immediately.

---

# 8. Game Kit Contracts

No Region/Chunk token is permitted.

## Reused

- Hero Token;
- Camp Token/World Anchor;
- Hex Tile;
- Fog/Discovery representation;
- Pickaxe Tool Token;
- Hand Tool Token;
- Interaction Marker;
- Waypoint Pin;
- Will Sigil;
- Resource Tokens.

## Candidate Signal Representation

**Object:** Frontier Signal  
**Represents:** partial knowledge about nearby unknown world  
**Player Verb:** observe / approach / inspect where applicable  
**States:** Unknown → perceived → classified → resolved  
**Source:** visibility/discovery rules  
**Sink:** resolved when source is discovered/understood  
**Reusable:** global exploration primitive  
**UI Form:** preferably environment/world effect; marker fallback  
**UI Explanation:** context hint, then detail

## Broken Passage State

**Object:** transformed terrain hex  
**Represents:** permanent topology change  
**Player Verb:** traverse  
**States:** Stone Crust → Broken Passage  
**Source:** Pickaxe/approved interaction  
**Sink:** persistent unless explicit future system changes it  
**Reusable:** global terrain primitive  
**UI Form:** altered hex/terrain art  
**UI Explanation:** semantic trace on demand

---

# 9. Save / Load Contracts

Persist:

- world seed;
- generation version;
- committed region IDs/metadata;
- committed hex topology or deterministic reconstruction keys;
- discovery state per hex/entity;
- transformed terrain state;
- discovered signals and their resolution state;
- resource source state;
- known route edges;
- exploration experience memory sufficient to preserve generation sequence behavior.

Important:

If anti-repetition memory affects future generation, it is gameplay-relevant world state and must survive save/load.

---

# 10. Testing Fixtures

## Fixture 1 — Forked Ridge With Pickaxe

Expected:

- detour legal;
- shortcut legal after Pickaxe;
- shortcut route preview changes after break;
- topology mutation persists after save/load.

## Fixture 2 — Forked Ridge Without Pickaxe

Expected:

- detour remains legal;
- Stone Crust advertises blocked/tool state without trapping player;
- critical exit reachable.

## Fixture 3 — Pocket Basin World Pulse

Expected:

- at least two valid Burst endpoint qualities exist;
- Pulse hook changes known state/behavior;
- player can understand why one endpoint differs.

## Fixture 4 — Resource Lure

Expected:

- main route remains valid;
- resource branch is optional;
- resource has valid system use;
- route deviation is measurable internally.

## Fixture 5 — Secret Fracture

Expected:

- secret clue can become OBSERVED;
- main route does not require secret;
- Pickaxe interaction on clue/stone obeys rules;
- secret payoff remains hidden until correct discovery.

## Fixture 6 — Returning Loop

Expected:

- connection points to existing known-world socket;
- opening route creates persistent known connection;
- future pathfinding can use connection.

## Fixture 7 — Landmark Ring

Expected:

- landmark signal visible from intended observed zone;
- approaches are topologically distinct;
- no region boundary visible.

## Fixture 8 — Same Seed Determinism

Generate the same frontier twice from identical world snapshot.

Expected byte-equivalent normalized region output.

## Fixture 9 — Anti-Repetition

Generate 20 sequential regions in simulation.

Expected:

- no excessive run of same dominant novelty tag;
- geometry/motive variety above configured warning thresholds;
- all regions valid.

## Fixture 10 — Save/Load Generation Continuity

Generate N regions, save, reload, generate next region.

Expected next region equals uninterrupted-run next region.

---

# 11. Invariants

1. Region boundaries are never player-visible.
2. UNKNOWN engine cells never expose rectangular board shape.
3. Every committed critical continuation is reachable for guaranteed progression state.
4. No routine resource pickup becomes a mandatory mini-game.
5. Stone Mass cannot be bypassed by base Pickaxe.
6. Stone Crust transformation immediately changes traversal/pathfinding truth.
7. Persistent terrain mutations survive save/load.
8. Secrets are optional in v0.1.
9. A claimed route choice must differ in at least one meaningful consequence dimension.
10. Generator randomness is deterministic.
11. Scout reveals only information justified by capability/state.
12. Known decision-relevant state is represented.
13. Authored content constraints override procedural convenience.
14. Anti-repetition memory cannot create hard-lock generation failure; fallback grammar must exist.
15. Generation failure must never leave partially committed topology.

---

# 12. Acceptance Criteria — Vertical Slice

The Region Grammar vertical slice is complete only if:

- six starter grammars are generated deterministically;
- each produces multiple geometric variants while preserving its gameplay question;
- rectangular board limits are invisible in normal play;
- Camp-adjacent frontier can grow in irregular form;
- Pickaxe creates a persistent Broken Passage;
- pathfinding uses the new passage immediately;
- Resource Lure uses a real resource with downstream system use;
- at least one resource habitat cue is learnable/reusable;
- Secret Fracture rewards observation and is non-mandatory;
- Returning Loop can reconnect frontier to known territory;
- Landmark Ring produces a readable orientation landmark;
- Gather Will/World Pulse affects at least one region proposition;
- Scout Waypoint and Awareness can change how a generated proposition is approached;
- linter rejects deliberately malformed/trivial fixtures;
- save/load reproduces committed world and future deterministic sequence;
- 100+ generated-region headless test set contains no unreachable critical region;
- 20+ region human playtest shows no immediate dominant “always shortest / always break” strategy.

---

# 13. Telemetry for Playtest

Record internally:

- grammar encountered;
- branch selected;
- branch abandoned;
- tool used / not used;
- route length committed;
- route interruptions;
- Gather Will location type;
- signals approached/ignored;
- optional secrets discovered;
- resource branches entered/ignored;
- topology transformations;
- later reuse of player-created shortcuts;
- known-route reuse;
- time spent in mastered territory;
- repeated proposition streaks;
- region generation reject/reroll causes.

Do **not** infer “fun” from these metrics alone. Pair with player interview prompts:

- “What made you choose that route?”
- “What did you expect was behind that signal?”
- “Which part of the map do you remember and why?”
- “Did you feel you changed the world?”
- “Did any resource feel like work?”
- “Did two recent areas feel mechanically the same?”

---

# 14. Generator Developer Tooling

Recommended debug overlay, development-only:

- region grammar ID;
- proposition graph;
- embedded graph nodes;
- frontier sockets;
- discovery states;
- hard/deconstructible terrain;
- signal visibility zones;
- resource habitat bounds;
- branch outcome vectors;
- linter diagnostics;
- recent-memory penalties;
- generation attempt number/seed.

Must never ship in normal player UI.

Add batch command/script:

```text
generate-regions --seed-set <set> --count <N> --lint --export-summary
```

Output machine-readable diagnostics for balance/linter analysis.

---

# 15. Extended Grammar Backlog — Do Not Implement Yet

After vertical-slice validation, consider adding in this order:

1. `SHELTER_CHAIN`;
2. `PATROL_FUNNEL`;
3. `TOOL_OPPORTUNITY`;
4. `RESOURCE_HABITAT`;
5. `RUIN_PERIMETER`;
6. `CROSSROADS_WITH_COST`;
7. `FRONTIER_WINDOW`;
8. `COLLAPSED_NETWORK`;
9. `TRACE_FIELD`;
10. `THREAT_RESOURCE_INTERLOCK`;
11. `SPLIT_RAVINE` after conditional traversal;
12. `ONE_WAY_DESCENT` after one-way traversal UX exists;
13. `AUTHORED_MYSTERY_SOCKET` after authored-content socket API is stable.

Do not add more grammars to fix weak fundamentals. If the first six are not fun, fix the movement/discovery/resource proposition model first.

---

# 16. Deferred Scope

Explicitly deferred:

- full biome generator;
- rivers and hydrology;
- bridges/rope traversal;
- vertical elevation system;
- weather ecology;
- full patrol AI generation;
- combat encounter generation;
- dynamic resource regrowth;
- economy balancing;
- automated fast travel;
- multiplayer shared frontier generation;
- infinite world guarantees;
- ML-based procedural generation.

---

# 17. Promotion Gate

Do not merge this candidate into the canonical Master Guide until playtesting demonstrates:

1. generated regions create recognizable different decisions;
2. terrain manipulation does not trivialize navigation;
3. resources motivate exploration without grind;
4. players read signals without relying on UI markers;
5. Scout improves mastery rather than only speed;
6. World Pulse makes ending position matter;
7. remembered landmarks/shortcuts prevent procedural disorientation;
8. known-space travel is less frictional than first exploration;
9. procedural variations create memorable system interactions;
10. engineering can reliably generate/validate/save regions without manual repair.

---

**End of Region Grammar Generator Implementation Spec v0.1**
