# HEXOFLAT — Known World Travel & Expedition Planning

**Implementation Specification:** v0.1  
**Design status:** Candidate — do not promote to canonical without playtest approval  
**Parent design:** `Hexoflat_Known_World_Travel_and_Expedition_Planning_Candidate_v0.1.md`  
**Primary design contract:** Hexoflat Master Design & Implementation Guide v1.0  
**Audience:** Claude Code / Engineering / QA / Game Design

---

# 0. Implementation Mandates

1. Preserve existing canonical hex coordinates, pathfinding, blocked-hex logic, Hero Token movement and path preview.
2. Reuse the existing hero trail renderer where practical as the basis of Trail Imprint.
3. Do not implement Known Travel as teleportation.
4. Route network state must be derived from canonical world topology and discovery state.
5. Never create a travel edge that crosses Unknown/uncommitted topology as if it were known.
6. Accelerated travel must stop before any unresolved Decision Gate.
7. Accelerated travel must use the same movement legality, threat detection and traversal rules as manual movement.
8. Travel must advance Living World state deterministically.
9. Do not auto-collect resources during travel.
10. Do not reveal hidden world information through route planning.
11. Do not expose numeric route efficiency/risk scores to the player.
12. Preview and execution must query the same route contracts.
13. All route/world mutations must persist in save state.
14. Implement STRIDE, VEIL and SURVEY only for v0.1.
15. Do not implement GATHER until separately approved.

---

# 1. Exact Incremental Implementation Order

## STEP 1 — Introduce Route Knowledge State

```ts
type RouteKnowledgeState = 'UNTRAVELED' | 'TRAVERSED' | 'KNOWN' | 'RELIABLE' | 'FRAYED';

interface RouteSegmentKnowledge {
  segmentId: string;
  state: RouteKnowledgeState;
  firstTraversalWorldVersion?: number;
  lastValidatedWorldVersion?: number;
  knownGateIds: string[];
  frayReason?: RouteFrayReason;
}
```

Do not equate `RELIABLE` with permanently safe.

---

## STEP 2 — Add Canonical Trail Segment Identity

A segment must resolve to canonical ordered or direction-aware hex adjacency.

```ts
interface HexEdgeRef {
  from: HexCoord;
  to: HexCoord;
}

interface TrailSegment {
  id: string;
  edges: HexEdgeRef[];
  startAnchorId?: string;
  endAnchorId?: string;
}
```

Requirements:

- segment IDs are deterministic;
- reverse traversal is either explicitly represented or normalized with direction metadata;
- world mutation can invalidate only affected subsegments.

---

## STEP 3 — Convert Existing Hero Trail Into Trail Imprint Input

On successful manual movement:

1. obtain executed canonical path from movement engine;
2. write traversal evidence for each edge;
3. update existing trail visuals normally;
4. send `HeroTraversedPath` domain event;
5. travel-knowledge subsystem evaluates whether traversed edges can become candidate Trail Segments.

Do not make visual trail state the source of truth.

---

## STEP 4 — Introduce Travel Anchors

```ts
type TravelAnchorType =
  'CAMP' | 'LANDMARK' | 'JUNCTION' | 'SHELTER' | 'SOURCE' | 'GATE' | 'FRONTIER';

interface TravelAnchor {
  id: string;
  type: TravelAnchorType;
  hex: HexCoord;
  discoveryState: DiscoveryState;
  sourceEntityId?: string;
  enabled: boolean;
}
```

Rules:

- anchor creation is semantic, not per-hex;
- anchors may reference existing Camp/Landmark/Resource entities;
- do not duplicate visible tokens if the existing world token can act as the anchor representation.

---

## STEP 5 — Add Travel Gates

```ts
type TravelGateType =
  | 'STONE_PASSAGE'
  | 'BRIDGE'
  | 'ROPE_CROSSING'
  | 'THREAT_CROSSING'
  | 'TERRAIN_CONDITION'
  | 'FRONTIER_BOUNDARY'
  | 'MYSTERY_RECONTEXTUALIZATION';

interface TravelGate {
  id: string;
  type: TravelGateType;
  hexes: HexCoord[];
  decisionPolicy: 'AUTO_IF_RESOLVED' | 'STOP_IF_CHANGED' | 'ALWAYS_STOP';
  currentStateVersion: number;
}
```

Gate evaluation must use canonical traversal/threat/mystery rules.

---

## STEP 6 — Build Travel Graph From World State

```ts
interface TravelGraphNode {
  anchorId: string;
}

interface TravelGraphEdge {
  id: string;
  fromAnchorId: string;
  toAnchorId: string;
  segmentIds: string[];
  gateIds: string[];
  routeKnowledge: RouteKnowledgeState;
}

interface KnownTravelGraph {
  nodes: TravelGraphNode[];
  edges: TravelGraphEdge[];
}
```

Build/update only from:

- committed existing hexes;
- legal traversable paths;
- player discovery knowledge;
- permanent world mutations;
- current Gate state.

Do not use generator chunk boundaries as travel graph nodes.

---

## STEP 7 — Implement Route Qualification

A traversed path may become `KNOWN` when:

- all included topology is Discovered or Understood as required;
- traversal dependencies are known;
- any critical Gate type is identified;
- the path is reproducible under current known rules.

A `KNOWN` route may become `RELIABLE` when:

- there is no unresolved Decision Gate;
- required capability/tool state is currently satisfiable;
- no known active threat makes auto-resolution unsafe;
- all segment state versions are current.

Exact thresholds are internal and must not be exposed as an experience bar.

---

## STEP 8 — Add Fray Reasons

```ts
type RouteFrayReason =
  | 'TOPOLOGY_CHANGED'
  | 'GATE_CHANGED'
  | 'KNOWN_THREAT_BLOCKING'
  | 'REQUIRED_TOOL_MISSING'
  | 'NEW_RECONTEXTUALIZATION'
  | 'COMBAT_DETECTION_RISK'
  | 'WORLD_EVENT_CHANGED_ROUTE'
  | 'UNKNOWN';
```

`UNKNOWN` is for internal fallback only and should not be shown as a generic player error if a concrete rule trace exists.

---

## STEP 9 — Add Travel Modes

```ts
type TravelMode = 'STRIDE' | 'VEIL' | 'SURVEY';

interface TravelModePolicy {
  mode: TravelMode;
  routeCostPolicy: RouteCostPolicy;
  threatPolicy: ThreatRoutePolicy;
  frontierPolicy: FrontierRoutePolicy;
  stopPolicy: TravelStopPolicy;
}
```

Internal route scoring may use numeric costs.

Player-facing UI must describe semantic differences only.

---

## STEP 10 — Implement STRIDE Solver Policy

Prioritize:

1. Reliable route;
2. fewer unresolved Gates;
3. shorter canonical known path;
4. deterministic tie-break.

Do not bypass known threat detection.

---

## STEP 11 — Implement VEIL Solver Policy

Use only known information.

Prioritize:

1. routes avoiding known threat-control/detection intersections;
2. Shelter Anchor adjacency where useful;
3. lower known exposure topology;
4. then path efficiency.

Hidden enemies contribute nothing until legitimately observed/known.

---

## STEP 12 — Implement SURVEY Solver Policy

Prioritize:

1. reliable known path toward selected Frontier/Promise;
2. adjacency to Observed/Unknown frontier where Scout rules allow observation;
3. Landmark/Frontier signal opportunities;
4. stop on significant newly revealed signal according to Scout/Discovery rules.

SURVEY must not reveal hidden content directly through planning.

---

## STEP 13 — Route Candidate Query API

```ts
interface KnownTravelQuery {
  startHex: HexCoord;
  destination: TravelDestination;
  mode: TravelMode;
  waypointAnchorId?: string;
  expeditionIntentId?: string;
  heroId: string;
}

interface KnownTravelPreview {
  routeId: string;
  mode: TravelMode;
  exactPath: HexCoord[];
  anchorSequence: string[];
  gateSequence: TravelGatePreview[];
  firstMandatoryStop?: TravelStopPreview;
  knownConsequences: SemanticConsequence[];
  requiredCapabilities: CapabilityRequirement[];
  isCommitLegal: boolean;
  invalidReason?: SemanticRuleTrace;
}
```

Preview and execution must use the same queryable rules.

---

## STEP 14 — Materially Distinct Route Filtering

When generating up to three route options:

- deduplicate routes with equivalent meaningful Gate sequence;
- deduplicate paths whose only difference is trivial hex geometry;
- prefer options that differ in at least one of:
  - threat exposure;
  - tool Gate;
  - Shelter access;
  - Frontier relation;
  - meaningful travel length;
  - resource/mystery requested stop.

If only one meaningful route exists, show one.

---

## STEP 15 — Add Expedition Intent Model

```ts
type ExpeditionIntentType =
  | 'REACH_LANDMARK'
  | 'REACH_FRONTIER'
  | 'FIND_RESOURCE'
  | 'REVISIT_INSIGHT'
  | 'ENTER_LOCATION'
  | 'WORLD_TASK';

interface ExpeditionIntent {
  id: string;
  type: ExpeditionIntentType;
  knownTargetEntityId?: string;
  resourceTypeId?: string;
  questionId?: string;
  playerPinned: boolean;
}
```

Intent is optional.

It must only use player-known data.

---

## STEP 16 — Camp Expedition Planning Controller

Entry condition:

- Hero is at valid Camp departure context.

Flow:

1. optional Intent selection;
2. destination/frontier selection;
3. route candidate query;
4. Travel Mode selection;
5. relevant capability checks;
6. commit.

Do not require a full-screen modal if contextual Player Board can support the flow.

---

## STEP 17 — Tool/Hand State Validation

Travel preview must query the same inventory/equipment state used by interaction logic.

Examples:

```ts
interface CapabilityRequirement {
  capabilityId: CapabilityId;
  source?: 'HELD_TOOL' | 'BAG_ITEM' | 'SCOUT' | 'WORLD_STATE';
  satisfied: boolean;
}
```

Do not fake tool possession based on unlocked recipes or historical possession.

---

## STEP 18 — Implement Accelerated Travel Executor

```ts
interface KnownTravelCommand {
  commandId: string;
  heroId: string;
  previewRouteId: string;
  expectedWorldVersion: number;
}
```

Execution loop:

1. revalidate preview against current world version;
2. begin route;
3. advance along exact canonical path;
4. compress presentation through Reliable spans;
5. process travel/world simulation transitions;
6. before each Decision Gate, evaluate stop policy;
7. stop on first mandatory interruption;
8. materialize Hero at exact hex;
9. emit semantic trace;
10. preserve remaining valid route as optional continuation.

---

## STEP 19 — Add Journey Beat Integration With Living World

Do not call full manual World Pulse for every skipped hex.

Define internal travel progression:

```ts
interface JourneyBeat {
  reason: 'REGION_TRANSITION' | 'ANCHOR_CROSSING' | 'TIME_GATE' | 'MODE_RULE';
  worldAdvanceKey: string;
}
```

At each Journey Beat:

- advance eligible remote/coarse simulation;
- materialize local consequences only if they can affect the current route;
- preserve determinism;
- revalidate future Gates.

Exact frequency is tunable internal data.

---

## STEP 20 — Decision Gate Evaluator

```ts
interface TravelGateEvaluation {
  gateId: string;
  resolved: boolean;
  shouldStop: boolean;
  reason?: SemanticRuleTrace;
  worldMutationVersion: number;
}
```

A Gate may auto-resolve only if:

- player already understands the rule;
- outcome is deterministic;
- no resource/choice is consumed without player consent;
- no meaningful alternative currently exists;
- no hidden information is revealed.

---

## STEP 21 — Frayed Route Mutation

When an edge becomes invalid:

1. mark only affected segment/edge Frayed;
2. store concrete cause;
3. invalidate dependent route previews;
4. keep unaffected Trail Imprint knowledge;
5. attempt known alternate route suggestion if legal;
6. never auto-reroute through a materially different decision without preview.

---

## STEP 22 — Combat Detection During Travel

Before moving Hero through each detection-relevant point:

- execute same detection query used by manual traversal;
- if combat triggers, stop immediately;
- Hero hex must match exact detection location;
- switch to combat state without position reset;
- remaining travel command becomes suspended/cancelled according to combat flow.

Acceptance:

manual and accelerated traversal of same world state must produce equivalent detection result.

---

## STEP 23 — Frontier Transition

At `FRONTIER` Gate:

- accelerated travel always ends;
- normal Frontier Exploration becomes active;
- Hero retains exact world position;
- route behind remains available as Return Thread;
- Scout Frontier Reading rules become active.

Do not auto-generate a movement route through Unknown territory.

---

## STEP 24 — Source Anchor Stop

For v0.1 Source Anchor behavior:

- route can stop at known Medicinal Source if explicitly selected/Intent-targeted;
- resource is not auto-collected;
- normal Hand/Tool interaction is required;
- resource ecology availability is queried at stop time.

---

## STEP 25 — Mystery Recontextualization Stop

When `MemorySparkCreated` affects a location adjacent to/inside a known route:

- mark relevant segment with optional Mystery Gate;
- route preview shows Memory Spark only if player knows it;
- player can route past or stop;
- first recontextualization after new Insight should not be silently skipped by auto-travel.

---

## STEP 26 — Return Thread

When Hero leaves a Reliable Route into Frontier:

```ts
interface ReturnThreadState {
  originAnchorId: string;
  frontierEntryHex: HexCoord;
  knownReturnRouteId?: string;
  valid: boolean;
}
```

Return command:

- uses known route only;
- revalidates current world state;
- compresses solved return spans;
- stops on Fray/Decision Gate.

---

## STEP 27 — Scout Hooks

Expose capability hooks, not hardcoded level checks.

```ts
type TravelScoutCapability =
  | 'TRAIL_MEMORY'
  | 'WAYPOINT'
  | 'TRAIL_SENSE'
  | 'PULSE_SENSE'
  | 'FRONTIER_READING'
  | 'ROUTE_RECOVERY';
```

Starter implementation can enable only the capabilities currently approved in Scout progression.

---

## STEP 28 — Player Board Expedition Mode

Required UI state model:

```ts
interface ExpeditionBoardViewModel {
  intent?: ExpeditionIntentView;
  selectedDestination?: DestinationView;
  mode: TravelMode;
  routeOptions: KnownTravelPreviewView[];
  selectedRouteId?: string;
  relevantRequirements: CapabilityRequirementView[];
}
```

Rules:

- contextual only;
- no permanent route-management dashboard;
- Game Board remains dominant;
- route path itself carries most information.

---

## STEP 29 — Route Thread Rendering

Render states distinctly using shape/pattern, not only color:

- TRAVERSED;
- KNOWN;
- RELIABLE;
- FRAYED;
- selected preview.

Requirements:

- hidden when clutter threshold exceeded unless selected;
- route remains legible at map zoom levels used for planning;
- Frayed section must be spatially localized.

---

## STEP 30 — Travel Mode Token UI

Implement three reusable tokens:

- STRIDE;
- VEIL;
- SURVEY.

Interaction:

- select token in contextual Player Board;
- route preview recomputes immediately;
- selected mode has clear board-level effect;
- no card text wall.

---

## STEP 31 — Semantic Travel Rule Trace

Examples:

```text
STRIDE
→ Known Route selected
→ Broken Passage still open
→ Patrol does not intersect route
→ Route Reliable
```

```text
VEIL
→ East trail crosses known Patrol sight
→ Shelter trail avoids sight
→ Shelter route selected
```

```text
Known Travel
→ Bridge state changed
→ Route Frayed
→ Travel stops before Bridge
```

Trace must be generated from engine events, not separately reconstructed in UI.

---

## STEP 32 — Save/Load Contracts

Persist:

- RouteSegmentKnowledge;
- Anchors that are derived from persistent discoveries;
- player-created topology changes;
- Fray causes where still valid;
- Expedition Intent;
- Return Thread if session resumes mid-expedition;
- travel system version.

Do not rely on visual Route Thread cache as save truth.

---

## STEP 33 — Deterministic Resume During Travel

If save/load is allowed during accelerated travel:

Persist:

- command ID;
- exact current Hero hex;
- remaining canonical path;
- world version;
- processed Journey Beats;
- pending Gate.

Resume must not duplicate a Journey Beat or skip a Gate.

---

## STEP 34 — Travel Network Linter

Automated checks:

```text
NO_ROUTE_THROUGH_UNKNOWN
NO_BYPASSED_DECISION_GATE
NO_HIDDEN_THREAT_LEAK
NO_AUTO_RESOURCE_HARVEST
NO_MISSING_TOOL_ASSUMPTION
NO_COMBAT_BYPASS
NO_UNEXPLAINED_FRAY
NO_DUPLICATE_ROUTE_CHOICES
NO_DISCONNECTED_ACTIVE_ANCHOR
NO_MANUAL_REPEAT_REQUIREMENT_ON_STABLE_RELIABLE_ROUTE
```

Linter failures should surface generator/content IDs and semantic causes.

---

## STEP 35 — Starter Test Fixtures

### Fixture 1 — First traversal does not accelerate

Camp → Landmark path is Untraveled.

Expected:

- normal movement only;
- Trail Imprint records executed path.

### Fixture 2 — Reliable return

Same unchanged path after knowledge qualification.

Expected:

- Return Thread available;
- compressed traversal to Camp.

### Fixture 3 — Stone shortcut creation

Hero breaks Stone Crust.

Expected:

- topology opens;
- pathfinder updates;
- new segment can become Known/Reliable after traversal;
- future route options include it.

### Fixture 4 — Patrol differentiates STRIDE and VEIL

Known patrol intersects short path.

Expected:

- STRIDE may preview short path with required stop/risk Gate;
- VEIL selects alternate known shelter path if legal;
- hidden patrol data not used.

### Fixture 5 — Route Fray from topology change

Bridge becomes blocked before travel.

Expected:

- affected edge FRAYED;
- travel stops before bridge;
- semantic cause shown.

### Fixture 6 — Tool loss

Route requires Pickaxe Gate; Hero loses Pickaxe before Gate.

Expected:

- no passage bypass;
- stop before Gate.

### Fixture 7 — Combat equivalence

Manual and accelerated route cross same detection zone in identical state.

Expected:

- combat triggers on same hex.

### Fixture 8 — Frontier boundary

Known route ends at Frontier Anchor.

Expected:

- accelerated travel ends;
- Frontier Exploration activates;
- no route through Unknown.

### Fixture 9 — Resource Intent

Intent: Find Medicinal Plant; known Source Anchor exists.

Expected:

- source can be suggested using known data;
- arrival stops;
- no auto-harvest.

### Fixture 10 — Unknown resource location

Intent exists but no identified source.

Expected:

- no hidden coordinate leak;
- only known habitat/frontier clues may inform suggestion.

### Fixture 11 — Mystery recontextualization

New Insight affects old route.

Expected:

- Memory Spark appears;
- route can pause there;
- no forced quest objective.

### Fixture 12 — Journey Beat determinism

Run same route twice from same seeded world snapshot.

Expected:

- identical remote world advancement and interruptions.

### Fixture 13 — No duplicate route choices

Three geometric paths share identical meaningful Gate sequence.

Expected:

- UI does not show three fake choices.

### Fixture 14 — Return after discovery

Hero enters Frontier, discovers new Landmark, reconnects to known trail.

Expected:

- new network relation can be established from committed topology;
- previous return remains valid unless world changed.

### Fixture 15 — Save/load during travel

Save before Gate; reload.

Expected:

- no duplicated world advance;
- same Gate resolution.

---

# 36. Invariants

1. Every accelerated-travel Hero position is a legal canonical hex.
2. A route never crosses Unknown topology as Reliable.
3. A meaningful unresolved Gate is never silently skipped.
4. Manual and accelerated travel use identical traversal legality.
5. Manual and accelerated travel use identical combat detection rules.
6. Hidden threat information never influences player-visible route planning.
7. World state advances during accelerated travel according to deterministic Journey Beat rules.
8. Resources are never auto-harvested by travel.
9. Player-created topology changes affect pathfinding and travel network consistently.
10. Frayed state always has a recoverable semantic cause when known to the player.
11. Route Mode changes solver policy, not hidden game difficulty.
12. Scout capabilities change information/control, not only numeric speed.
13. No stable Reliable repeated route requires manual hex-by-hex traversal solely for friction.
14. Known Travel stops at Frontier.
15. Route previews and execution are generated from the same rule engine.

---

# 37. Telemetry

Record for playtest only:

```ts
interface KnownTravelTelemetryEvent {
  eventType:
    | 'ROUTE_PREVIEWED'
    | 'MODE_CHANGED'
    | 'ROUTE_COMMITTED'
    | 'TRAVEL_INTERRUPTED'
    | 'ROUTE_FRAYED'
    | 'FRONTIER_REACHED'
    | 'RETURN_TRAVEL_USED'
    | 'WAYPOINT_USED'
    | 'INTENT_SET'
    | 'MEMORY_SPARK_STOP'
    | 'MANUAL_TRAVEL_ON_RELIABLE_ROUTE';
  routeId?: string;
  mode?: TravelMode;
  reason?: string;
  anchorCount?: number;
  gateCount?: number;
}
```

Internal counts are telemetry, not player-facing combat/travel stats.

---

# 38. Performance Requirements

- KnownTravelPreview should be responsive enough for hover/select updates at prototype world scale.
- Cache graph topology only with world-version invalidation.
- Do not recalculate the entire world graph on every local mutation; invalidate affected regions/edges.
- Remote world simulation during travel must not instantiate full local AI for every remote entity.
- travel rendering must not require drawing all historical trail edges permanently.

---

# 39. Rollout Flags

Recommended feature flags:

```ts
knownTravel.enabled;
knownTravel.trailImprint.enabled;
knownTravel.routeThreads.enabled;
knownTravel.modes.stride;
knownTravel.modes.veil;
knownTravel.modes.survey;
knownTravel.expeditionIntent.enabled;
knownTravel.journeyBeats.enabled;
knownTravel.recontextualizationStops.enabled;
```

Allow playtest isolation of each layer.

---

# 40. Acceptance Criteria

Implementation is ready for design playtest when:

1. a manually traversed Camp→Landmark path can become a visible known Route Thread;
2. repeated unchanged traversal can be accelerated without teleporting;
3. Hero Token remains spatially grounded in the same hex world;
4. STRIDE/VEIL/SURVEY can produce distinct route behavior from known state;
5. a Stone Crust-created shortcut becomes usable by pathfinding and Known Travel;
6. a changed bridge/passage/patrol can Fray a route and stop travel before the issue;
7. World/Living simulation advances deterministically during compressed travel;
8. combat triggers identically for manual and accelerated traversal;
9. Frontier always ends accelerated travel;
10. resource Intent never reveals unknown coordinates and never auto-harvests;
11. Mystery recontextualization can mark an old route with optional Memory Spark;
12. return travel can compress solved movement back toward Camp;
13. UI uses board-level Route Thread/Anchor/Mode representations with no numeric risk dashboard;
14. all major invalid actions return concrete semantic explanations;
15. automated fixtures and invariants pass.

---

# 41. Implementation Completion Order Summary

Do not reorder the vertical-slice implementation into UI-first shortcuts.

Recommended delivery sequence:

**Route knowledge → Trail Imprint → Anchors/Gates → Travel Graph → Qualification/Fray → Mode solvers → Preview → Expedition Intent → Accelerated executor → Journey Beats → Gate interruption → Combat/Frontier/Resource/Mystery integration → UI/Game Kit → persistence → linter/tests/telemetry.**

---

# 42. Final Engineering Rule

> **Known Travel may optimize execution, never rules. If the manual world would ask the player a meaningful question, accelerated travel must reach that same question and stop.**

**End of Implementation Specification v0.1**
