# HEXOFLAT — Expedition Risk, Return & Camp Consequence Loop

**Implementation Specification:** v0.1  
**Design status:** Candidate — do not promote to canonical without playtest approval  
**Parent design:** `Hexoflat_Expedition_Risk_Return_and_Camp_Consequence_Candidate_v0.1.md`  
**Primary design contract:** Hexoflat Master Design & Implementation Guide v1.0  
**Audience:** Claude Code / Engineering / QA / Game Design

---

# 0. Implementation Mandates

1. Reuse canonical Vitality, Protection, movement, Known Travel, World Pulse, Frontier and interaction state.
2. Do not add a universal numeric expedition-risk/energy/depth meter.
3. Continue/Return must be derived from actual state, not a scripted dialog requirement.
4. Return uses Known Travel acceleration and must stop at Decision Gates.
5. Never teleport through unresolved world state.
6. Ordinary gathered resources must not require Camp banking merely to become owned.
7. Critical Payload behavior is opt-in per content definition.
8. Defeat must not rewind persistent world topology/discovery by default.
9. Solo defeat fallback must not create permanent death.
10. Do not implement hunger, thirst, weather attrition, mounts, complex carrying weight or field shelters in v0.1.
11. UI must use existing Game Board + Player Board architecture and progressive disclosure.
12. Preview and execution must use canonical rule evaluators.
13. All recovery/return decisions must produce semantic Rule Trace events.
14. The vertical slice is complete before any Advanced Expedition module is started.

---

# 1. Exact Incremental Implementation Order

## STEP 1 — Add Expedition Session State

```ts
interface ExpeditionSessionState {
  expeditionId: string;
  originAnchorId: string;
  currentIntentId?: string;
  startedWorldVersion: number;
  visitedRegionIds: string[];
  discoveredEntityIds: string[];
  criticalPayloadIds: string[];
  status: 'ACTIVE' | 'RETURNING' | 'RECOVERING' | 'COMPLETED';
}
```

Do not store derived `riskScore`.

---

## STEP 2 — Define Expedition Pressure Facts

Pressure is semantic and derived.

```ts
type ExpeditionPressureFact =
  | { type: 'VITALITY_DAMAGED'; sourceId: string }
  | { type: 'PROTECTION_DAMAGED'; sourceId: string }
  | { type: 'CONDITION_ACTIVE'; conditionId: string }
  | { type: 'CAPABILITY_UNAVAILABLE'; capabilityId: string }
  | { type: 'RETURN_ROUTE_FRAYED'; routeId: string; reason: string }
  | { type: 'KNOWN_THREAT_ON_RETURN'; threatId: string }
  | { type: 'WORLD_SIGNAL_ACTIVE'; signalId: string }
  | { type: 'CRITICAL_PAYLOAD_CARRIED'; payloadId: string }
  | { type: 'FRONTIER_UNCERTAINTY'; frontierAnchorId: string };
```

Provide selectors:

```ts
getExpeditionPressureFacts(state): ExpeditionPressureFact[]
```

No weighted sum in v0.1.

---

## STEP 3 — Add Decision Horizon Detection

```ts
interface DecisionHorizon {
  id: string;
  hex: HexCoord;
  sourceType: 'FRONTIER' | 'LANDMARK' | 'GATE' | 'SHELTER' | 'PASSAGE';
  forwardPromiseIds: string[];
  returnRouteIds: string[];
}
```

A Decision Horizon is contextual. It does not force a popup.

---

## STEP 4 — Add Continue/Return Context ViewModel

The view model may be requested when the player selects the Hero, Frontier or Camp-return action.

```ts
interface ExpeditionDecisionViewModel {
  knownForwardPromises: PromiseSummary[];
  pressureFacts: ExpeditionPressureFact[];
  homewardRoutePreview?: TravelRoutePreview;
  canContinue: boolean;
  canReturn: boolean;
  blockingReasons: SemanticReason[];
}
```

Do not render a permanent expedition meter.

---

## STEP 5 — Integrate With Existing Route Preview

When `Return to Camp` is selected:

1. resolve Camp Anchor;
2. query Known Travel graph;
3. compute candidate route with current Travel Mode or default STRIDE;
4. mark Frayed segments;
5. display Decision Gates;
6. never cross Unknown topology;
7. never reveal hidden threats.

---

## STEP 6 — Add Return Command

```ts
interface BeginReturnCommand {
  expeditionId: string;
  destinationAnchorId: string;
  travelMode: 'STRIDE' | 'VEIL' | 'SURVEY';
  expectedWorldVersion: number;
}
```

Validation must use the Known Travel engine.

---

## STEP 7 — Return Execution State

```ts
interface ReturnJourneyState {
  routeId: string;
  currentSegmentIndex: number;
  status: 'ACCELERATING' | 'INTERRUPTED' | 'ARRIVED';
  interruptionReason?: SemanticReason;
}
```

Reuse accelerated travel executor.

---

## STEP 8 — Decision Gate Interruption

Return must stop before:

- Frayed topology;
- known active threat;
- changed traversal Gate;
- combat detection;
- Mystery Memory Spark requiring explicit stop policy;
- requested resource/source stop;
- unavailable required tool;
- Frontier/Unknown topology.

Emit:

```ts
ReturnInterrupted;
```

with semantic trace.

---

## STEP 9 — Add Critical Payload Contract

```ts
interface CriticalPayloadDefinition {
  id: string;
  entityType: string;
  representation: 'TOKEN' | 'CHARACTER' | 'OBJECT';
  carryRule:
    'INVENTORY_SLOT' | 'LEFT_HAND' | 'RIGHT_HAND' | 'BOTH_HANDS' | 'FOLLOWING_ENTITY' | 'CUSTOM';
  routeConstraints?: TraversalConstraint[];
  onDeliveredEffects: DomainEffect[];
  onDefeatPolicy: 'KEEP' | 'DROP_CACHE' | 'AUTHORED';
}
```

Do not convert routine stackable resources to Critical Payloads.

---

## STEP 10 — Validate Hand/Tool Holder Conflicts

Critical Payload carry state must query the same Hand Holder rules used by Sword/Shield/Tool interaction.

Example:

- both-hand artifact prevents Pickaxe use;
- shield cannot be equipped if the corresponding hand is occupied;
- UI preview explains the concrete conflict.

---

## STEP 11 — Add Expedition Completion Trigger

An expedition may complete when the hero reaches the origin Camp Anchor or another explicitly defined terminal Anchor.

```ts
ExpeditionReturnedHome;
```

must include:

- discovered region/entity IDs;
- route changes;
- current body/protection state;
- delivered Critical Payloads;
- relevant resource/system hooks;
- mystery/knowledge changes;
- world version.

No generic XP summary is required.

---

## STEP 12 — Homecoming Beat Builder

Build a compact list of **meaningful** changes only.

```ts
interface HomecomingBeat {
  entries: HomecomingEntry[];
}

type HomecomingEntry =
  | RouteMasteredEntry
  | LandmarkUnderstoodEntry
  | KnowledgeUnlockedEntry
  | CampSystemNowRelevantEntry
  | BodyRecoveryNeededEntry
  | CriticalPayloadDeliveredEntry
  | WorldConsequenceEntry;
```

Filter out:

- routine steps walked;
- every resource pickup;
- every World Pulse;
- generic “nothing changed” rows.

---

## STEP 13 — Camp Context Handoff

On Camp arrival:

- Game Board remains Camp;
- Player Board switches to Camp context;
- relevant Healing/Crafting/Companion hooks may become highlighted contextually;
- do not automatically open inventory, crafting or healing screens.

---

## STEP 14 — Downed Resolution Hook

Use Combat/Downed canonical state first.

```ts
interface ExpeditionDefeatContext {
  expeditionId: string;
  heroId: string;
  companionIds: string[];
  currentAnchorContext?: string;
  criticalPayloadIds: string[];
}
```

If tactical rescue remains legal, do not invoke expedition recovery.

---

## STEP 15 — Solo Will Break Candidate Fallback

Only if:

- hero is Downed;
- no legal rescue remains;
- encounter/expedition defeat is finalized;
- permanent death is not an authored exception.

Resolve:

1. select recovery Anchor;
2. preserve persistent world/discovery/topology state;
3. apply Exhausted/body consequences through canonical health state;
4. resolve Critical Payload defeat policies;
5. create recovery journey/result;
6. return control at recovery Anchor.

Do not remove routine resources by default.

---

## STEP 16 — Recovery Anchor Selection

```ts
selectRecoveryAnchor(state, hero): RecoveryAnchorResult
```

v0.1 priority:

1. Camp Anchor;
2. approved authored Shelter Anchor if future content explicitly enables it;
3. deterministic fallback to Camp.

No random spawn recovery.

---

## STEP 17 — Lost Cache Entity

Implement only if a v0.1 test content Critical Payload uses `DROP_CACHE`.

```ts
interface LostCacheEntity {
  id: string;
  hex: HexCoord;
  payloadIds: string[];
  sourceExpeditionId: string;
  discoveryState: 'KNOWN';
}
```

Do not create corpse caches for routine inventory.

---

## STEP 18 — Preserve World Mutation On Defeat

Invariant:

- broken Stone remains broken;
- discovered regions remain discovered;
- patrol/world state advances according to approved defeat resolution;
- Route Threads retain valid learned state;
- no automatic world rollback occurs.

---

## STEP 19 — Expedition Intent Resolution

When homecoming occurs, compare intent against semantic outcome.

```ts
interface ExpeditionIntentResolution {
  intentId: string;
  state: 'FULFILLED' | 'PARTIALLY_RESOLVED' | 'UNRESOLVED' | 'TRANSFORMED';
  reasonTrace: SemanticReason[];
}
```

Do not fail an intent because the player found a different meaningful discovery.

---

## STEP 20 — Add Homecoming Rule Trace

Examples:

`Broken Spire inspected → Trace understood → Fractured Stone knowledge unlocked`

`Stone Crust broken → Route traversed → Route Thread now Known`

`Artifact carried → Camp Anchor reached → Workshop interaction unlocked`

---

## STEP 21 — UI Glance Layer

Always/near-always visible state remains existing:

- Hero Token;
- Vitality/Protection;
- critical condition;
- carried Critical Payload if relevant;
- route/fog/world state on board.

No new permanent expedition panel.

---

## STEP 22 — UI Decision Layer

On route/frontier/return decision show contextually:

- homeward Route Thread;
- Frayed segment(s);
- known threats/gates;
- known forward Promise;
- current relevant tool/body conflicts;
- Continue / Return verbs where appropriate.

Do not show a weighted risk score.

---

## STEP 23 — UI Explanation Layer

Long press/details may explain:

- why route is Frayed;
- why Critical Payload blocks a tool;
- why recovery Anchor was selected;
- which discovery caused a Homecoming unlock.

---

## STEP 24 — Game Kit Objects

### Reuse

- Hero Token;
- Camp Token/Anchor;
- Route Thread / Trail Imprint;
- Vitality pieces;
- Protection pieces;
- Hand Holders;
- Tool Tokens;
- Resource Tokens;
- Threat/Noise markers;
- Landmark/Trace objects;
- Memory Spark.

### Candidate additions

#### Critical Payload Token

Use only where physical carrying materially changes decisions.

States:

- WORLD;
- CARRIED;
- DELIVERED;
- LOST_CACHE where policy allows.

#### Homecoming Spark

Prefer reusing existing discovery/memory marker language rather than inventing a new permanent object. Implement only if UX testing requires a visual arrival cue.

---

## STEP 25 — Save/Load

Persist:

- active expedition session;
- critical payload state;
- return journey interruption;
- Lost Cache where used;
- intent resolution state;
- world mutations and versions.

Resume must be deterministic.

---

## STEP 26 — Telemetry

Record without exposing to player:

- regions entered before return;
- pressure facts present when return chosen;
- pressure facts present when player pushed deeper;
- return interruptions and causes;
- manual vs accelerated known-route time;
- defeat location/type;
- Lost Cache recovery rate if tested;
- Homecoming interactions opened next;
- time from Camp arrival to next expedition readiness.

Do not optimize around maximizing session length.

---

# 2. Algorithms

## 2.1 Expedition Pressure Selector

Pressure facts are derived from canonical state.

Pseudo:

```ts
function getPressureFacts(state, expeditionId): ExpeditionPressureFact[] {
  const facts = [];
  facts.push(...bodyPressure(state));
  facts.push(...capabilityPressure(state));
  facts.push(...routePressure(state));
  facts.push(...worldPressure(state));
  facts.push(...payloadPressure(state));
  return dedupeSemanticFacts(facts);
}
```

Do not sort by hidden severity score for player-facing UI unless later approved. Contextual ordering may use category relevance.

---

## 2.2 Decision Horizon Detection

A horizon is emitted when a semantic topology/content transition exists.

Priority sources:

1. Frontier Anchor;
2. Landmark approach boundary;
3. major Gate/passsage;
4. safe known staging point before unresolved region.

Do not place horizons every N hexes.

---

## 2.3 Recovery Anchor Algorithm

For v0.1:

```ts
if (validApprovedShelter && contentAllowsRecovery) return shelter;
return camp;
```

No distance-based randomization.

---

# 3. Testing Fixtures

## Fixture A — Conservative Return

Hero resolves Region A with one damaged Vitality piece and chooses return before Region B.

Expected:

- no numeric risk meter;
- Return route preview shown;
- Reliable segment accelerated;
- Camp Homecoming includes relevant discovery/body state only.

## Fixture B — Push Deeper

Same initial state, Hero enters Region B for Landmark Promise.

Expected:

- system allows continue;
- no forced warning dialog;
- later return includes Region B consequences.

## Fixture C — Frayed Homeward Route

Known bridge changes during World Pulse.

Expected:

- Route Thread becomes Frayed;
- accelerated return stops before bridge;
- reason is concrete;
- alternate route can be selected if legal.

## Fixture D — Critical Payload Occupies Hand

Hero carries artifact in right hand.

Expected:

- right-hand Sword/Tool use blocked;
- UI explains payload conflict;
- route remains legal unless definition adds constraints.

## Fixture E — Routine Resource Does Not Force Banking

Hero gathers Medicinal Plant then continues exploring.

Expected:

- plant remains owned;
- no forced return prompt;
- Camp required only for downstream Healing/Crafting where designed.

## Fixture F — Solo Downed

Hero Downed, no companion, defeat finalized.

Expected:

- no permanent death;
- persistent topology/discovery remains;
- recovery resolves to Camp;
- hero returns Exhausted/body-damaged per health rules.

## Fixture G — Lost Cache Optional

Hero carries authored artifact with DROP_CACHE and is defeated.

Expected:

- artifact cache created;
- ordinary resources not dropped;
- cache becomes a future known decision.

## Fixture H — Homecoming Filtering

Expedition produced 30 low-level events and 4 meaningful changes.

Expected:

- Homecoming Beat shows only meaningful entries.

## Fixture I — World Not Rewound

Hero breaks Stone, discovers passage, then loses combat.

Expected:

- passage remains open after recovery;
- discovery remains known.

## Fixture J — No Pressure

Hero is healthy, route reliable, no threat, no critical payload.

Expected:

- system does not fabricate return pressure;
- player may continue freely.

---

# 4. Invariants

1. No player-facing universal expedition risk scalar exists in v0.1.
2. Continue/Return cannot depend on an invisible depletion timer.
3. Reliable return cannot skip an unresolved Decision Gate.
4. Return route cannot traverse Unknown topology as known.
5. Routine resources are not automatically lost on defeat.
6. Critical Payload rules are content-declared and visible.
7. World topology/discovery is not automatically rewound on defeat.
8. Solo Downed cannot create an unrecoverable campaign dead-end.
9. Homecoming does not automatically open a long management flow.
10. Camp remains a playable board.
11. No new permanent top bar or expedition dashboard is introduced.
12. Existing interaction grammar remains Tool/Token → world target → contextual verbs.

---

# 5. Generator / Content Linter Rules

Reject or warn on:

- Frontier sequence with no meaningful forward Promise;
- region chain where return has no readable route option unless authored intentionally;
- Critical Payload with no declared representation;
- Critical Payload blocking all legal return routes without authored fail-safe;
- Lost Cache policy on routine stackable resources;
- Homecoming entry with no downstream meaning;
- repeated forced return caused only by arbitrary scripted attrition;
- recovery Anchor unreachable/undefined;
- defeat rule that rewinds permanent topology unexpectedly.

---

# 6. Acceptance Criteria — Implementation

- [ ] Existing movement/pathfinding remains canonical.
- [ ] Expedition session state persists across save/load.
- [ ] Pressure facts are derived semantically with no player-facing risk number.
- [ ] Continue and Return remain player choices where legal.
- [ ] Return uses Known Travel acceleration.
- [ ] Return stops at Frayed route/Decision Gate.
- [ ] Critical Payload can occupy a physical carry representation.
- [ ] Ordinary resources do not require banking.
- [ ] Solo Downed fallback returns to valid recovery state without world rollback.
- [ ] Homecoming Beat filters routine event spam.
- [ ] Camp Player Board context activates without forced management menu.
- [ ] Telemetry records return reasons and route interruptions.
- [ ] All fixtures pass deterministically.

---

# 7. Mechanic Freeze Gate — Engineering Enforcement

After the above acceptance criteria pass, exploration v0.1 enters **MECHANIC_FREEZE**.

Engineering must not add new exploration subsystems merely because architecture makes them easy.

Blocked until playtest evidence exists:

- weather;
- hunger/thirst;
- mounts;
- complex carry weight;
- additional World Pulse signal families;
- advanced ecology;
- procedural quest generator;
- expanded route infrastructure;
- new resource categories beyond vertical-slice needs.

Any proposed addition after freeze must include:

```ts
interface MechanicExpansionProposal {
  observedPlaytestProblem: string;
  evidence: string[];
  proposedDecisionAdded: string;
  whyExistingMechanicsCannotSolveIt: string;
  uiGameKitCost: string;
  acceptanceHypothesis: string;
}
```

If `observedPlaytestProblem` is absent, the proposal is not a v0.1 blocker.

---

# 8. Definition of Done

Implementation is ready for playtest when:

1. one complete Camp → Frontier → deeper choice → Return → Camp loop works;
2. at least three expedition strategies are possible in the same fixture;
3. all important route/body/tool/payload state is readable;
4. returning is faster than first exploration but not teleportation;
5. Frayed routes correctly restore gameplay decisions;
6. defeat preserves meaningful world progress;
7. Homecoming is compact;
8. no additional survival subsystem is required to make the loop function;
9. telemetry can tell **why players return or continue**;
10. the build can be frozen and tested without another design dependency.
