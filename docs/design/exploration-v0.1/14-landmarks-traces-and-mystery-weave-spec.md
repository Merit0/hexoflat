# HEXOFLAT — Landmarks, Traces & Mystery Weave

**Implementation Spec:** v0.1  
**Design Status:** Candidate implementation — do not merge into canonical rules without approval/playtest  
**Design source:** `Hexoflat_Landmarks_Traces_and_Mystery_Weave_Candidate_v0.1.md`  
**Primary contract:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Dependencies:** Frontier Exploration; Region Grammar Generator; Resource Ecology; World Pulse; existing hex/pathfinding/interaction/token systems

---

# 0. Implementation Mandates

Claude Code must preserve these constraints:

1. Do not replace the existing hex grid/pathfinding/movement interaction implementation.
2. Do not expose the technical rectangular grid to the player.
3. Do not add a permanent quest tracker/top bar.
4. Do not model knowledge as numeric XP.
5. Do not create procedural canonical lore facts.
6. Use the same canonical world state for preview and execution.
7. Knowledge-derived affordances must be generated from explicit rules, not UI-only flags.
8. Critical mystery progression must be recoverable.
9. Trace detection must not require pixel-perfect clicking.
10. Routine Trace inspection stays a direct interaction.
11. Mystery Weave opens only contextually/on demand.
12. All new major visible states must map to Game Kit/UI primitives.
13. All generation must be deterministic for a fixed world seed + content version.
14. Recontextualization must never reveal information the Hero has not logically learned.
15. A Landmark cannot exist only as a map marker; it must have world geometry/entity representation.

---

# 1. Exact Incremental Implementation Order

## STEP 1 — Add Landmark Core Contracts

```ts
export type LandmarkScale = 'WORLD' | 'REGIONAL' | 'LOCAL';

export type LandmarkRole =
  | 'ORIENTATION'
  | 'CURIOSITY'
  | 'TRAVERSAL'
  | 'KNOWLEDGE'
  | 'SYSTEM_ACCESS'
  | 'WORLD_CHANGE'
  | 'NARRATIVE_MEMORY';

export type CueChannel = 'VISUAL' | 'AUDIO' | 'TERRAIN' | 'BEHAVIOR' | 'RESOURCE';

export interface LandmarkDefinition {
  id: string;
  contentVersion: string;
  scale: LandmarkScale;
  roles: LandmarkRole[];
  silhouetteId: string;
  cueChannels: CueChannel[];
  visibilityProfileId: string;
  allowedRegionRoles: string[];
  traceSocketIds: string[];
  interactionProfileId?: string;
  mysteryIds?: string[];
  authored: boolean;
}

export interface LandmarkInstance {
  id: string;
  definitionId: string;
  anchorHexId: string;
  regionId: string;
  discoveryState: 'UNKNOWN' | 'OBSERVED' | 'DISCOVERED' | 'UNDERSTOOD' | 'EXPLOITABLE';
  transformStateId?: string;
  observedFromHexIds: string[];
  resolvedTraceIds: string[];
  worldFlags: string[];
}
```

Acceptance:

- Landmark state serializes independently from visual component.
- World state remains source of truth.

---

## STEP 2 — Add Visibility Profile

```ts
export interface LandmarkVisibilityProfile {
  id: string;
  maxHexDistance?: number;
  requiresLineOfSight: boolean;
  elevationBias: 'NONE' | 'HELPFUL' | 'REQUIRED';
  fogBehavior: 'HIDDEN' | 'SILHOUETTE' | 'CUE_ONLY';
  occlusionTags: string[];
  cueFalloff: 'NONE' | 'NEAR' | 'REGIONAL';
}
```

Rules:

- `UNKNOWN` world hexes do not expose exact landmark footprint.
- Distant observation may reveal silhouette/cue + approximate direction only.
- Exact route remains unknown until terrain is discovered.

---

## STEP 3 — Implement Landmark Observation Query

```ts
queryVisibleLandmarks(heroId, worldState): LandmarkObservation[]
```

Each observation returns:

```ts
export interface LandmarkObservation {
  landmarkId: string;
  observationKind: 'SILHOUETTE' | 'AUDIO_CUE' | 'TERRAIN_CUE' | 'KNOWN';
  relativeDirection: 0 | 1 | 2 | 3 | 4 | 5;
  distanceBand: 'NEAR' | 'MID' | 'FAR' | 'UNKNOWN';
  revealedCategory?: string;
  exactHexKnown: boolean;
}
```

No exact numeric distance must be required in player-facing UI.

---

## STEP 4 — Add Landmark Promise Metadata for Linting

```ts
export interface LandmarkPromiseContract {
  landmarkDefinitionId: string;
  promiseCueIds: string[];
  approachGrammarIds: string[];
  interactionVerbIds: string[];
  insightIds: string[];
  echoRuleIds?: string[];
  looseEndQuestionIds?: string[];
}
```

This is content validation metadata, not a player-facing object.

---

## STEP 5 — Integrate Landmarks with Region Grammar

Add procedural region roles:

```ts
export type LandmarkRegionRole =
  | 'APPROACH_TO_LANDMARK'
  | 'LANDMARK_OVERLOOK'
  | 'LANDMARK_GATE'
  | 'LANDMARK_RING'
  | 'LANDMARK_BACK_ROUTE'
  | 'LANDMARK_ECHO';
```

Generator constraint:

- Landmark approach regions must connect to the landmark anchor region through valid topology.
- At least one valid approach path must exist without requiring future-unavailable capability unless landmark is explicitly optional/gated.

---

## STEP 6 — Add Trace Definition Contract

```ts
export type TraceKind =
  | 'TRACK'
  | 'DAMAGE'
  | 'SYMBOL'
  | 'RESIDUE'
  | 'TOOL_REMAINS'
  | 'STRUCTURAL_PATTERN'
  | 'RESOURCE_CLUE'
  | 'BEHAVIOR_CLUE'
  | 'SOUND'
  | 'AUTHORED_MEMORY'
  | 'OTHER';

export interface TraceDefinition {
  id: string;
  kind: TraceKind;
  authoredFactIds: string[];
  detectionRuleId: string;
  interactionProfileId?: string;
  persistence: 'PERSISTENT' | 'WORLD_CYCLE' | 'PULSE_TEMPORARY';
  criticality: 'ROUTINE' | 'OPTIONAL' | 'MAIN_PATH';
  visualGrammarId: string;
}

export interface TraceInstance {
  id: string;
  definitionId: string;
  hexId: string;
  sourceEntityId?: string;
  discovered: boolean;
  inspected: boolean;
  worldCycleCreated?: number;
  worldCycleExpires?: number;
}
```

---

## STEP 7 — Implement Trace Detection

Detection uses rules, not pixel hover.

```ts
queryObservableTraces(heroId, worldState): ObservableTrace[]
```

A Trace may be observable because:

- adjacent Hero position;
- Scout capability;
- specific tool equipped/held;
- landmark interaction;
- World Pulse behavior;
- prior Insight unlock.

If the Hero cannot logically perceive it, do not render it as known state.

---

## STEP 8 — Reuse Existing Interaction Grammar

Map Trace interactions to existing interaction system.

Examples:

```ts
HAND + TRACE -> INSPECT
PICKAXE + FRACTURE_TRACE -> TEST / BREAK when allowed
ROPE + ANCHOR_TRACE -> CREATE_CONNECTION when allowed
```

Do not create a separate “Mystery Interact” button.

---

## STEP 9 — Add Knowledge Fact Contract

```ts
export type KnowledgeFactType =
  | 'WORLD_RULE'
  | 'TERRAIN_CLASSIFICATION'
  | 'HABITAT_RULE'
  | 'THREAT_BEHAVIOR'
  | 'LANDMARK_RELATION'
  | 'NARRATIVE_FACT'
  | 'SYSTEM_RULE';

export interface KnowledgeFactDefinition {
  id: string;
  type: KnowledgeFactType;
  subjectTag: string;
  statementKey: string;
  provenanceTraceDefinitionIds: string[];
  unlockRuleIds: string[];
  authored: true;
}

export interface HeroKnowledgeState {
  knownTraceIds: string[];
  knownFactIds: string[];
  appliedInsightIds: string[];
  reconsiderationIds: string[];
}
```

No numeric points.

---

## STEP 10 — Add Insight Contract

```ts
export interface InsightDefinition {
  id: string;
  requiredFactIds: string[];
  optionalFactIds?: string[];
  unlockRuleIds: string[];
  recontextualizationRuleIds?: string[];
  rewardCategories: Array<
    | 'TOPOLOGY'
    | 'BEHAVIOR'
    | 'HABITAT'
    | 'CAPABILITY'
    | 'SYSTEM_ACCESS'
    | 'WORLD_STATE'
    | 'NARRATIVE'
    | 'RECONTEXTUALIZATION'
  >;
}
```

---

## STEP 11 — Implement Knowledge Rule Registry

Knowledge-derived rule effects must live in game rules.

```ts
export interface KnowledgeUnlockRule {
  id: string;
  applies(context: RuleContext): boolean;
  modifyAffordances(base: AffordanceSet, context: RuleContext): AffordanceSet;
  explain(context: RuleContext): SemanticRuleTraceEntry[];
}
```

Example:

`KNOW_FRACTURE_MARK` allows classification of compatible `Observed` stone candidates as `POSSIBLE_FRACTURED_STONE`.

The rule does not automatically make the stone traversable.

---

## STEP 12 — Add Mystery Definition Contract

```ts
export interface MysteryDefinition {
  id: string;
  contentVersion: string;
  scope: 'LOCAL' | 'REGIONAL' | 'CAMPAIGN';
  authoredTruthFactIds: string[];
  questionIds: string[];
  insightIds: string[];
  evidenceRouteGroups: EvidenceRouteGroup[];
  fallbackRuleId?: string;
  maxActiveQuestionContribution: number;
}

export interface QuestionDefinition {
  id: string;
  mysteryId: string;
  textKey: string;
  requiredInsightIds?: string[];
  resolutionInsightIds: string[];
  mainPath: boolean;
}

export interface EvidenceRouteGroup {
  id: string;
  alternativeTraceDefinitionIds: string[];
  minimumRequired: number;
}
```

---

## STEP 13 — Validate Evidence Redundancy

Build-time linter:

For every `MAIN_PATH` question:

- verify at least two independent compatible evidence routes; OR
- verify explicit fallback rule.

Independence means not both traces depend on the same unique missable world object.

---

## STEP 14 — Add Mystery Runtime State

```ts
export interface MysteryRuntimeState {
  mysteryId: string;
  status: 'DORMANT' | 'ACTIVE' | 'RESOLVED';
  activeQuestionIds: string[];
  discoveredTraceIds: string[];
  establishedInsightIds: string[];
  hypothesisThreads: HypothesisThread[];
}
```

---

## STEP 15 — Add Hypothesis Thread Contract

```ts
export interface HypothesisThread {
  id: string;
  questionId: string;
  traceIds: string[];
  proposedInsightId?: string;
  status: 'PROPOSED' | 'SUPPORTED' | 'DISPROVEN' | 'ESTABLISHED';
}
```

For v0.1, only one simple thread is required.

Do not implement freeform NLP inference.

---

## STEP 16 — Implement Hypothesis Validation as World Test

Preferred implementation:

- proposed thread activates a **test affordance** in compatible world context;
- success/failure is resolved through normal game rules.

Example:

Hypothesis: marked seam is breakable.

World test:

`Pickaxe + compatible marked stone`.

Success:

- world transformation event;
- Insight established/applied;
- semantic Rule Trace.

Failure:

- no permanent lock;
- hypothesis may become disproven;
- optional new Trace can be generated if authored.

---

## STEP 17 — Add Recontextualization Rule Contract

```ts
export interface RecontextualizationRule {
  id: string;
  requiredInsightId: string;
  queryCandidates(
    worldState: WorldState,
    knowledge: HeroKnowledgeState,
  ): ReconsiderationCandidate[];
  maxMarkers: number;
  visibilityMode: 'DISCOVERY_MODE_ONLY' | 'CONTEXT_ONLY';
}

export interface ReconsiderationCandidate {
  id: string;
  hexId: string;
  sourceObservedStateId: string;
  reasonRuleId: string;
  resolved: boolean;
}
```

---

## STEP 18 — Implement Recontextualization Scan

Trigger only when:

- a new relevant Insight is established;
- load/upgrade migration requires recalculation.

Do not scan every frame or every Pulse.

Algorithm:

1. Load newly established Insight.
2. Run only its registered recontextualization rules.
3. Search `OBSERVED | DISCOVERED | UNDERSTOOD` compatible entities/hexes.
4. Filter locations whose relevant feature was previously observable.
5. Score by relevance and recency.
6. Keep at most configured `maxMarkers`.
7. Create `ReconsiderationCandidate` state.

The system may not create a marker for a feature the player never had a chance to observe.

---

## STEP 19 — Add Memory Spark UI Primitive

Visible only when:

- Discovery/Memory mode is active; OR
- the Hero is physically near the reconsiderable location.

States:

- `NEW_RECONTEXTUALIZATION`;
- `REVISITED`;
- `RESOLVED`.

No pulsing permanent HUD alert.

---

## STEP 20 — Add Mystery Weave Player Board Mode

The Player Board temporarily switches from default agency state to Mystery Weave.

Minimum layout:

- left/center: active Question nodes;
- nearby: known Trace markers relevant to those Questions;
- established Insight markers;
- draggable/clickable Thread connection;
- close/back returns to prior Player Board state.

Do not replace the Game Board.

---

## STEP 21 — Add Question Activation Budget

Config:

```ts
export interface MysteryCognitiveBudget {
  maxMajorActiveQuestions: number; // v0.1 default 2
  maxLocalActiveQuestions: number; // v0.1 default 3
  maxNewMajorQuestionsPerRegion: number; // v0.1 default 1
}
```

When content wants to exceed budget:

- defer non-critical Question activation;
- do not hide already critical information;
- surface via later compatible event.

---

## STEP 22 — Integrate Scout Capabilities

Candidate flags:

```ts
export type DiscoveryScoutCapability =
  | 'LANDMARK_SENSE'
  | 'TRACE_AWARENESS'
  | 'PATTERN_RECALL'
  | 'CONTEXT_READING'
  | 'DISTANT_CLASSIFICATION';
```

Rules:

- capabilities expose legal known information;
- they never reveal authored truth automatically;
- `PATTERN_RECALL` invokes registered recontextualization rules only.

---

## STEP 23 — Integrate Path of Will Movement Interrupt

If a route crosses a point where an important observable Trace or Landmark cue becomes newly available and Hero has relevant awareness capability:

```ts
MovementInterruptReason = 'NEW_TRACE' | 'NEW_LANDMARK_CUE' | existing reasons
```

Offer existing candidate flow:

`Continue / Stop / Act`.

Preserve remaining movement.

---

## STEP 24 — Integrate Gather Will / Hold Attention

Add optional Gather Will focus:

```ts
export type GatherWillFocus = 'NONE' | 'HOLD_ATTENTION';
```

`HOLD_ATTENTION` may improve classification of an already observable dynamic cue.

Constraints:

- World Pulse still executes;
- no clue farming;
- each dynamic cue defines whether Hold Attention can produce a new fact and under what state.

---

## STEP 25 — Integrate World Pulse Signals

Landmarks/Traces may subscribe to existing World Signals.

Examples:

- `SOUND` Trace produced by a landmark event;
- patrol behavior leaves temporary `TRACK` Trace after Pulse;
- smoke cue expires on World Cycle;
- persistent Disturbance creates a structural Trace.

Critical main-path evidence cannot expire without guaranteed recovery.

---

## STEP 26 — Integrate Resource Ecology

Allow Insight unlocks to extend resource habitat classifiers.

```ts
KnowledgeUnlockRule -> ResourceHabitatQuery
```

Example:

`HABITAT_MEDICINAL_SHADED_WET_EDGE`

Before Insight:

- player sees only terrain.

After Insight:

- Scout Frontier Reading may label an Observed region as `LIKELY_MEDICINAL_HABITAT`.

Do not reveal exact resource node positions.

---

## STEP 27 — Integrate Known Travel

When a Reconsideration marker refers to solved territory:

- allow existing Known Travel/route system to reduce traversal repetition;
- do not teleport into unknown or currently unsafe state unless Known Travel rules already allow it.

This prevents knowledge-driven backtracking from becoming walking friction.

---

## STEP 28 — Add Authored Mystery Embedding Sockets

Region generation must support:

```ts
export interface MysteryEmbeddingSocket {
  id: string;
  regionId: string;
  compatibleTraceKinds: TraceKind[];
  routeRiskTags: string[];
  requiredTraversalTags?: string[];
  persistent: boolean;
}
```

Embedding algorithm selects only compatible authored Trace definitions.

---

## STEP 29 — Implement Deterministic Evidence Embedding

Inputs:

- world seed;
- content version;
- mystery definition;
- compatible region graph;
- evidence route group;
- anti-repetition memory.

Output:

- deterministic Trace instance placements.

Invariant:

Same inputs → same placement.

---

## STEP 30 — Add Mystery Anti-Repetition Memory

```ts
export interface MysteryExperienceMemory {
  recentLandmarkRoles: LandmarkRole[];
  recentCueChannels: CueChannel[];
  recentTraceKinds: TraceKind[];
  recentApproachGrammarIds: string[];
  recentPrimaryVerbIds: string[];
  recentRewardCategories: string[];
  recentTestPatternIds: string[];
  recentRecontextualization: boolean[];
}
```

Generation scoring must penalize repeated experience patterns.

---

## STEP 31 — Add Landmark/Mystery Linter

Build-time + generation-time checks:

- Promise missing;
- invalid approach path;
- only material reward;
- no interaction verb;
- no Insight/world change;
- critical evidence single-source;
- critical evidence on expiring Trace;
- evidence behind impossible gate;
- question budget overflow;
- excessive Trace density;
- missing silhouette grammar;
- duplicate recent experience pattern;
- lore truth marked `authored:false`;
- recontextualization candidate was never observable;
- exact objective marker accidentally generated for Unknown space.

---

## STEP 32 — Add Semantic Rule Trace Events

Required event examples:

```ts
LandmarkObserved;
TraceObserved;
TraceInspected;
KnowledgeFactLearned;
HypothesisThreadProposed;
HypothesisSupported;
HypothesisDisproven;
InsightEstablished;
KnowledgeAffordanceUnlocked;
ReconsiderationCreated;
ReconsiderationResolved;
LandmarkUnderstood;
```

Each event contains cause/source IDs.

Example trace:

`Trace Inspected → Fact Learned → Insight Established → Fracture Classification Unlocked → Old Ridge Reconsidered`

---

## STEP 33 — Save / Load Contracts

Persist:

- Landmark instances and discovery states;
- Trace instances and expiry state;
- Hero knowledge;
- Mystery runtime state;
- hypothesis threads;
- reconsideration candidates;
- content version;
- procedural embedding seed/version.

Do not persist derived UI layout positions unless needed for user-authored thread arrangement.

---

## STEP 34 — Build Starter Vertical Slice Content

Required authored IDs:

```txt
LANDMARK_MARKED_SPIRE
MYSTERY_MARKED_STONE
QUESTION_MARKED_STONE_PURPOSE
TRACE_THREE_CUT_MARK
TRACE_BROKEN_MINING_TOOL
TRACE_ROPE_ALIGNMENT_OPTIONAL
INSIGHT_ENGINEERED_WEAK_SEAM
RULE_CLASSIFY_MARKED_FRACTURE
RECONTEXTUALIZE_OLD_MARKED_RIDGE
```

Required world setup:

- Camp;
- old observed marked ridge near Camp;
- frontier regional landmark;
- 3 approach regions;
- Stone Crust shortcut;
- patrol/noise interaction;
- one hidden passage created after Insight application.

---

# 2. Landmark Placement Algorithm

High-level algorithm:

```txt
1. Select authored/procedural LandmarkDefinition compatible with regional biome/topology.
2. Choose anchor region with required landmark role.
3. Validate silhouette visibility opportunities from at least one earlier reachable region.
4. Create 1–3 compatible approach regions.
5. Ensure at least one legal route with current campaign capabilities unless optional/gated.
6. Add Promise cue visibility before arrival.
7. Reserve Trace sockets.
8. Run route-interest score.
9. Run anti-repetition score.
10. Run solvability linter.
11. Commit deterministic placement.
```

Candidate quality score:

```txt
LandmarkScore =
  PromiseStrength
+ NavigationValue
+ ApproachDecisionValue
+ InsightValue
+ WorldConnectionValue
+ NoveltyBonus
- RepetitionPenalty
- UIClutterPenalty
- SolvabilityRiskPenalty
```

Weights are config-driven and not player-facing.

---

# 3. Trace Detection Algorithm

A Trace is visible when all applicable conditions pass:

```txt
Exists
AND not hidden by current discovery state
AND perception distance/adjacency condition
AND required Scout/Tool knowledge if any
AND occlusion rule
AND world-cycle persistence rule
```

Critical evidence rule:

If a player reaches a valid evidence interaction location, the Trace must use a sufficiently clear visual/context affordance. Critical evidence may never depend on a 1-pixel hover target.

---

# 4. Insight Resolution

An Insight may establish when:

1. explicit authored fact requirements are satisfied; OR
2. a supported Hypothesis is successfully tested in-world; OR
3. an authored interaction directly establishes it.

Resolution pipeline:

```txt
Collect Fact(s)
→ Evaluate Insight prerequisites
→ Establish Insight
→ Apply Knowledge Unlock Rules
→ Run Recontextualization Rules
→ Emit Rule Trace
→ Update affected previews/UI
```

Do not automatically resolve a major mystery merely because the engine internally has enough facts if design requires a player-world test.

---

# 5. Recontextualization Scoring

Candidate scoring:

```txt
score =
  RuleMatch
+ PlayerPreviouslyObservedWeight
+ RouteAccessibilityWeight
+ GeographicMemoryWeight
+ RewardPotentialWeight
- ExcessiveDistancePenalty
- RecentlyReconsideredPenalty
- MarkerClutterPenalty
```

Hard cap for v0.1:

- max 2 simultaneous new Memory Sparks from one Insight.

This is a starting parameter for playtest.

---

# 6. Mystery Weave UI Behavior

## 6.1 Open

Player selects Discovery/Mystery mode from Player Board contextual access.

## 6.2 Content

Show only:

- active Questions;
- relevant known Traces;
- established Insights;
- user-created Thread(s).

Do not show undiscovered clue slots.

## 6.3 Interaction

- select Question;
- select/drag Trace to Question;
- create Thread;
- inspect Trace source;
- optionally jump/pan Game Board to already known source location;
- close.

## 6.4 Empty State

If no active meaningful mystery exists, do not show a large empty board.

---

# 7. Game Kit / UI Specification

## 7.1 Landmark World Form

Use world geometry/objects. No generic POI pin as primary representation.

Required states:

- distant silhouette;
- observed;
- discovered;
- understood;
- transformed where applicable.

## 7.2 Trace Marker

Shape must differ from:

- resource token;
- interaction marker;
- threat marker;
- waypoint.

Marker is contextual, not always visible.

## 7.3 Question Pin

Small node in Mystery Weave.

States:

- open;
- supported;
- resolved.

## 7.4 Thread

Thin connection between Trace and Question/Insight.

States:

- proposed;
- supported;
- disproven;
- established.

## 7.5 Memory Spark

Only Discovery/Memory layer or local context.

Must not visually compete with threats/combat intent.

---

# 8. Test Fixtures

## FIXTURE LM-01 — Distant Landmark Promise

Given:

- Hero at frontier overlook;
- regional landmark within visibility profile;
- intervening Unknown terrain.

Expect:

- silhouette/direction visible;
- exact path/footprint not revealed;
- no generic quest marker created.

## FIXTURE LM-02 — Landmark Occluded

Expect no silhouette if visibility rules block it.

## FIXTURE LM-03 — Routine Trace Inspect

Given Hero adjacent to Trace.

Expect:

- Hand → Inspect available;
- fact recorded;
- no separate mini-game.

## FIXTURE LM-04 — Scout Trace Awareness Interrupt

Route crosses newly observable important Trace.

Expect:

- movement interrupts;
- Continue / Stop / Act;
- remaining Shift preserved.

## FIXTURE LM-05 — Knowledge Classification

Before Insight:

- marked stone remains generic observed stone.

After Insight:

- compatible marked stone classifies as possible fracture;
- no unrelated stone changes.

## FIXTURE LM-06 — Recontextualization

Given old ridge was previously observed and contains compatible mark.

After Insight:

- Memory Spark created;
- visible only in Discovery/Memory mode or near location;
- no exact new content revealed.

## FIXTURE LM-07 — No Retroactive Hallucination

Old hex contains compatible feature but Hero never observed it.

Expect:

- no Memory Spark.

## FIXTURE LM-08 — Critical Evidence Redundancy

Destroy/block one evidence route.

Expect:

- alternate route or fallback remains valid.

## FIXTURE LM-09 — Expiring Trace Safety

Main-path Trace configured as `PULSE_TEMPORARY`.

Expect linter failure unless recoverable fallback explicitly validates.

## FIXTURE LM-10 — Hypothesis World Test Success

Create fracture hypothesis and use Pickaxe on compatible marked seam.

Expect:

- passage transformation;
- hypothesis supported/established;
- Insight applied;
- rule trace generated.

## FIXTURE LM-11 — Hypothesis Failure

Test on incompatible mark.

Expect:

- no progression lock;
- no false world transformation;
- hypothesis may be disproven;
- player retains other evidence routes.

## FIXTURE LM-12 — Question Budget

Attempt to activate third major Question with max=2.

Expect:

- non-critical activation deferred;
- no data loss.

## FIXTURE LM-13 — No Fog Completion Dependency

Critical Trace generation must not require 100% region discovery.

## FIXTURE LM-14 — Save/Load Determinism

Save after one Trace, one hypothesis and one reconsideration marker.

Reload.

Expect identical state and future deterministic embeddings.

## FIXTURE LM-15 — Anti-Repetition

Recent experience contains two `visual landmark → climb → symbol inspect` patterns.

Expect third similar candidate receives rejection/large penalty.

## FIXTURE LM-16 — Known Travel Backtracking

Reconsidered old location is in Understood territory.

Expect existing Known Travel system may be used according to its rules; player not forced through full frontier movement again.

---

# 9. Invariants

1. `UNKNOWN` never exposes exact landmark position unless a specific cue rule intentionally allows approximate signal only.
2. Knowledge rules cannot reveal facts not authored in content.
3. Main-path mystery cannot have only one unrecoverable evidence source.
4. Recontextualization cannot mark a feature the player never had an opportunity to observe.
5. Insight application uses canonical game rules, not UI-only state.
6. Mystery Weave is never required for routine pickup/inspection.
7. No numeric clue XP/progress percentage is required.
8. No permanent HUD objective tracker is introduced.
9. A major Landmark must have at least two functional roles.
10. A major optional mystery should have a non-material reward category.
11. Same seed + content version produces same authored evidence embedding.
12. World Pulse cannot erase unrecoverable main-path evidence.
13. Scout can classify/notice but cannot auto-solve authored mystery truth.
14. Manual Waypoint remains optional and player-authored.
15. Known Travel does not reveal unknown topology.

---

# 10. Automated Linter Checks

Implement checks with IDs:

```txt
LM_PROMISE_MISSING
LM_APPROACH_UNREACHABLE
LM_SINGLE_ROLE_MAJOR
LM_ONLY_MATERIAL_REWARD
LM_CRITICAL_EVIDENCE_SINGLE_POINT
LM_CRITICAL_TRACE_EXPIRY
LM_EVIDENCE_IMPOSSIBLE_GATE
LM_QUESTION_BUDGET_OVERFLOW
LM_TRACE_DENSITY_HIGH
LM_NO_DISTINCT_SILHOUETTE
LM_PROCEDURAL_LORE_TRUTH
LM_RECONTEXTUALIZE_UNOBSERVED
LM_UNKNOWN_EXACT_MARKER
LM_HYPOTHESIS_BRUTE_FORCE
LM_EXPERIENCE_REPETITION
LM_NO_WORLD_EFFECT
```

Generation pipeline should reject hard failures and score warnings.

---

# 11. Automated Explorer Profiles

## Curious Explorer

Prioritizes distant Landmark cues.

Validate:

- can reach at least one meaningful payoff;
- path is not always shortest path;
- reward can be knowledge/topology.

## Minimalist Explorer

Ignores optional landmarks.

Validate:

- main progression remains possible;
- optional system does not become mandatory checklist.

## Knowledge Seeker

Revisits Memory Sparks after Insight.

Validate:

- at least one recontextualized location produces meaningful affordance.

## Brute-Force Tester

Attempts unsupported hypothesis tests repeatedly.

Validate:

- cannot unlock truth through tiny answer-space spam;
- no permanent failure state.

## Fog Cleaner

Attempts 100% map reveal.

Validate:

- no special progression depends on clearing all fog.

---

# 12. Telemetry Events

```txt
landmark_observed
landmark_pinned
landmark_pursuit_started
landmark_reached
landmark_understood
trace_observed
trace_inspected
question_activated
mystery_weave_opened
hypothesis_thread_created
hypothesis_tested
hypothesis_supported
hypothesis_disproven
insight_established
insight_applied
reconsideration_created
reconsideration_revisited
reconsideration_resolved
known_travel_used_for_recontextualization
```

Useful derived metrics:

- optional Landmark pursuit rate;
- average active Questions;
- critical Trace miss rate;
- Weave opens per Insight;
- time Insight→Application;
- recontextualization revisit rate;
- backtracking time in solved territory;
- repeated hypothesis spam rate;
- landmark cue recognition rate.

---

# 13. Acceptance Criteria for v0.1

Implementation passes when:

1. A regional Landmark can be seen as a silhouette before exact topology is known.
2. The player can choose to pursue or ignore it without a forced quest arrow.
3. Region Grammar creates a valid multi-region approach.
4. Two primary Traces are discoverable without pixel hunting.
5. Hand/Inspect reuses current interaction grammar.
6. One Question appears only when relevant evidence/landmark activates it.
7. Player can create one Hypothesis Thread.
8. Hypothesis can be tested through normal world interaction.
9. Successful test establishes an Insight.
10. Insight changes a real classification/affordance rule.
11. One old observed location becomes reconsiderable.
12. The reconsideration marker remains contextual, not permanent HUD clutter.
13. Known Travel can reduce revisit friction.
14. Applying the Insight creates a persistent topology/world-state consequence.
15. World Pulse and patrol systems remain compatible with the new passage.
16. Save/load preserves all landmark, knowledge and mystery state.
17. Linter catches single-point critical evidence and unobserved recontextualization.
18. Same seed produces identical evidence embedding.
19. Player can finish the slice without clearing all fog.
20. No numeric clue XP/progress bar is required.

---

# 14. Explicitly Out of Scope for v0.1

- more than one authored mystery;
- more than one hypothesis type;
- freeform text hypotheses;
- procedural story truth generation;
- secret language decoding;
- multi-player clue ownership;
- community ARG support;
- dozens of landmark art variants;
- dynamic moving world landmarks;
- companion-specific clue interpretation;
- full lore integration with Soul Without a Name;
- main campaign gating on puzzle completion.

---

# 15. Recommended Repository Files

```txt
docs/design/Hexoflat_Landmarks_Traces_and_Mystery_Weave_Candidate_v0.1.md
docs/implementation/Hexoflat_Landmarks_Traces_and_Mystery_Weave_Implementation_Spec_v0.1.md

src/game/landmarks/LandmarkDefinition.ts
src/game/landmarks/LandmarkInstance.ts
src/game/landmarks/LandmarkVisibility.ts
src/game/traces/TraceDefinition.ts
src/game/traces/TraceDetection.ts
src/game/knowledge/HeroKnowledgeState.ts
src/game/knowledge/KnowledgeRuleRegistry.ts
src/game/knowledge/InsightDefinition.ts
src/game/mysteries/MysteryDefinition.ts
src/game/mysteries/MysteryRuntimeState.ts
src/game/mysteries/HypothesisThread.ts
src/game/mysteries/Recontextualization.ts
src/game/generation/MysteryEmbedding.ts
src/game/generation/MysteryExperienceMemory.ts
src/game/validation/LandmarkMysteryLinter.ts
src/ui/player-board/mystery-weave/*
src/ui/game-board/landmarks/*
src/ui/game-board/traces/*
src/ui/game-board/memory-spark/*
```

Adapt paths to existing repository conventions rather than duplicating architecture.

---

# 16. Claude Code Implementation Instruction

Implement in the exact incremental order above.

After each step:

1. run unit tests;
2. run typecheck/lint;
3. verify deterministic fixture if generation changed;
4. do not proceed if a canonical invariant is broken;
5. do not invent new UI panels or numeric state to simplify implementation;
6. keep all newly introduced content IDs/config parameterized;
7. use existing pathfinding, world state, interaction and World Pulse services instead of duplicating them;
8. record candidate assumptions in code/docs with `CANDIDATE_v0_1` or project-equivalent metadata.

---

# 17. Final Engineering Invariant

> **Knowledge is game state only when it changes what the Hero can legitimately perceive, predict, classify or do. Mystery UI may explain that state, but it must never be the hidden source of gameplay truth.**

**End of Implementation Spec v0.1**
