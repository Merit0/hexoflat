# HEXOFLAT — World Pulse & Living World Director

**Version:** Candidate v0.1  
**Status:** Design Candidate — NOT canonical until approved/playtested  
**Parent systems:** `Hexoflat_Frontier_Exploration_and_Resource_Ecology_Candidate_v0.1.md`, `Hexoflat_Region_Grammar_Generator_Candidate_v0.1.md`, `Hexoflat_Resource_Ecology_and_Discovery_Rewards_Candidate_v0.1.md`  
**Primary design contract:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Audience:** Game Design, Product, UI/UX, Engineering, Claude Code

---

# 0. Canonical Compatibility and Explicit Candidate Decisions

This candidate preserves the Master Guide rules:

- **Position → Manipulate → Chain → Consequence**;
- **The World Is Discovered, Not Selected**;
- **Everything Important Is Represented**;
- **No Invisible State** for known decision-relevant information;
- **Enemies Are Behaviors, Not Stat Blocks**;
- **Progression Expands Possibility**;
- **Board First, UI Second**;
- **Smallest Sufficient Representation Wins**;
- **Anti-Friction Rule**;
- preview/execution should rely on the same game-state rules;
- player-facing core state should prefer discrete states/tokens over abstract bars.

This candidate introduces the following **new, non-canonical until approved** decisions:

1. **Gather Will advances one local World Pulse.**
2. World Pulse is the main tempo at which exploration threats and local world signals respond.
3. The world is not fully simulated at equal fidelity everywhere. It uses **Local Detailed Simulation + Remote Coarse Simulation**.
4. Player actions can leave **World Signals** such as Noise or Disturbance that other systems can react to.
5. Known nearby actors can expose **Behavior Intent** before a Pulse, while hidden actors remain hidden unless perception rules reveal them.
6. Every Pulse has a **Response Budget**: the director should prefer a few meaningful consequences over many simultaneous micro-updates.
7. The Living World Director is not allowed to fabricate arbitrary punishment. Every response must have a traceable cause, source and legal route.
8. A Pulse can create opportunity as well as danger.
9. Routine world updates must not open a separate mini-game or management screen.
10. Resource recovery is **not** tied directly to every Gather Will; ecology recovery uses a slower World Cycle or authored/systemic conditions.

---

# 1. Experience Promise

Hexoflat should make the player feel:

> **“The world does not wait for me, but it also does not cheat. I can see what I disturbed, understand what may react, choose where to regain my Will, and learn to make the world’s response work for me.”**

The intended player thought is not:

> “I clicked Rest, so the game moved every NPC randomly.”

It is:

> “I broke that stone wall loudly. The patrol heard it. If I Gather Will here, it may investigate the new passage. I can hide, lure it away, or use the opening before it arrives.”

The system exists to make **where and when the player ends a movement burst matter**.

---

# 2. Signature Loop

The candidate exploration tempo becomes:

**Observe → Plan Route → Commit Burst → Interact / Manipulate → Leave Signals → Choose End Position → Gather Will → Preview Known Response → World Pulse → Read Consequence → Continue**

Example:

1. Hero sees a Stone Crust blocking a short route.
2. Hero moves adjacent and uses Pickaxe.
3. Stone Crust becomes Broken Passage.
4. A visible **Noise Signal** appears.
5. The passage immediately changes pathfinding.
6. Hero uses remaining Shift to move behind nearby cover.
7. Will is Dispersed.
8. Hero selects **Gather Will**.
9. Known preview shows that a visible patrol is likely to investigate the Noise.
10. Pulse resolves.
11. Patrol changes route toward the disturbance.
12. The new passage is now useful to both Hero and patrol.
13. Hero starts the next burst from a position chosen specifically for this response.

This creates:

**Manipulate → Signal → Response → New Position Problem**.

---

# 3. World Pulse Is Not “A Turn for Everything”

A World Pulse is a **local causal update**, not a global board reset.

The system must avoid:

- moving every creature on the entire world map at full detail;
- changing many unrelated hexes every Pulse;
- random events with no visible source;
- spawning enemies next to the Hero because a difficulty meter says so;
- regenerating resources every time the Hero Gathers Will;
- forcing the player to inspect a log after every Pulse.

Instead, each Pulse asks:

1. What locally relevant world entities currently have a reason to act?
2. What signals are they able to perceive?
3. What known intent can the player reasonably understand?
4. Which few consequences most strongly affect the next decision?
5. Which remote updates can be simulated coarsely or deferred?

---

# 4. Two Time Scales: Pulse vs World Cycle

This distinction is mandatory.

## 4.1 World Pulse

Short exploration tempo.

Triggered in v0.1 primarily by:

- **Gather Will**.

Possible later triggers may be explicitly authored, but should remain rare.

World Pulse handles:

- local patrol movement;
- Noise propagation/decay;
- investigation/attention changes;
- local temporary effects;
- local threat intent changes;
- immediately relevant moving opportunities;
- coarse off-screen actor progression.

## 4.2 World Cycle

Slower ecological/campaign time.

World Cycle handles future systems such as:

- renewable resource recovery;
- migration between distant regions;
- long-lived world events;
- Camp/world growth;
- weather-front changes where approved;
- authored world-state progression.

**Gather Will must not equal World Cycle.**

This prevents a stationary player from farming renewable sources by repeatedly Gathering Will.

---

# 5. Local Detailed Simulation + Remote Coarse Simulation

The Living World Director uses two simulation fidelities.

## 5.1 Active Local Bubble

Detailed simulation applies to entities that are relevant to the current Game Board view / local frontier.

Candidate criteria include:

- within a configurable hex radius of Hero;
- connected to a signal the Hero caused;
- visible/Observed by Hero;
- part of the current Region Grammar proposition;
- on a route that can intersect the Hero soon.

Detailed actors have:

- exact hex position;
- local path;
- behavior state;
- perceived signals;
- known/hidden intent state;
- legal movement/interactions.

## 5.2 Remote Coarse Layer

Distant actors do not need full per-hex AI.

They may store:

- current Region/Anchor;
- coarse goal;
- travel connection;
- estimated progress along connection;
- behavior state;
- next coarse update eligibility.

When they approach the Active Local Bubble, the system deterministically materializes a legal detailed position consistent with the coarse state.

### Design reason

The world should feel persistent without consuming design/CPU complexity on activity the player cannot perceive.

---

# 6. World Signals — The Language of Cause and Response

The first version must stay minimal.

## 6.1 Starter Signal: Noise

Noise represents an audible disturbance in the world.

Potential sources:

- Pickaxe breaking Stone Crust;
- falling tree;
- certain combat actions;
- authored objects;
- future loud tools.

Noise is represented physically on the board when it is known to the player.

Noise has **qualitative reach**, not a permanent numeric meter on the HUD.

Candidate bands:

- **Local** — only adjacent/very close listeners can react;
- **Carrying** — reaches a meaningful nearby route/area;
- **Echoing** — exceptional, region-scale signal.

The engine may use numeric radius internally, but the player-facing language is qualitative unless literal hex-count preview is naturally useful in the current context.

## 6.2 Starter Signal: Disturbance

Disturbance represents a persistent change worth investigating or remembering.

Examples:

- Broken Passage;
- felled tree;
- disturbed resource patch;
- opened ruin mechanism.

Unlike Noise, Disturbance can remain after Noise fades.

A patrol can later notice the new passage even if it did not hear the original break, provided its behavior/perception allows it.

## 6.3 Future Signals — not in v0.1

Possible later candidates:

- Scent/Trail;
- Light;
- Blood;
- magical/spiritual resonance;
- smoke;
- faction evidence.

Do not add them until Noise + Disturbance prove fun and readable.

---

# 7. Threat Behavior Identity in Exploration

World threats must not act as generic “enemy moves toward player” agents.

Each exploration threat archetype needs a **World Behavior Identity**.

Starter examples:

## 7.1 Patrol

Default priorities:

1. continue known patrol route;
2. investigate perceived Noise if behavior permits;
3. inspect persistent Disturbance when encountered;
4. detect Hero according to visibility rules;
5. if combat begins, hand control to Combat rules.

## 7.2 Watcher / Sentry

Priorities:

1. hold observation point;
2. rotate/shift observation pattern where rules support it;
3. react strongly to movement/Noise in watched area;
4. may alert another threat rather than approach.

## 7.3 Scavenger / Resource-Seeker — later

Could compete for certain world resources rather than primarily hunting the Hero.

This is deliberately deferred until the basic loop works.

### Rule

The threat’s purpose must be understandable as behavior, not a hidden difficulty bonus.

---

# 8. Known Intent vs Hidden World State

The Master Guide requires known decision-relevant state to be represented, but does not require hidden information to be revealed.

Therefore:

## If the threat is Discovered/Observed and behavior is readable

The player may see a compact **Intent Marker**, for example:

- Continue Patrol;
- Investigate Noise;
- Watch Passage;
- Return to Post.

The exact destination may be shown only if the hero’s knowledge supports it.

## If the threat is hidden

No intent marker is shown.

The Hero may instead observe indirect signals:

- tracks;
- sound;
- moving silhouette;
- disturbed vegetation;
- warning from Scout capability.

## If a hidden threat reacts to player-caused Noise

The player is allowed to know that the Noise was emitted and its known qualitative reach, but not the exact hidden actor response unless observed.

This preserves uncertainty without making the system feel arbitrary.

---

# 9. Pulse Preview — “Known Consequences Only”

Gather Will should support a lightweight preview.

The preview is **not a modal planning screen**.

When the player focuses/holds/selects Gather Will, the board can show:

- visible patrol intent arrow/marker;
- Noise signal reach or active edge;
- temporary effect expected to expire;
- obvious route consequence;
- a warning if the current hex is openly exposed to a known threat.

It must not reveal:

- hidden enemies;
- hidden random rolls;
- secret region contents;
- future authored events the Hero cannot know.

The goal is:

> **“I understand the consequences I have earned the right to know.”**

---

# 10. Response Budget — The Anti-Chaos Rule

A living world is not more convincing because ten things move at once.

Each local World Pulse receives a **Response Budget**.

The director scores eligible responses by:

- causal strength;
- proximity to Hero/current route;
- tactical relevance;
- novelty;
- readability;
- whether the response completes or advances an existing world proposition.

Then it executes a small number of meaningful detailed responses.

### Starter target

For v0.1, a normal Pulse should usually produce:

- **0–2 meaningful local changes** visible or immediately relevant to the Hero;
- plus any trivial/visual updates that do not require decision attention.

This is a design target, not a hard universal limit.

### Anti-dogpile rule

If several actors hear the same Noise, the director should not automatically route every one of them to the exact Hero-adjacent area unless their authored behavior and region proposition explicitly justify it.

Possible responses:

- one patrol investigates;
- another becomes alert at its post;
- another ignores it due to distance/priority.

---

# 11. Fairness Constitution for Living World Responses

The Living World Director must obey all of the following.

## 11.1 No Causeless Punishment

A threat cannot materialize beside the Hero solely because the director wants tension.

## 11.2 No Impossible Teleportation

Actors must have a legal route, connection or authored transition.

## 11.3 No Unavoidable Pulse Trap by Default

The director should reject or soften a generated state where:

- Hero must Gather Will;
- all legal adjacent exits are guaranteed lethal/forced-combat outcomes;
- the player had no prior signal, readable mistake or intentional risk that caused it.

Authored high-danger scenarios can override this only explicitly.

## 11.4 No Hidden Rule Change

A Patrol does not suddenly gain a new perception rule because the player is doing well.

## 11.5 Hidden Does Not Mean Random

Hidden actors still use deterministic/seeded behavior rules. The player simply lacks information.

## 11.6 Opportunity Must Also Move

Not every Pulse exists to worsen the Hero’s state.

Possible positive/neutral responses:

- patrol leaves a guarded route;
- moving creature exposes a resource clue;
- fog/smoke condition clears later;
- a threat investigates Noise away from another path;
- an opening becomes temporarily safer.

This lets mastery include **using the Pulse**, not merely surviving it.

---

# 12. The World Pulse as a Player Tool

The system becomes interesting only when the player can intentionally exploit it.

Examples:

## 12.1 Noise Lure

Hero creates Noise near Route A, hides/relocates, Gathers Will, patrol investigates Route A, Hero takes Route B.

## 12.2 Passage Trap

Hero breaks a shortcut knowing a patrol may later use it, then prepares terrain/combat position around that opening.

## 12.3 Safe Timing

Hero observes a patrol about to leave a narrow crossing, Gathers Will in cover, lets the Pulse advance it, then crosses.

## 12.4 Resource Timing

Hero waits for a visible moving threat to leave a habitat before harvesting.

The desired mastery is:

> **“I can predict and manipulate the rhythm of the world.”**

---

# 13. Gather Will — Candidate Interaction

Gather Will is a major exploration action, but must remain low-friction.

## 13.1 Preconditions

Candidate v0.1:

- Hero’s Will state is `DISPERSED`;
- Hero is not currently resolving an interaction/movement animation;
- combat has not begun;
- local rules do not explicitly forbid Gather Will.

## 13.2 Player Verb

Player activates the **Will Sigil** on Player Board or equivalent contextual representation.

Board shows known Pulse Preview.

Commit resolves:

1. Hero begins brief Gather Will animation/state;
2. World Pulse resolves;
3. visible consequences animate in a concise ordered sequence;
4. Hero Will becomes `GATHERED`;
5. next movement burst becomes available.

## 13.3 Not Sleep / Not Camp Rest

Gather Will is not full recovery.

It does not automatically:

- heal Vitality;
- repair equipment;
- restore consumed items;
- regenerate resources;
- reset enemies.

Those belong to their own systems.

---

# 14. Will State Representation

Candidate minimal state machine:

**GATHERED → COMMITTED → DISPERSED → GATHERING → GATHERED**

Player-facing representation should avoid a numeric energy bar.

Suggested Game Kit object:

### Will Sigil

Represents Hero’s current readiness to begin a full exploration burst.

Possible visual states:

- **Gathered** — coherent/complete sigil;
- **Committed** — active/glowing while burst is being used;
- **Dispersed** — visually separated/fractured pieces;
- **Gathering** — pieces drawing together during Pulse resolution.

Final art is not fixed.

---

# 15. Noise Representation

Noise must exist on the **Game Board**, not as a permanent HUD meter.

Recommended primitive:

### Echo Ring / Noise Ripple Marker

- centered on source hex/object;
- visually expands/fades according to qualitative reach;
- disappears when no longer decision-relevant;
- can show one of a small number of shape/ring states for Local / Carrying / Echoing;
- color must not be the only information channel.

The player can long-press/hover for explanation:

> “This disturbance may be heard by nearby threats able to perceive Noise.”

Do not show a giant alert meter.

---

# 16. Disturbance Representation

Disturbance normally uses the changed world object itself.

Examples:

- Stone Crust visually becomes Broken Passage;
- Tree becomes Felled/cleared state;
- Resource patch becomes Harvested/Disturbed state.

A separate Disturbance Marker should be added **only** when the physical transformation does not sufficiently communicate that an actor may inspect it.

Smallest sufficient representation wins.

---

# 17. Exploration-to-Combat Transition

A World Pulse can cause detection.

Example:

1. Hero ends burst behind partial cover.
2. Noise attracts patrol.
3. Gather Will commits Pulse.
4. Patrol enters detection position.
5. Hero becomes detected according to canonical visibility rules.
6. Exploration movement resolution stops.
7. Board transitions to Combat state/red combat framing.
8. Current exact hex topology, terrain, hand-held tools/weapons and actors are preserved.
9. Combat Turn system takes over.

Do not teleport Hero or enemy to a separate arbitrary battle layout.

The exploration decision created the combat opening position.

---

# 18. Living World + Region Grammar Integration

Every Region Grammar may declare World Pulse hooks.

Example contract:

| Region Grammar       | Pulse Proposition                                          |
| -------------------- | ---------------------------------------------------------- |
| Patrol Funnel        | patrol alternates between two route anchors                |
| Shelter Chain        | exposed intervals become safe if patrol advances           |
| Resource Lure        | threat occasionally leaves/returns to habitat              |
| Broken Corridor      | breaking shortcut creates Noise and a new enemy route      |
| Landmark Ring        | Watcher changes observed arc/attention                     |
| Crossroads With Cost | one route becomes temporarily occupied while another opens |

A Region Grammar should not add dynamic behavior merely because the director exists.

Dynamic hooks are used only when they create a meaningful timing/route decision.

---

# 19. Living World + Resource Ecology Integration

Resource systems interact with Pulse carefully.

## During a Pulse

Allowed starter interactions:

- threat moves relative to resource habitat;
- Noise from harvesting influences threat behavior;
- disturbed source remains visible;
- a moving actor can expose or obscure a clue.

Not allowed by default:

- harvested plant instantly regrows;
- random resource relocations every Pulse;
- resource quantity changes without a world rule;
- generic “loot respawn”.

Resource recovery belongs to World Cycle/systemic source rules.

---

# 20. Living World + Scout Progression

Scout should progressively increase **legibility and manipulation**, not only movement distance.

Possible candidate abilities:

## Scout — Awareness

Interrupt movement when significant new information appears.

## Scout — Echo Reading

When Noise is created, classify whether known nearby threat routes can plausibly hear it.

Does not reveal hidden actors.

## Scout — Pulse Sense

Before Gather Will, show one additional known consequence from an Observed threat/temporary effect.

## Scout — Trail Reading

Recognize whether a persistent Disturbance is likely to attract a known threat archetype.

## Scout — Timing Marker

Place one Waypoint/Intent marker to remember a planned position after the next Pulse.

Names and progression order remain candidate.

---

# 21. Living World Director Decision Model

The director is not an AI “storyteller” allowed to invent arbitrary events.

It is an **orchestrator of legal systemic responses**.

For each Pulse:

1. collect pulse-eligible entities/signals/effects;
2. query their canonical behavior rules;
3. generate legal response candidates;
4. score candidate relevance/readability;
5. apply Response Budget;
6. resolve selected detailed responses deterministically;
7. advance coarse remote simulation;
8. materialize newly relevant remote entities if legal;
9. emit semantic Rule Trace events;
10. update visibility/discovery;
11. check detection/combat transition;
12. finish Gather Will.

The director may decide **which eligible response gets presentation priority**, but it may not change the underlying rules to manufacture difficulty.

---

# 22. Semantic Rule Trace

Every important Pulse consequence needs a concise causal trace.

Examples:

`Pickaxe → Stone Crust breaks → Carrying Noise created → Patrol hears Noise → Patrol investigates passage`

`Gather Will → Patrol continues route → Watch arc leaves crossing → route becomes temporarily clear`

`Tree felled → Disturbance remains → patrol later discovers new opening`

This trace supports:

- player explanation;
- QA;
- automated tests;
- bug reports;
- telemetry diagnosis.

---

# 23. UI/UX Layers

## Glance Layer

Only show:

- Hero;
- Will Sigil state;
- visible/Observed threats;
- currently relevant Noise ripple;
- critical terrain/world state;
- compact visible threat Intent markers when applicable.

## Decision Layer

When previewing route / Gather Will / Tool interaction:

- route preview;
- known consequence markers;
- Pulse preview arrows/intent;
- Noise reach preview when relevant;
- valid interaction choices.

## Explanation Layer

On demand:

- “Why did this patrol move?”;
- behavior identity;
- Noise rule;
- semantic Rule Trace;
- Will/Pulse rule.

No permanent World Director panel.

---

# 24. Game Kit Additions

## 24.1 Will Sigil

| Field          | Definition                                 |
| -------------- | ------------------------------------------ |
| Represents     | exploration readiness / current Will phase |
| Player Verb    | Gather Will / inspect                      |
| States         | Gathered, Committed, Dispersed, Gathering  |
| Source         | Hero Player Board                          |
| Sink           | never removed in normal play               |
| Reusable       | global Hero system                         |
| UI Form        | compact sigil/token                        |
| UI Explanation | state animation + contextual hint          |

## 24.2 Echo Ring / Noise Ripple

| Field          | Definition                                |
| -------------- | ----------------------------------------- |
| Represents     | known audible world signal                |
| Player Verb    | inspect; indirectly create/manipulate     |
| States         | Local, Carrying, Echoing, fading/resolved |
| Source         | loud action/event                         |
| Sink           | Pulse decay/resolution                    |
| Reusable       | global world signal primitive             |
| UI Form        | transient board overlay/marker            |
| UI Explanation | hover/long press                          |

## 24.3 Threat Intent Marker

| Field          | Definition                                     |
| -------------- | ---------------------------------------------- |
| Represents     | currently readable exploration behavior intent |
| Player Verb    | inspect / plan around                          |
| States         | Patrol, Investigate, Watch, Return, etc.       |
| Source         | observed threat behavior                       |
| Sink           | threat hidden / intent changes / combat begins |
| Reusable       | enemy/world AI primitive                       |
| UI Form        | tiny marker/arrow, not a card                  |
| UI Explanation | icon + short contextual label                  |

A separate Disturbance token is **not** mandatory if changed terrain already communicates the state.

---

# 25. Anti-Friction Rules

1. No confirmation dialog for every Pulse if the intent is already clear.
2. Gather Will uses one direct player action.
3. Pulse animation must be fast; unrelated remote activity is not animated.
4. Multiple non-conflicting local updates can animate simultaneously.
5. The player can accelerate/skip non-critical Pulse animations.
6. The board should settle into a readable state before the next route decision.
7. Do not surface an event log unless the player asks for explanation.
8. Do not add a “world activity meter”.
9. Do not force the player to acknowledge every Noise/Disturbance event.

---

# 26. Failure and Fallback Behavior

## No eligible world response

Pulse still resolves and Will gathers. Do not fabricate an event.

## Threat route becomes invalid

Threat uses its Behavior Identity fallback:

1. attempt same goal via legal alternate route;
2. return to default patrol/anchor behavior;
3. remain in place if no legal behavior exists.

## Materialization conflict

If a remote actor cannot legally materialize in its expected local area:

- search deterministic nearby legal anchor positions consistent with the coarse route;
- if none exist, keep actor coarse and retry on a later Pulse;
- never teleport into an occupied/illegal Hero-adjacent hex.

## Gather Will becomes invalid during preview

Cancel preview and explain the concrete reason.

## Pulse causes combat

Stop remaining exploration-only updates that would conflict with combat state, preserve queued coarse updates for later if appropriate, and transfer to Combat Controller.

---

# 27. Procedural Generation Requirements

Region generation that uses dynamic threats must define:

- threat anchor(s);
- legal patrol/investigation graph;
- at least one Hero-readable timing proposition if timing is core to the region;
- safe/neutral fallback state;
- no-spawn/no-materialization exclusions around Camp/critical authored objects;
- whether Noise can alter the threat route;
- whether topology mutation can open threat routes;
- linter proof that the region cannot trivially soft-lock due to one mandatory Pulse.

---

# 28. World Pulse Linter Rules

Reject or flag content when:

1. mandatory Gather Will can create unavoidable combat with no prior readable cause;
2. threat has no legal fallback path;
3. two hidden actors can materialize into the same hex;
4. a Pulse can permanently seal the only route to Camp without an authored recovery rule;
5. Noise response has no listener/perception cause;
6. topology mutation produces an actor route through a still-blocked hex;
7. resource source can regenerate by repeated Gather Will alone;
8. more than the configured meaningful-response budget is routinely exceeded;
9. observed intent is shown but the execution uses a different rule without a world-state change;
10. remote-to-local materialization changes actor identity/state inconsistently;
11. an actor moves through Unknown/non-generated topology without a valid coarse connection;
12. the player cannot distinguish Pulse-caused terrain change from a bug or visual refresh.

---

# 29. Starter Vertical Slice

Do **not** implement a general ecosystem first.

The v0.1 playable slice should contain:

### World

- Camp Anchor;
- one irregular frontier region;
- one Stone Crust shortcut;
- one sheltered alternate route;
- one resource habitat;
- one patrol route.

### Hero

- existing movement/path preview;
- Scout route limit;
- Pickaxe;
- Hand;
- Will Sigil.

### Dynamic systems

- Gather Will → World Pulse;
- one Patrol behavior;
- Noise from Pickaxe;
- Disturbance from Broken Passage;
- patrol can investigate Noise;
- patrol can use the newly opened passage if legal;
- observed patrol intent preview;
- detection can transition into existing Combat prototype.

### Test proposition

The region must support at least these distinct solutions:

1. take long safe route and avoid making Noise;
2. break shortcut, hide, use Pulse to let patrol investigate away from another route;
3. break shortcut and intentionally accept/prepare for combat from a strong position.

If the same optimal solution dominates every seed/playtest, redesign before expansion.

---

# 30. Playtest Hypotheses

The candidate is successful only if players demonstrate that:

1. they intentionally choose where to Gather Will;
2. they can explain why a visible patrol changed behavior;
3. they sometimes use Noise intentionally rather than only avoiding it;
4. the Pulse creates tension without feeling like random punishment;
5. players understand that a Broken Passage can benefit enemies too;
6. players do not feel forced to wait through world animations;
7. the world feels active even with very few simulated actors;
8. players prefer two or three meaningful responses over many trivial events;
9. the system improves route decisions before combat rather than merely creating more combat;
10. Scout information feels like mastery, not an omniscient cheat overlay.

---

# 31. Telemetry for Playtest

Capture:

- Gather Will location and context;
- number of Pulses per expedition;
- visible responses per Pulse;
- response categories;
- Noise sources and whether they were intentional;
- patrol investigations caused by Noise;
- player route changes after Pulse preview;
- combat starts caused by Pulse;
- combat starts preceded by readable warning vs surprise;
- uses of Broken Passage by Hero vs threats;
- Pulse animation skip rate;
- times player opens Rule Trace after Pulse;
- repeated Gather Will attempts while stationary;
- regions/seeds producing mandatory or degenerate waiting.

No telemetry metric should silently change rules during play.

---

# 32. Research-Derived Design Guardrails

These are supporting research observations, not replacements for the Master Guide.

## Rain World lesson

Autonomous creatures that pursue their own needs can make a world feel alive, but unconstrained autonomy can also generate unfair or frustrating states. Hexoflat therefore uses **bounded local responses and fairness linting** rather than maximal simulation.

## S.T.A.L.K.E.R. A-Life lesson

A world can preserve the impression of persistent actors without running full detailed simulation everywhere. Hexoflat therefore separates **local detailed behavior** from **remote coarse progression**.

## Systemic-world lesson

The strongest interactions emerge when one world rule changes the meaning of another. Hexoflat therefore treats Noise, topology, patrol routes, resources and Hero positioning as mutually connected state rather than isolated scripted triggers.

## Readability lesson

The player should be able to act on known intent. Hexoflat therefore exposes readable local intent where the Hero has sufficient information while preserving genuine hidden information behind Fog/perception rules.

---

# 33. Definition of Done for Candidate Approval

This system is ready to be considered for canonical approval when:

- the starter vertical slice is playable;
- three or more seeds produce meaningfully different route/timing decisions;
- players intentionally manipulate at least one Pulse response;
- no tested seed produces unavoidable Pulse-caused soft-lock without authored cause;
- visible threat intent matches execution;
- Noise/Disturbance are readable without permanent HUD clutter;
- Gather Will does not feel like a disguised “skip turn” button;
- resource farming cannot be accelerated by stationary Pulse spam;
- remote simulation produces consistent local materialization;
- combat transition preserves exact exploration state;
- telemetry indicates Pulse animation does not create recurring friction;
- the candidate is explicitly approved and merged into the Master Guide.

---

# 34. Final Candidate Rule

> **The World Pulse should make the world answer the player’s actions, not interrupt them with random activity.**

A good Pulse creates a new tactical question.

A bad Pulse creates bookkeeping, noise, or punishment without a readable cause.

The design target is:

**I act → the world notices → I understand what changed → I exploit the consequence.**

---

**End of Candidate v0.1**
