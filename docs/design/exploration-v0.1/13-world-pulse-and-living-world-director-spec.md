# HEXOFLAT — World Pulse & Living World Director

**Implementation Specification:** v0.1  
**Design status:** Candidate — do not promote to canonical without explicit approval/playtest  
**Parent design:** `Hexoflat_World_Pulse_and_Living_World_Director_Candidate_v0.1.md`  
**Primary design contract:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Related candidates:** Frontier Exploration, Region Grammar Generator, Resource Ecology & Discovery Rewards  
**Audience:** Claude Code / Engineering / QA / Game Design

---

# 0. Implementation Mandates

1. Reuse current hex coordinates, pathfinding, Hero movement, blocked-hex and interaction primitives.
2. Do not implement a global full-fidelity ecosystem in v0.1.
3. World Pulse must be deterministic from canonical state + seed/config.
4. Gather Will is the only default manual Pulse trigger in v0.1.
5. World Cycle is separate from World Pulse.
6. Resource regeneration must not occur because the player repeatedly Gathers Will.
7. Local behavior and remote coarse simulation must share the same actor identity/state.
8. Do not spawn/materialize actors without a legal world connection.
9. Visible intent preview and final execution must call the same behavior rules.
10. Hidden actors remain hidden until visibility/perception rules reveal them.
11. Known Noise and other decision-relevant signals live in canonical game state, not UI-only state.
12. The Living World Director can prioritize eligible responses but cannot invent rules/events to increase difficulty.
13. Every meaningful response emits semantic Rule Trace events.
14. Pulse resolution must support immediate interruption into Combat state.
15. Animation/presentation is downstream from canonical state resolution.
16. Response Budget defaults must be data-driven.
17. Start with one threat archetype (`PATROL`) and two world signals (`NOISE`, `DISTURBANCE`).
18. Do not add scent, weather simulation, ecosystem predation, factions or global event scheduling in v0.1.

---

# 1. Exact Incremental Implementation Order

## STEP 1 — Add Will State to Hero Exploration State

```ts
type WillState = 'GATHERED' | 'COMMITTED' | 'DISPERSED' | 'GATHERING';

interface HeroExplorationState {
  heroId: EntityId;
  willState: WillState;
  currentBurst?: MovementBurstState;
  lastPulseId?: WorldPulseId;
}
```

Initial candidate rule:

- entering World Exploration from Camp initializes `willState = 'GATHERED'`;
- starting a movement burst transitions `GATHERED -> COMMITTED`;
- ending/committing the burst transitions `COMMITTED -> DISPERSED`;
- Gather Will transitions `DISPERSED -> GATHERING -> GATHERED` after Pulse resolves.

Do not implement a numeric Will pool.

Acceptance:

- save/load preserves state;
- invalid transitions are rejected;
- combat controller can snapshot/restore exploration Will state without duplicating logic.

---

## STEP 2 — Introduce World Pulse Identity and State

```ts
type WorldPulseId = string;
type WorldCycleId = string;

interface WorldPulseRecord {
  id: WorldPulseId;
  ordinal: number;
  cause: WorldPulseCause;
  heroCoordAtCommit: HexCoord;
  seed: number;
  startedAtStateVersion: number;
  completedAtStateVersion?: number;
}

type WorldPulseCause = 'GATHER_WILL' | 'AUTHORED_SYSTEM_EVENT';
```

v0.1 runtime must only expose `GATHER_WILL` to normal gameplay.

`AUTHORED_SYSTEM_EVENT` exists for test harness/future content but should be disabled unless explicitly configured.

---

## STEP 3 — Add Gather Will Command

```ts
interface GatherWillCommand {
  type: 'GATHER_WILL';
  commandId: string;
  heroId: EntityId;
  expectedStateVersion: number;
}
```

Validation:

- correct controller owns Hero;
- game mode is World Exploration;
- Hero Will is `DISPERSED`;
- no unresolved movement/interaction command;
- Hero is not currently detected/in Combat transition;
- no authored local rule forbids Gather Will.

Command flow:

```text
Validate
-> set Will GATHERING
-> create WorldPulseRecord
-> resolve Pulse
-> if Combat started: preserve transition state
-> otherwise set Will GATHERED
-> emit GatherWillCompleted
```

Idempotency:

- duplicate `commandId` must return prior result without resolving a second Pulse.

---

## STEP 4 — Add World Signal Contracts

```ts
type WorldSignalId = string;

type WorldSignalType = 'NOISE' | 'DISTURBANCE';

type NoiseBand = 'LOCAL' | 'CARRYING' | 'ECHOING';

interface WorldSignalEntity {
  id: WorldSignalId;
  type: WorldSignalType;
  sourceEntityId?: EntityId;
  sourceCoord: HexCoord;
  createdPulseOrdinal: number;
  state: WorldSignalState;
  visibility: SignalVisibility;
  payload: NoiseSignalPayload | DisturbanceSignalPayload;
}

type WorldSignalState = 'ACTIVE' | 'FADING' | 'RESOLVED';

type SignalVisibility = 'KNOWN_TO_PLAYER' | 'HIDDEN';

interface NoiseSignalPayload {
  type: 'NOISE';
  band: NoiseBand;
  propagationRuleId: SignalPropagationRuleId;
  remainingPulseLifetime: number;
}

interface DisturbanceSignalPayload {
  type: 'DISTURBANCE';
  disturbanceKind: DisturbanceKind;
  linkedWorldStateId: EntityId;
  persistent: boolean;
}
```

Disturbance may be represented implicitly by changed terrain in UI, but it remains canonical state if behavior rules need to query it.

---

## STEP 5 — Implement Noise Creation from Existing Terrain Transformation

Extend the Stone Crust break command/event pipeline.

On configured transformation:

```ts
interface NoiseCreatedEvent {
  type: 'NOISE_CREATED';
  signalId: WorldSignalId;
  sourceCoord: HexCoord;
  band: NoiseBand;
  causeEntityId?: EntityId;
}
```

Starter config:

```ts
interface TerrainTransformationWorldEffects {
  transformationId: TerrainTransformationId;
  noiseBand?: NoiseBand;
  createsDisturbance?: boolean;
  disturbanceKind?: DisturbanceKind;
}
```

For `STONE_CRUST -> BROKEN_PASSAGE`:

- create `CARRYING` Noise;
- create persistent `BROKEN_PASSAGE` Disturbance reference;
- invalidate pathfinding immediately;
- emit semantic trace before any subsequent movement preview.

No randomized Noise band in v0.1.

---

## STEP 6 — Add Signal Propagation Rules

Internal engine may use hex distance and topology.

```ts
interface SignalPropagationRule {
  id: SignalPropagationRuleId;
  maxHexDistanceByBand: Record<NoiseBand, number>;
  blockedByTerrainTags: TerrainTag[];
  attenuatedByTerrainTags: TerrainTag[];
  canCrossUnknownGeneratedTopology: boolean;
}
```

v0.1 recommended behavior:

- Noise only propagates through generated/valid topology;
- blocked rock mass can stop or attenuate according to config;
- exact player-facing radius need not be permanently displayed;
- preview can draw an overlay of currently known reachable Noise area.

Use one canonical `computeSignalReach(signal, state)` function for:

- threat perception;
- player preview;
- tests;
- Rule Trace.

---

## STEP 7 — Add Exploration Threat Actor Contract

```ts
type ExplorationThreatId = string;

type ExplorationThreatArchetype = 'PATROL';

type ThreatBehaviorState = 'PATROLLING' | 'INVESTIGATING' | 'WATCHING' | 'RETURNING' | 'IDLE';

interface ExplorationThreatEntity {
  id: ExplorationThreatId;
  archetype: ExplorationThreatArchetype;
  simulationMode: ThreatSimulationMode;
  detailedState?: DetailedThreatState;
  coarseState?: CoarseThreatState;
  behaviorState: ThreatBehaviorState;
  perceptionRuleId: ThreatPerceptionRuleId;
  behaviorDefinitionId: ThreatBehaviorDefinitionId;
  discoveryState: DiscoveryState;
}

type ThreatSimulationMode = 'DETAILED' | 'COARSE';
```

Do not duplicate the actual combat character/class entity if the existing architecture already has a shared actor entity. Prefer a world/exploration component attached to the same canonical entity.

---

## STEP 8 — Implement Patrol Detailed State

```ts
interface DetailedThreatState {
  coord: HexCoord;
  facingOrWatchArc?: DirectionalState; // only if existing visibility logic uses it
  patrolRouteId?: PatrolRouteId;
  patrolNodeIndex?: number;
  currentGoal?: ThreatGoal;
  perceivedSignalIds: WorldSignalId[];
}

interface PatrolRoute {
  id: PatrolRouteId;
  nodeCoords: HexCoord[];
  loopMode: 'LOOP' | 'PING_PONG';
}
```

Patrol route must use legal traversable hexes.

If topology mutates:

- recompute route legality;
- if current route invalid, behavior fallback handles it;
- do not silently move through old blocked state.

---

## STEP 9 — Add Threat Perception Rules

```ts
interface ThreatPerceptionRule {
  id: ThreatPerceptionRuleId;
  perceivesNoiseBands: NoiseBand[];
  maxKnownNoiseDistance?: number;
  canInspectDisturbance: boolean;
  visibilityRuleId: VisibilityRuleId;
}
```

Function:

```ts
perceiveWorld(
  threat: ExplorationThreatEntity,
  state: GameState
): ThreatPerceptionSnapshot
```

Must return only information legal for the threat.

The player’s Scout preview must **not** call this function with hidden-actor exposure. It may query known route/signal intersections separately.

---

## STEP 10 — Add Threat Behavior Definition and Candidate Generation

```ts
interface ThreatBehaviorDefinition {
  id: ThreatBehaviorDefinitionId;
  archetype: ExplorationThreatArchetype;
  priorities: ThreatBehaviorPriority[];
  fallbackPolicyId: ThreatFallbackPolicyId;
}

type ThreatBehaviorPriority =
  | 'DETECT_HERO_IF_VISIBLE'
  | 'INVESTIGATE_RELEVANT_NOISE'
  | 'INSPECT_ENCOUNTERED_DISTURBANCE'
  | 'CONTINUE_PATROL'
  | 'RETURN_TO_ROUTE'
  | 'HOLD_POSITION';
```

Candidate function:

```ts
buildThreatResponseCandidates(
  threat: ExplorationThreatEntity,
  pulseContext: WorldPulseContext
): WorldResponseCandidate[]
```

Candidate generation must not mutate state.

---

## STEP 11 — Define World Response Candidate

```ts
type WorldResponseType =
  | 'THREAT_MOVE'
  | 'THREAT_CHANGE_GOAL'
  | 'SIGNAL_DECAY'
  | 'TEMP_EFFECT_UPDATE'
  | 'MATERIALIZE_REMOTE_ACTOR';

interface WorldResponseCandidate {
  id: string;
  type: WorldResponseType;
  sourceEntityId?: EntityId;
  causeIds: string[];
  targetCoord?: HexCoord;
  proposedEvents: DomainEvent[];
  scoreFeatures: WorldResponseScoreFeatures;
  deterministicTieBreaker: number;
  meaningfulForBudget: boolean;
}

interface WorldResponseScoreFeatures {
  causalStrength: number;
  heroProximity: number;
  routeRelevance: number;
  tacticalRelevance: number;
  novelty: number;
  readability: number;
  propositionProgress: number;
}
```

These numbers are **internal director ranking values**, not player-facing combat stats.

---

## STEP 12 — Implement Response Scoring

Use parameterized weighted scoring, not hard-coded branching.

Starter formula:

```text
score =
  wCause * causalStrength
+ wProximity * heroProximity
+ wRoute * routeRelevance
+ wTactical * tacticalRelevance
+ wNovelty * novelty
+ wReadability * readability
+ wProposition * propositionProgress
```

Starter normalized feature range:

```text
0.0 .. 1.0
```

All weights must live in config:

```ts
interface WorldResponseScoreWeights {
  causalStrength: number;
  heroProximity: number;
  routeRelevance: number;
  tacticalRelevance: number;
  novelty: number;
  readability: number;
  propositionProgress: number;
}
```

Do not use player level/difficulty to secretly alter behavior identity in v0.1.

---

## STEP 13 — Implement Response Budget

```ts
interface WorldPulseBudgetConfig {
  maxMeaningfulLocalResponses: number;
  maxDetailedThreatMoves: number;
  allowTrivialParallelUpdates: boolean;
}
```

Starter test defaults:

```ts
{
  maxMeaningfulLocalResponses: 2,
  maxDetailedThreatMoves: 2,
  allowTrivialParallelUpdates: true,
}
```

Selection algorithm:

1. sort by score descending;
2. deterministic tie-break by candidate tie-breaker;
3. enforce actor mutual exclusion — one actor cannot execute incompatible responses;
4. enforce causal dependency order;
5. select until budget reached;
6. allow mandatory housekeeping responses such as signal decay outside meaningful budget if they do not require player attention.

Do not drop a threat’s **basic legal patrol progress** forever simply because another response wins presentation priority. If needed, move that actor in coarse/housekeeping rules or defer according to behavior design. The budget is primarily about meaningful local consequences/presentation, not freezing the world arbitrarily.

---

## STEP 14 — Implement Patrol Behavior v0.1

Starter behavior hierarchy:

```text
if Hero is visible under canonical detection rules:
    emit DETECTION / combat transition candidate
else if relevant active Noise is perceived:
    goal = nearest/highest-priority perceived Noise source
    move one patrol exploration step toward legal investigation target
else if returning from prior investigation:
    move toward nearest legal patrol route node
else:
    advance one patrol node/step according to route definition
```

Important:

- exact step length should reuse existing actor movement rules/config;
- v0.1 can use one hex per Pulse for readability, but keep it parameterized;
- no hidden random “chance to investigate” in first slice;
- if two Noise signals are legal, deterministic priority uses recency + band + path relevance + tie-break seed.

---

## STEP 15 — Add Behavior Intent Query

```ts
interface ThreatIntentPreview {
  threatId: ExplorationThreatId;
  intentType: ThreatIntentType;
  knownTargetCoord?: HexCoord;
  knownPath?: HexCoord[];
  explanationKey: string;
  sourceSignalId?: WorldSignalId;
}

type ThreatIntentType =
  'CONTINUE_PATROL' | 'INVESTIGATE_NOISE' | 'RETURN_TO_ROUTE' | 'WATCH' | 'UNKNOWN';
```

Function:

```ts
getKnownThreatIntentPreview(
  threatId: ExplorationThreatId,
  viewerHeroId: EntityId,
  state: GameState
): ThreatIntentPreview | null
```

Rules:

- only returns preview if viewer knowledge/perception allows it;
- must call the same behavior-goal resolver used by Pulse execution;
- preview may omit exact target/path based on knowledge level;
- no separate “UI prediction AI”.

---

## STEP 16 — Implement Pulse Preview Query

```ts
interface WorldPulsePreview {
  heroId: EntityId;
  gatherWillLegal: boolean;
  blockingReasonKey?: string;
  knownThreatIntents: ThreatIntentPreview[];
  knownSignalPreviews: SignalPreview[];
  knownTemporaryEffectChanges: TemporaryEffectPreview[];
}
```

No state mutation.

Use only player-known information.

UI can request preview on hover/focus/hold over Will Sigil.

---

## STEP 17 — Implement Local Active Bubble

```ts
interface ActiveBubbleConfig {
  heroRadiusHexes: number;
  includeSignalLinkedActors: boolean;
  includeObservedActors: boolean;
  includeCurrentRegionActors: boolean;
}
```

Actor is detailed if any enabled inclusion rule is true.

Do not constantly thrash detailed/coarse modes. Add hysteresis:

```ts
interface SimulationHysteresisConfig {
  enterDetailedRadius: number;
  exitDetailedRadius: number; // > enterDetailedRadius
}
```

Example test values:

```text
enter = 10
exit = 13
```

Tune through telemetry; not player-facing.

---

## STEP 18 — Add Remote Coarse State

```ts
interface CoarseThreatState {
  currentRegionId: RegionId;
  currentAnchorId: WorldAnchorId;
  goalAnchorId?: WorldAnchorId;
  connectionId?: WorldConnectionId;
  progressStep: number;
  behaviorState: ThreatBehaviorState;
}
```

World connection:

```ts
interface WorldConnection {
  id: WorldConnectionId;
  fromAnchorId: WorldAnchorId;
  toAnchorId: WorldAnchorId;
  coarseTravelSteps: number;
  allowedActorTags: string[];
}
```

Coarse Pulse rule v0.1:

- only actors with a coarse goal advance;
- one coarse step per eligible Pulse/config;
- no full pathfinding outside local topology;
- coarse conflicts resolve with deterministic rules;
- remote combat is not simulated in v0.1 unless a later system explicitly requires it.

---

## STEP 19 — Implement Deterministic Materialization

When coarse actor becomes detailed:

1. identify expected entry connection/anchor;
2. enumerate legal detailed materialization hexes;
3. filter occupied/blocked/forbidden/undiscovered-impossible hexes;
4. rank by consistency with coarse progress and path to next goal;
5. deterministic tie-break using actorId + pulse seed;
6. materialize;
7. emit trace.

Forbidden:

- Hero current hex;
- occupied character hex;
- blocked hex;
- no-spawn authored zone;
- arbitrary hidden hex disconnected from coarse route.

If none legal:

- remain coarse;
- emit deferred materialization diagnostic event;
- retry later.

---

## STEP 20 — Add World Pulse Resolver

```ts
interface WorldPulseContext {
  pulse: WorldPulseRecord;
  heroId: EntityId;
  activeBubble: ActiveBubbleSnapshot;
  signals: WorldSignalEntity[];
  rng: DeterministicRng;
  config: WorldPulseConfig;
}
```

Resolver order:

```text
A. snapshot canonical state
B. compute active bubble
C. update detailed/coarse membership
D. compute signal reach/perceptions
E. build actor response candidates
F. build signal/effect housekeeping candidates
G. score/select meaningful responses
H. validate fairness guards
I. execute selected responses in causal order
J. advance coarse actors
K. materialize newly relevant actors
L. decay/resolve signals
M. recompute visibility/discovery
N. run detection check
O. if detected -> issue CombatTransition
P. persist pulse record and rule traces
Q. Gather Will completes if still in Exploration
```

State mutation must occur only in execution stages using domain commands/events.

---

## STEP 21 — Add Fairness Guard Layer

```ts
interface PulseFairnessResult {
  allowed: boolean;
  violations: PulseFairnessViolation[];
  suggestedFallbacks: WorldResponseCandidate[];
}
```

Starter guards:

### GUARANTEE_ROUTE_SANITY

If Hero is required to Gather Will and selected responses would remove all legal continuation options with no prior readable risk, reject/replace the offending response.

### NO_CAUSELESS_MATERIALIZATION

Materialization candidate must reference a valid coarse connection/cause.

### NO_HIDDEN_RULE_MUTATION

Behavior definition/perception definition IDs may not change inside Pulse resolution due to tension/difficulty state.

### NO_RESOURCE_PULSE_FARM

No resource source transition `RECOVERING -> AVAILABLE` is permitted from Pulse alone in v0.1.

### INTENT_EXECUTION_PARITY

For observed threat with unchanged relevant world state, execution must match known intent class.

Fairness guard should reject candidate responses, not rewrite canonical rules silently.

---

## STEP 22 — Implement Detection and Combat Transition Hook

Reuse existing detection rules if available.

```ts
interface CombatTransitionEvent {
  type: 'COMBAT_TRANSITION_STARTED';
  cause: 'DETECTION';
  detectorId: EntityId;
  heroId: EntityId;
  worldPulseId?: WorldPulseId;
  snapshotId: GameStateSnapshotId;
}
```

On transition:

- freeze incompatible exploration command queue;
- preserve exact Hero coord;
- preserve threat coords;
- preserve terrain/topology;
- preserve Hand Holder equipment/tool state;
- preserve Noise/Disturbance state for post-combat world continuation where applicable;
- switch UI board framing to Combat mode;
- do not finish unrelated exploration animations before combat if they would imply false state.

---

## STEP 23 — Add World Cycle Separately

Do not overload World Pulse.

```ts
interface WorldCycleState {
  currentCycleId: WorldCycleId;
  cycleOrdinal: number;
  progressionReason: WorldCycleAdvanceReason;
}
```

Initial v0.1 can leave normal World Cycle advancement wired only to test/admin or an approved expedition macro-event.

Resource recovery code must depend on World Cycle/system policy, never raw Pulse count.

Acceptance test:

- 100 Gather Will actions without World Cycle advancement do not regenerate a harvested medicinal source.

---

## STEP 24 — UI: Will Sigil Primitive

Component contract:

```ts
interface WillSigilViewModel {
  state: WillState;
  canGather: boolean;
  hintKey?: string;
  hasKnownPulseConsequences: boolean;
}
```

Requirements:

- compact Player Board object;
- no numeric energy value;
- clear shape/state change independent of color;
- hover/focus displays short hint;
- selecting/focusing while `DISPERSED` can request Pulse Preview;
- Gather command remains one direct action.

---

## STEP 25 — UI: Noise Ripple Primitive

```ts
interface NoiseRippleViewModel {
  signalId: WorldSignalId;
  coord: HexCoord;
  band: NoiseBand;
  state: WorldSignalState;
  reachableKnownHexes?: HexCoord[];
}
```

Default display:

- compact transient ripple at source;
- no permanent radius grid.

Decision preview:

- when player inspects Noise or Gather Will, optional known propagation overlay can appear.

Accessibility:

- shape/ring pattern differs by band;
- reduced-motion mode uses discrete opacity/shape transition instead of expanding animation.

---

## STEP 26 — UI: Threat Intent Marker

```ts
interface ThreatIntentMarkerViewModel {
  threatId: EntityId;
  intentType: ThreatIntentType;
  targetCoord?: HexCoord;
  pathPreview?: HexCoord[];
  explanationKey: string;
}
```

Rules:

- tiny board marker/arrow;
- hidden when threat/intent is not known;
- not a full card;
- exact path only in Decision Layer;
- long-press opens behavior explanation / trace.

---

## STEP 27 — Pulse Presentation Sequencer

Separate state resolution from animation.

```ts
interface PulsePresentationBatch {
  criticalEvents: DomainEvent[];
  parallelizableEvents: DomainEvent[];
  hiddenEvents: DomainEvent[];
}
```

Presentation rules:

1. critical visible cause/effect order is preserved;
2. independent movements can animate simultaneously;
3. remote/hidden coarse updates receive no animation;
4. player can accelerate/skip non-critical animation;
5. board reaches final canonical state before accepting new route command.

Target for v0.1 playtest:

- normal visible Pulse resolution should feel like a brief world reaction, not a separate phase.

Do not encode a fixed time target into game rules; measure through telemetry.

---

## STEP 28 — Semantic Rule Trace Events

```ts
interface RuleTraceEntry {
  id: string;
  category: 'WORLD_PULSE';
  worldPulseId: WorldPulseId;
  subjectEntityId?: EntityId;
  causeIds: string[];
  ruleId: string;
  outcomeEventIds: string[];
  explanationKey: string;
}
```

Required trace cases:

- Noise creation;
- Noise perception;
- Patrol goal change;
- Patrol movement;
- Disturbance inspection;
- materialization;
- fairness response rejection in debug trace;
- detection/combat transition.

Player-facing trace must summarize semantic cause, not internal scoring formula.

---

## STEP 29 — Region Grammar Dynamic Hook Contract

```ts
interface RegionWorldPulseHooks {
  regionGrammarId: RegionGrammarId;
  threatSpawnAnchors: WorldAnchorId[];
  patrolRouteIds: PatrolRouteId[];
  noiseReactive: boolean;
  topologyMutationCanAffectThreatRoutes: boolean;
  protectedSafeAnchorIds?: WorldAnchorId[];
  pulsePropositionTags: PulsePropositionTag[];
}

type PulsePropositionTag =
  'WAIT_FOR_OPENING' | 'LURE_WITH_NOISE' | 'OPEN_ROUTE_WITH_CONSEQUENCE' | 'OBSERVE_PATROL_RHYTHM';
```

Generator/linter must validate that dynamic hook geometry is actually legal after embedding to hexes.

---

## STEP 30 — Resource Ecology Hook Contract

```ts
interface ResourceSourceWorldPulseHooks {
  sourceDefinitionId: ResourceSourceDefinitionId;
  harvestNoiseBand?: NoiseBand;
  createsPersistentDisturbance?: boolean;
  worldCycleRecoveryRuleId?: WorldCycleRecoveryRuleId;
}
```

Rules:

- Pulse can affect nearby threat behavior;
- Pulse cannot regenerate source;
- World Cycle handles recovery.

---

## STEP 31 — Scout Integration Hooks

```ts
type ScoutPulseCapability = 'ECHO_READING' | 'PULSE_SENSE' | 'TRAIL_READING';

interface ScoutPulseCapabilitySet {
  heroId: EntityId;
  capabilities: ScoutPulseCapability[];
}
```

### ECHO_READING

Query known route/signal relationships only.

Possible output:

```ts
interface EchoReadingPreview {
  signalId: WorldSignalId;
  knownThreatRouteRisk: 'NONE_KNOWN' | 'POSSIBLE' | 'LIKELY';
}
```

Must not reveal hidden threat coordinates.

### PULSE_SENSE

May expose one additional consequence already derivable from Observed state.

### TRAIL_READING

May explain known archetype reaction to persistent Disturbance.

All Scout output must be derivable from viewer knowledge + canonical rules.

---

# 2. Determinism and RNG Rules

The base Pulse is deterministic.

Use deterministic RNG only for:

- tie-breaking between behavior-equivalent legal candidates;
- deterministic materialization among equivalent hexes;
- future authored variation that is explicitly allowed.

Do not use RNG for:

- whether a visible Patrol hears an in-range configured Noise in v0.1;
- whether a Patrol follows its visible intent;
- hidden arbitrary “tension spawns”.

Seed derivation:

```text
pulseSeed = hash(worldSeed, pulseOrdinal, cause, heroCoord, stateVersion)
```

Actor tie-break seed:

```text
actorSeed = hash(pulseSeed, actorId, behaviorState)
```

Use the project’s canonical deterministic hash/RNG utility if one exists.

---

# 3. Movement / Signal Math

## 3.1 Hex distance

Use existing axial/cube distance function.

Do not implement a second distance library.

## 3.2 Noise Reach

Starter algorithm:

1. BFS/Dijkstra over generated traversable-or-sound-permeable hex topology;
2. start cost = 0 at source;
3. normal sound-permeable hex cost = 1;
4. attenuating terrain can use configured additional cost;
5. sound-blocking terrain is excluded;
6. stop when cost exceeds band threshold.

This is **signal propagation**, not Hero pathfinding; use shared topology primitives but separate legal-edge policy.

Example internal thresholds for test fixtures only:

```text
LOCAL = 2
CARRYING = 5
ECHOING = 9
```

These values are parameters and not final design decisions.

Player-facing UI should prefer qualitative band plus contextual overlay, not permanent numbers.

---

# 4. World Response Scoring Parameters

Starter development weights, explicitly non-final:

```ts
const worldResponseWeights: WorldResponseScoreWeights = {
  causalStrength: 1.4,
  heroProximity: 1.0,
  routeRelevance: 1.2,
  tacticalRelevance: 1.3,
  novelty: 0.5,
  readability: 1.0,
  propositionProgress: 1.2,
};
```

Important:

- these are director relevance scores only;
- they do not change attack strength, HP or perception;
- they must be easy to tune through test config;
- simulation correctness cannot depend on UI presentation priority.

Candidate feature calculations should be documented and testable.

---

# 5. Patrol Candidate Algorithm

Pseudocode:

```ts
function resolvePatrolGoal(
  patrol: ExplorationThreatEntity,
  context: WorldPulseContext,
): ThreatGoal {
  const perception = perceiveWorld(patrol, context.state);

  if (perception.visibleHero) {
    return { type: 'DETECT_HERO', heroId: context.heroId };
  }

  const noise = selectRelevantNoise(perception.noiseSignals, patrol, context);
  if (noise) {
    return { type: 'INVESTIGATE_SIGNAL', signalId: noise.id, coord: noise.sourceCoord };
  }

  if (patrol.behaviorState === 'INVESTIGATING' && !isOnPatrolRoute(patrol)) {
    return { type: 'RETURN_TO_ROUTE', routeId: patrol.detailedState!.patrolRouteId! };
  }

  return { type: 'CONTINUE_PATROL', routeId: patrol.detailedState!.patrolRouteId! };
}
```

Movement command must then query existing pathfinding/traversal rules.

If investigation target is unreachable:

1. path to nearest legal reachable hex with line/perception relationship if rule supports it;
2. otherwise switch to Return/Patrol fallback;
3. never tunnel through blocked terrain unless the actor explicitly has such capability.

---

# 6. Pulse Transaction Model

World Pulse should resolve as an engine transaction.

Recommended structure:

```text
PREVIEW (read-only)
-> COMMAND VALIDATION
-> PULSE SNAPSHOT
-> RESPONSE PLANNING (read-only candidates)
-> FAIRNESS VALIDATION
-> DOMAIN EVENT EXECUTION
-> VISIBILITY/DETECTION RECOMPUTE
-> COMBAT TRANSITION OR WILL COMPLETE
-> COMMIT STATE VERSION
```

If a fatal engine error occurs before commit:

- rollback to snapshot;
- do not partially consume Gather Will;
- log deterministic replay data.

Do not implement UI rollback as source of truth.

---

# 7. Save / Load Contract

Persist at minimum:

- Hero Will state;
- pulse ordinal/current record if transaction-safe save is supported;
- active World Signals;
- Disturbance links;
- detailed threat state;
- coarse threat state;
- patrol route progress;
- World Cycle ordinal;
- region dynamic hook state;
- world topology mutations.

On load:

- recompute derived active bubble;
- recompute intent previews;
- do not replay a completed Pulse;
- interrupted in-transaction saves should either be forbidden or recovered through command/event transaction rules.

---

# 8. Game Kit / UI Specification

## 8.1 Will Sigil

**Form:** compact Player Board sigil/token.  
**Shape states:** must visibly differ between complete and dispersed states without relying solely on color.  
**Interaction:** click/tap/focus when Gather Will is legal.  
**Persistent footprint:** small.  
**Expanded info:** only on hover/long press/focus.

## 8.2 Echo Ring

**Form:** transient source-centered ring/ripple overlay.  
**States:** Local / Carrying / Echoing / Fading.  
**Default:** compact, disappears when irrelevant.  
**Decision mode:** may expand to show known reachable sound topology.

## 8.3 Threat Intent Marker

**Form:** tiny token/arrow adjacent to or above observed threat.  
**States:** Patrol / Investigate / Return / Watch.  
**Default:** icon only; short label on focus.  
**Detailed:** optional known path shown on board.

## 8.4 Disturbance

Prefer transformed object/terrain art itself.

Only create an extra marker if the transformed object cannot communicate the state.

---

# 9. Test Fixtures

## FIXTURE WP-01 — Quiet Safe Pulse

Setup:

- Hero Will = DISPERSED;
- no local threats/signals;
- safe terrain.

Expected:

- Gather Will succeeds;
- no fabricated event;
- Will becomes GATHERED;
- Pulse record increments once.

---

## FIXTURE WP-02 — Patrol Continues

Setup:

- observed Patrol on legal route;
- no Noise;
- Hero outside visibility.

Expected:

- preview = CONTINUE_PATROL;
- Pulse moves Patrol according to route rule;
- execution matches preview;
- no Combat transition.

---

## FIXTURE WP-03 — Pickaxe Noise Lure

Setup:

- Stone Crust broken;
- Carrying Noise active;
- observed Patrol in Noise reach;
- Hero hidden.

Expected:

- preview = INVESTIGATE_NOISE;
- Pulse changes Patrol goal;
- Patrol moves legally toward source;
- trace includes Stone break -> Noise -> perception -> investigate.

---

## FIXTURE WP-04 — Hidden Patrol

Setup:

- same as WP-03 but Patrol is not known to Hero.

Expected:

- player preview shows Noise but not Patrol intent/location;
- hidden Patrol still reacts deterministically;
- if later revealed, state is consistent with prior hidden movement.

---

## FIXTURE WP-05 — Broken Passage Used by Patrol

Setup:

- previous topology blocks short route;
- Hero breaks Stone Crust;
- pathfinding updates;
- Patrol investigates.

Expected:

- Patrol may use new passage if it is now legal and behavior/pathfinding selects it;
- no cached blocked path remains;
- Hero can also use it.

---

## FIXTURE WP-06 — No Pulse Farming

Setup:

- harvested medicinal source in RECOVERING;
- World Cycle does not advance.

Action:

- resolve 100 Gather Will Pulses.

Expected:

- source never returns to AVAILABLE from Pulse count alone.

---

## FIXTURE WP-07 — Fairness Rejects Causeless Trap

Setup:

- mandatory Gather Will location;
- candidate response would materialize hidden threat adjacent with no legal coarse connection/readable cause.

Expected:

- materialization candidate rejected;
- no threat appears;
- fairness diagnostic generated in debug trace.

---

## FIXTURE WP-08 — Combat Transition

Setup:

- Patrol Pulse movement creates legal detection.

Expected:

- exploration Pulse stops at detection boundary;
- exact positions preserved;
- CombatTransition event emitted;
- board mode changes;
- no teleport/reset.

---

## FIXTURE WP-09 — Remote Coarse Materialization

Setup:

- coarse actor progresses along connection into active bubble.

Expected:

- legal deterministic materialization hex chosen;
- same seed/state reproduces same result;
- actor identity/behavior preserved.

---

## FIXTURE WP-10 — Intent Invalidated by Player State Change Before Commit

Setup:

- preview shows Patrol -> Continue;
- before Gather Will commit, player performs legal action creating Noise.

Expected:

- old preview invalidates;
- new preview shows Investigate if known;
- execution uses latest canonical state.

---

## FIXTURE WP-11 — Response Budget

Setup:

- three observed Patrols and one Noise create multiple eligible reactions.

Expected:

- selected detailed meaningful responses respect budget/config;
- no incompatible double-action per actor;
- non-selected actors retain coherent behavior state;
- no presentation flood.

---

## FIXTURE WP-12 — Save/Load Determinism

Setup:

- save immediately before Gather Will;
- resolve Pulse;
- record events;
- reload same save and resolve again.

Expected:

- domain event sequence/state outcome identical.

---

# 10. Invariants

1. `willState === GATHERED` after a successful non-combat Gather Will Pulse.
2. One Gather Will command resolves at most one Pulse.
3. Duplicate command ID cannot advance Pulse ordinal twice.
4. Visible intent cannot disagree with execution unless relevant world state changed after preview.
5. Hidden actors cannot leak through preview APIs.
6. Every threat detailed position is a legal generated hex.
7. Every coarse actor has a valid Region/Anchor relation.
8. Materialization requires a valid coarse-to-detailed connection.
9. Noise perception uses the same propagation result as player-known signal preview, filtered by knowledge.
10. Pulse cannot regenerate renewable resources without World Cycle/system rule.
11. Topology mutation invalidates affected path/signal caches.
12. Actor cannot traverse blocked terrain without explicit capability.
13. World Director scoring cannot alter actor combat stats/perception rules.
14. Response Budget cannot create impossible actor state by selecting mutually incompatible responses.
15. Pulse rollback leaves Will unconsumed if transaction fails before commit.
16. Combat transition preserves exact world state relevant to encounter start.
17. Known decision-relevant signal state has a board/UI representation.
18. No permanent World Director dashboard is required for valid play.

---

# 11. Automated Generator / Linter Checks

For any Region Grammar with World Pulse hooks:

```ts
interface WorldPulseLintReport {
  unreachablePatrolNodes: HexCoord[];
  invalidSignalRules: string[];
  mandatoryPulseTrapCases: PulseTrapCase[];
  materializationConflicts: MaterializationConflict[];
  topologyMutationRouteErrors: string[];
  excessiveResponseCases: ExcessiveResponseCase[];
  hiddenInfoLeaks: string[];
  pulseFarmLoops: string[];
}
```

Simulation profiles:

### Conservative Explorer

- avoids Noise;
- prefers cover;
- Gathers Will only at route endpoints.

### Shortcut Seeker

- breaks Stone Crust when it reduces route;
- accepts moderate Noise risk.

### Pulse Manipulator

- intentionally creates Noise to redirect Patrol.

### Naive Explorer

- follows shortest path;
- ignores known intent where possible.

Run seeded simulations to find:

- dominant strategy;
- unavoidable detection;
- infinite waiting loops;
- patrol deadlocks;
- degenerate Noise spam;
- regions where dynamic system has no gameplay effect.

Simulation validates gross structure; it does not replace human playtest.

---

# 12. Telemetry Events

Suggested events:

```text
will_gather_previewed
will_gather_committed
world_pulse_resolved
world_response_visible
noise_created
noise_intentionally_used_estimate
threat_intent_previewed
threat_goal_changed
threat_investigated_noise
threat_used_mutated_passage
pulse_started_combat
pulse_animation_skipped
pulse_rule_trace_opened
remote_actor_materialized
pulse_fairness_candidate_rejected
```

Attach:

- world/region seed;
- region grammar ID;
- pulse ordinal;
- Hero coord;
- relevant signal IDs;
- threat archetype;
- known/hidden status at decision time;
- route context.

Do not log hidden game information into player-facing analytics UI.

---

# 13. Acceptance Criteria for v0.1 Implementation

Engineering acceptance:

- [ ] Gather Will command/state machine works.
- [ ] One Gather Will advances one deterministic Pulse.
- [ ] World Pulse and World Cycle are separate.
- [ ] Stone Crust break can create Carrying Noise + persistent Disturbance.
- [ ] Noise propagation is deterministic and topology-aware.
- [ ] One Patrol archetype can Patrol, Investigate and Return.
- [ ] Observed Patrol intent preview uses execution rules.
- [ ] Hidden Patrol does not leak through preview.
- [ ] Response Budget is parameterized and tested.
- [ ] Detailed/coarse simulation state transitions work.
- [ ] Remote materialization is legal and deterministic.
- [ ] Pulse fairness guards reject causeless illegal materialization/traps.
- [ ] Resource sources cannot regenerate from Pulse spam.
- [ ] Topology mutation is usable by Hero and Patrol.
- [ ] Detection can transition directly into existing Combat state without repositioning.
- [ ] Rule Trace explains important Pulse consequences.
- [ ] save/load reproduces Pulse outcome.
- [ ] reduced-motion presentation exists for Noise/Will animations.

Game-design acceptance:

- [ ] at least one playtest route rewards avoiding Noise;
- [ ] at least one rewards intentionally creating Noise;
- [ ] at least one allows using a permanent shortcut with a meaningful consequence;
- [ ] players can explain visible patrol behavior after Pulse;
- [ ] Gather Will location changes player planning;
- [ ] no tested seed requires repeated idle Pulse waiting as the dominant strategy;
- [ ] normal Pulse does not feel like a separate administrative phase;
- [ ] players report that the world feels active with one Patrol and two signal types.

---

# 14. Explicitly Out of Scope for v0.1

Do not implement yet:

- full predator/prey ecology;
- factions/faction wars;
- NPC economy;
- global weather simulation;
- scent/blood/light signal stack;
- random roaming enemy spawn director;
- resource regrowth on Pulse;
- complex day/night schedule;
- global population simulation;
- multiple threat archetype interactions;
- camp raids;
- companion World Pulse AI;
- multiplayer synchronization for World Pulse beyond architecture compatibility;
- combat hidden-sword mechanics inside this module.

These may be added only after the v0.1 loop proves fun and readable.

---

# 15. Recommended Repository Files

Suggested structure, adapt to existing project architecture:

```text
src/game/world-pulse/
  WorldPulseResolver.ts
  WorldPulsePreviewService.ts
  WorldResponseDirector.ts
  WorldResponseScoring.ts
  WorldPulseFairnessGuards.ts
  WorldSignalService.ts
  NoisePropagationService.ts
  ActiveBubbleService.ts
  RemoteSimulationService.ts
  ThreatBehaviorService.ts
  PatrolBehavior.ts
  ThreatIntentService.ts

src/game/world-pulse/model/
  WillState.ts
  WorldPulse.ts
  WorldSignal.ts
  ExplorationThreat.ts
  WorldResponseCandidate.ts

src/game/world-pulse/config/
  worldPulseConfig.ts
  signalPropagationConfig.ts
  patrolBehaviorConfig.ts

src/game/world-pulse/tests/
  fixtures/
  integration/
  determinism/
  linter/
```

Prefer existing repository conventions over creating a parallel architecture.

---

# 16. Claude Code Implementation Instruction

When implementing this specification:

1. inspect the existing movement/pathfinding/interaction architecture first;
2. reuse canonical domain entities and command/event patterns;
3. implement the steps in order;
4. keep each step independently testable;
5. do not silently replace Will with numeric stamina;
6. do not add random encounter spawning;
7. do not implement full A-Life/ecology;
8. do not expose hidden actor state in preview APIs;
9. flag any conflict with existing code or Master Guide before weakening the mechanic;
10. keep Candidate feature flags/config so the system can be disabled or tuned during playtest.

---

# 17. Final Engineering Invariant

> **A World Pulse is a deterministic transaction that resolves a small set of legal world responses caused by existing state. It is not a random event generator.**

The core implementation proof is this chain:

**Hero action → canonical Signal/State → legal Behavior Response → visible Consequence → next route decision.**

If the code cannot explain that chain through events and Rule Trace, the implementation is incomplete.

---

**End of Implementation Specification v0.1**
