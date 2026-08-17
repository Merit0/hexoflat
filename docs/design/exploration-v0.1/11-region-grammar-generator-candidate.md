# HEXOFLAT — Region Grammar Generator

**Version:** Candidate v0.1  
**Status:** Design candidate — requires playtest and explicit approval before canonical merge  
**Parent system:** Frontier Exploration & Resource Ecology Candidate v0.1  
**Primary source of truth:** Hexoflat Master Design & Implementation Guide v1.0  
**Audience:** Game Design, Product, UI/UX, Engineering, Claude Code

---

# 0. Canonical Compatibility and Explicit Boundaries

This candidate extends the approved Hexoflat principles without silently replacing them.

It preserves:

- the existing axial/hex grid and pathfinding implementation;
- Hero Token movement and route preview;
- blocked-hex traversal rules;
- physical Tool Token interaction grammar;
- Camp as a physical board/world anchor;
- `Unknown → Observed → Discovered → Understood` discovery direction;
- Scout as a movement/exploration mastery system;
- Board First UI;
- no-abstract-numbers player-facing philosophy;
- no-invisible-known-state rule;
- anti-friction rule;
- `Position → Manipulate → Chain → Consequence`;
- resources as physical/meaningful game objects rather than bookkeeping filler.

This candidate **reinterprets** procedural generation more strongly than the current Master Guide:

> The generator should not first generate geography and then sprinkle gameplay into it. It should first choose a gameplay proposition, then generate topology, terrain, signals, resources, threats, and persistent consequences that support that proposition.

This is a candidate design decision until approved through playtest.

---

# 1. Purpose

The Region Grammar Generator exists to solve the largest long-term risk of Hexoflat exploration:

> A procedurally different world can still feel mechanically identical.

The generator therefore does **not** optimize primarily for:

- number of unique hex arrangements;
- visual irregularity;
- map size;
- biome noise;
- maximum quantity of discoveries.

It optimizes for:

1. meaningful route decisions;
2. readable curiosity;
3. terrain agency;
4. changing resource motives;
5. persistent consequences;
6. emergent interaction between simple systems;
7. controlled novelty over a long campaign.

The intended feeling is:

> “I understand the rules of this world, but I do not yet know what situation the world will put me in next.”

---

# 2. Signature Exploration Formula

The canonical candidate exploration chain is:

**Signal → Curiosity → Route Choice → Commitment → Reveal → Manipulation → Resource / Knowledge → Persistent Consequence → New Possibility → Known Route**

A good region should ideally contribute to at least five links in this chain.

A region that only provides:

`walk → reveal fog → pick up item`

is not design-complete.

---

# 3. What a Region Is

A **Region** is an invisible procedural design primitive.

The player never sees:

- a region border;
- a region card;
- a region ID;
- a chunk seam;
- a “Region Complete” percentage.

A region exists only so the generator can reason about a coherent local situation.

A region contains:

- an entry frontier socket;
- one dominant player question;
- topology supporting that question;
- terrain grammar;
- at least one readable signal or landmark where appropriate;
- zero or more resources tied to the proposition;
- zero or more threats;
- one or more exits/frontier sockets;
- optional secret branch;
- one possible persistent world consequence.

The visible world must remain organic and continuous.

---

# 4. Region Proposition Contract

Every region must declare the following before any hex coordinates are generated.

| Field                   | Meaning                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `primaryQuestion`       | The main decision the player is asked to make                                 |
| `decisionType`          | Route, tool, risk, information, resource, timing, position, return path, etc. |
| `minimumChoices`        | Minimum number of genuinely different viable responses                        |
| `knownInformation`      | What is readable before commitment                                            |
| `hiddenInformation`     | What may remain unknown until movement/reveal                                 |
| `requiredSystems`       | Systems needed for the proposition to function                                |
| `optionalSystems`       | Systems that can enrich but are not required                                  |
| `persistentConsequence` | What may remain changed after the player leaves                               |
| `failureFallback`       | What happens if a needed route/tool becomes unavailable                       |
| `noveltyTags`           | Tags used by anti-repetition memory                                           |

A proposition is invalid if its “choice” is merely:

- one obviously superior route;
- a compulsory tool use;
- an unavoidable tax;
- a cosmetic fork that rejoins without consequence;
- random guessing with no readable clue;
- a resource pickup with no meaningful downstream use.

---

# 5. Generator Pipeline

The generator works in this order.

## Phase 1 — Choose the Player Question

Select a proposition based on:

- recent proposition history;
- current biome;
- current Scout capability;
- currently carried tools;
- recently acquired resources;
- current campaign/system unlocks;
- distance from Camp/known routes;
- desired pressure level;
- authored world hooks nearby.

The generator should avoid directly countering the player inventory every time. Possessing a Pickaxe should create **opportunities**, not cause every future region to become a pickaxe test.

## Phase 2 — Build Abstract Topology

Create a small graph before placing hexes.

Example:

`Entry → Fork → Safe Detour → Exit`

`             ↘ Stone Crust → Shortcut → Exit`

The graph defines meaning. Hex coordinates define embodiment.

## Phase 3 — Embed the Graph into Hex Space

Convert graph nodes/edges into an irregular axial-hex footprint.

The embedding may:

- rotate;
- curve;
- stretch;
- compress;
- create pockets;
- wrap paths around landmarks;
- introduce height/terrain later if approved.

It must not alter the proposition into a different one.

## Phase 4 — Assign Terrain Grammar

Terrain is assigned for gameplay purpose first, visual dressing second.

Examples:

- Stone Mass defines hard topology;
- Stone Crust enables a breakable alternative;
- dense vegetation may hide visibility;
- loose terrain may produce Noise;
- shelter terrain may make Gather Will safer;
- water/ravine may become conditional traversal later.

## Phase 5 — Add Frontier Signals

Before the player commits, the world should often tease one meaningful feature.

Possible signals:

- ruin silhouette;
- unusual stone fracture;
- resource habitat;
- light;
- smoke;
- tracks;
- sound;
- broken structure;
- elevation outline;
- enemy trace;
- unusual vegetation;
- an impossible-to-identify object shape.

Signals must reveal **motivation**, not the full answer.

## Phase 6 — Add Resource Ecology

Resources are placed because the local geography makes sense for them and because they create a decision.

Do not independently scatter collectible tokens.

## Phase 7 — Add Threat/World-Pulse Hooks

Where supported, determine how the region reacts while the Hero gathers Will or crosses it.

A threat may:

- patrol;
- respond to Noise;
- occupy one route;
- make an exposed basin risky;
- turn a shortcut into a future enemy route;
- migrate after a World Pulse.

## Phase 8 — Add Optional Secret

Secrets should arise from reading the world, not random wall clicking.

Examples:

- Fractured Stone signal;
- tracks ending at a wall;
- airflow/sound;
- vegetation mismatch;
- odd ruin geometry;
- resource trail.

## Phase 9 — Simulate and Lint

The candidate region is rejected if it is:

- unreachable;
- trivial;
- compulsory grind;
- visually interesting but decisionless;
- too similar to recent regions;
- impossible for the guaranteed player state;
- dominated by one always-best path;
- excessive in interaction density;
- unable to explain itself through Board First cues.

## Phase 10 — Commit to Persistent World

Once committed/revealed, the region becomes part of the world seed state.

Player modifications remain persistent unless a specific world rule explicitly transforms them later.

---

# 6. Starter Region Grammar Library

The library below deliberately describes **questions**, not art themes.

## G01 — Forked Ridge

**Primary question:** Do I take the longer controlled route or alter terrain for a shorter route?

Structure:

- one entry;
- visible fork;
- traversable detour;
- shorter gated/destructible branch;
- eventual merge or distinct exits.

Typical systems:

- Scout route preview;
- Stone Crust;
- Pickaxe;
- persistent shortcut.

Failure fallback:

- detour always exists.

Anti-pattern:

- shortcut saves so little that the choice is fake.

---

## G02 — Pocket Basin

**Primary question:** How deeply do I commit before the next Gather Will / World Pulse?

Structure:

- narrow neck;
- open internal pocket;
- one attractive signal/resource near center or far rim;
- 2+ possible exits;
- limited shelter.

Purpose:

Makes ending position matter.

Possible consequence:

- entering deeply gains discovery/resource but leaves the Hero exposed during World Pulse.

---

## G03 — Broken Corridor

**Primary question:** Restore/directly create a route, or accept the natural detour?

Structure:

- strong corridor direction;
- visible obstruction;
- breakable fracture or alternate path;
- continuation visible/teased beyond obstruction.

Persistent consequence:

- broken passage remains open and may later be used by enemies/patrols.

---

## G04 — Landmark Ring

**Primary question:** From which approach should I investigate a strong orientation landmark?

Structure:

- central landmark;
- 2–4 approach arcs;
- different terrain consequences on approaches;
- future route-anchor potential.

Purpose:

Reduces procedural disorientation and creates remembered geography.

---

## G05 — Split Ravine

**Primary question:** Which side of a divided region do I commit to before I possess/construct a crossing?

Status:

- later candidate until conditional traversal tools are implemented.

Structure:

- continuous dividing barrier;
- at least one known legal crossing/detour;
- one visibly tempting opposite-side discovery.

Never hard-lock critical progression behind an unavailable tool.

---

## G06 — Resource Lure

**Primary question:** Is the resource opportunity worth leaving the efficient route?

Structure:

- efficient main route;
- visible/observed resource habitat off-axis;
- side pocket or risk exposure;
- reconnection to route.

Rule:

The reward must serve an existing or discoverable system need; do not place generic loot solely to justify the branch.

---

## G07 — Shelter Chain

**Primary question:** How do I sequence safe Gather-Will positions across exposed terrain?

Structure:

- open/exposed area;
- several shelter points at non-trivial spacing;
- one tempting shortcut with poorer safety;
- one longer route chaining safe positions.

This grammar gives Will/World Pulse a spatial purpose without turning movement into stamina bookkeeping.

---

## G08 — Patrol Funnel

**Primary question:** Do I time/route around known enemy movement or manipulate the environment?

Structure:

- bottleneck;
- readable patrol lane or detection zone;
- alternate cover/terrain manipulation;
- optional noise interaction.

Rule:

Enemy information must be readable enough for planning. Do not make this a hidden coin flip.

---

## G09 — Secret Fracture

**Primary question:** Did I understand the environmental clue well enough to notice a non-obvious path?

Structure:

- normal route remains viable;
- subtle Fractured Stone or equivalent clue;
- secret side branch;
- knowledge/resource/shortcut, not mandatory campaign progression.

Purpose:

Rewards observation rather than fog completion.

---

## G10 — Returning Loop

**Primary question:** Is it worth opening a connection that mainly improves future travel rather than immediate reward?

Structure:

- outbound route;
- loop-back gate/shortcut connecting to earlier known world;
- optional immediate discovery;
- high long-term navigation value.

Purpose:

Makes world mastery physically visible.

---

## G11 — One-Way Descent

**Primary question:** Am I willing to commit to a route that changes my return options?

Status:

- candidate for later traversal rules.

Structure:

- readable one-way transition;
- clear preview that return is not immediate;
- alternative route before commitment;
- safe fallback after descent.

Never hide one-way commitment from the player.

---

## G12 — Crossroads With Cost

**Primary question:** Which objective do I prioritize when I cannot efficiently investigate all branches in the same Burst?

Structure:

- 3-way junction;
- each branch gives a different signal type;
- distance/World Pulse makes “do everything now” inefficient;
- branches remain available later.

Signals should represent different motives, e.g.:

- resource;
- landmark;
- unknown structure.

Do not rank them numerically.

---

## G13 — Tool Opportunity

**Primary question:** Do I spend/use the tool now to reshape this region, or preserve the world state and continue?

Structure:

- tool-valid object/terrain;
- meaningful alternate route;
- consequence beyond raw time saving.

Example consequence:

Breaking rock may:

- expose a resource habitat;
- create enemy access;
- reveal a sight line;
- open a return shortcut.

The tool must not behave like a universal key.

---

## G14 — Resource Habitat

**Primary question:** What does this environment teach me about where a resource lives?

Structure:

- recognizable environmental pattern;
- 1–3 resource occurrences, not random scatter;
- one clue that can later help identify similar habitats;
- optional tradeoff such as exposure or route deviation.

Purpose:

Transforms resource gathering into world knowledge.

---

## G15 — Ruin Perimeter

**Primary question:** Which side of an authored/procedural structure should I approach and investigate first?

Structure:

- structure occupies multiple blocked/conditional hexes;
- 2+ approaches;
- at least one interaction socket;
- possible secret/shortcut;
- strong visual identity.

This grammar is a preferred host for authored discoveries.

---

## G16 — Collapsed Network

**Primary question:** Which passage do I restore first when several damaged routes compete for attention?

Structure:

- small network of blocked/partially blocked corridors;
- one guaranteed open route;
- 2–3 manipulable connections;
- restored passage changes route graph.

Constraint:

Do not require repetitive wall breaking. One or two consequential transformations are preferable to many identical actions.

---

## G17 — Echo / Trace Field

**Primary question:** Which environmental trace do I follow when the destination itself is not visible?

Structure:

- no direct landmark reveal;
- directional clues across several hexes;
- branch where clues differ;
- payoff is knowledge/location/encounter.

Examples of trace vocabulary:

- sound;
- tracks;
- airflow;
- ash;
- strange residue;
- displaced vegetation.

Purpose:

Adds discovery that is not visual fog peeling.

---

## G18 — Threat–Resource Interlock

**Primary question:** Can I exploit or redirect a threat to gain access to a resource/location rather than merely fight it?

Structure:

- threat influences one route/resource zone;
- at least one manipulation option;
- combat remains possible but is not automatically optimal.

Examples:

- lure patrol with Noise;
- break another passage;
- wait for World Pulse movement;
- approach from shelter.

This should connect exploration logic to Hexoflat combat behavior instead of making encounters separate islands.

---

## G19 — Frontier Window

**Primary question:** Which narrow opening into the unknown should I pursue based on incomplete signals?

Structure:

- hard terrain boundary;
- 2–3 frontier windows;
- each window shows a different partial signal;
- committing to one initially limits visibility of others.

Purpose:

Makes unknown world shape itself part of the decision.

---

## G20 — Authored Mystery Socket

**Primary question:** What is this unique thing and how do I reach/understand it?

Structure:

- generator reserves topology around an authored discovery;
- authored content defines minimum approach constraints;
- procedural terrain determines actual route problem;
- authored content remains recognizable and coherent across seeds.

Rule:

Procedural generation may vary approach and context but must not dilute authored narrative meaning.

---

# 7. Region Composition Rules

A compelling expedition should not be a random list of grammars.

Regions should form **phrases**.

## 7.1 Setup → Pressure → Payoff

Example:

`Landmark Ring → Patrol Funnel → Ruin Perimeter`

The landmark creates desire. The funnel creates route tension. The ruin provides the discovery.

## 7.2 Signal → Obstacle → Transformation

Example:

`Resource Lure → Broken Corridor → Resource Habitat`

The player sees why they care before being asked to manipulate terrain.

## 7.3 Outbound → Discovery → Return Improvement

Example:

`Pocket Basin → Authored Mystery → Returning Loop`

A deep expedition can pay off by making the return journey permanently easier.

## 7.4 Contrast Rule

Adjacent dominant propositions should normally contrast along at least one dimension:

- open vs constricted;
- information vs tool;
- resource vs landmark;
- danger vs calm;
- immediate reward vs future shortcut;
- commitment vs free routing.

Do not produce:

`Break wall → break wall → break wall`

or

`resource side pocket → resource side pocket → resource side pocket`.

---

# 8. Anti-Repetition Memory

The generator tracks recent experience across multiple axes.

## 8.1 Proposition Memory

Examples:

- DETOUR_OR_BREAK
- COMMIT_BEFORE_PULSE
- ROUTE_AROUND_PATROL
- RESOURCE_DEVIATION
- SECRET_READING
- FUTURE_SHORTCUT
- LANDMARK_APPROACH
- TOOL_OPPORTUNITY
- RESOURCE_HABITAT
- TRACE_FOLLOWING

A recently used primary tag receives a strong temporary selection penalty.

## 8.2 Geometry Memory

Track coarse shape descriptors:

- corridor;
- fork;
- ring;
- basin;
- open field;
- bottleneck;
- loop;
- network;
- spine;
- divided space.

Do not allow proposition diversity to hide geometric sameness.

## 8.3 Interaction Memory

Track dominant player verb:

- Move;
- Break;
- Take;
- Observe;
- Wait/Gather Will;
- Avoid;
- Push/Pull later where relevant;
- Enter/Open;
- repair/build later.

## 8.4 Reward-Motive Memory

Track what drew the player forward:

- resource;
- location;
- knowledge;
- shortcut;
- threat;
- story;
- new system;
- equipment/tool opportunity.

## 8.5 Landmark Memory

Do not repeat the same landmark silhouette/semantic category too frequently even if gameplay differs.

## 8.6 Sequence Memory

The generator should evaluate the last several regions as a phrase, not only compare current vs previous.

---

# 9. Controlled Surprise Model

Procedural randomness in exploration should primarily be **input randomness**:

- the world presents a novel situation;
- the player reads it;
- the player decides;
- known rules resolve predictably.

Avoid using procedural generation to create arbitrary unavoidable penalties after commitment.

Good surprise:

> A previously unseen ravine changes the route after the Hero observes it and can react.

Bad surprise:

> The route is silently generated as fatal after the Hero commits with no clue or counterplay.

This preserves Hexoflat’s emphasis on tactical understanding.

---

# 10. Frontier Signal Grammar

Every significant frontier signal belongs to one of five semantic classes.

## 10.1 Structure Signal

Examples:

- tower silhouette;
- arch;
- wall;
- ruin fragment;
- unnatural geometry.

Promise:

“There is a place/object worth understanding.”

## 10.2 Ecology Signal

Examples:

- unique plant cluster;
- unusual tree line;
- mineral shimmer;
- water/soil change.

Promise:

“This environment may support a useful resource or ecosystem.”

## 10.3 Threat Signal

Examples:

- tracks;
- moving shadow;
- smoke;
- noise;
- damaged terrain.

Promise:

“Something active may influence this route.”

## 10.4 Passage Signal

Examples:

- crack;
- airflow;
- gap;
- broken masonry;
- descending path.

Promise:

“There may be another way through.”

## 10.5 Mystery Signal

Examples:

- impossible light;
- unknown sound;
- anomalous object silhouette;
- lore-specific phenomenon.

Promise:

“You do not yet know what category this belongs to.”

Rule:

Mystery signals should be rarer than ordinary structure/ecology signals or they stop feeling mysterious.

---

# 11. Resource Ecology Integration

Resources must live in **habitats and situations**, not be scattered as reward confetti.

## 11.1 Resource Contract

Every resource type declares:

- habitat cues;
- why the Hero wants it;
- what system consumes/uses it;
- whether pickup is routine or strategic;
- whether harvesting changes terrain;
- whether the source persists/depletes/transforms;
- how knowledge of the resource improves future exploration.

## 11.2 Resource Encounter Types

### Safe Habitat

Low-risk teaching occurrence.

Purpose:

Teach recognition.

### Route-Deviation Habitat

Resource lies away from efficient travel.

Purpose:

Create opportunity-cost decision.

### Threat-Adjacent Habitat

Resource overlaps patrol/detection/world-pulse risk.

Purpose:

Make resources interact with world behavior.

### Terrain-Gated Habitat

Resource becomes accessible through a meaningful transformation such as Stone Crust removal.

Purpose:

Connect tool → terrain → resource.

### Knowledge-Gated Habitat

Resource is visible only after the player learns the environmental clue.

Purpose:

Progression through understanding rather than numeric skill.

## 11.3 No Grind Law

If a resource is required repeatedly, the game must eventually provide at least one of:

- known habitat tracking;
- known route access;
- better harvesting option;
- Camp production/substitution;
- alternative source;
- reduced need through mastery.

The game must not require the player to repeatedly replay solved frontier exploration just to maintain basic systems.

---

# 12. Terrain Manipulation as World Authorship

When the Hero changes topology, the world should remember.

Examples:

- Stone Crust → Broken Passage;
- fallen tree → cleared lane;
- future bridge → restored crossing;
- collapsed route → reopened route.

A manipulation can create both benefit and consequence.

Example:

`Break shortcut → faster Camp return + enemy patrol gains access`

This is preferred over:

`Break shortcut → simply save three clicks`.

The player should gradually recognize their own decisions in the map.

---

# 13. Authored + Procedural Hybrid

Pure procedural content is not the target.

## Procedural responsibilities

- local topology;
- route propositions;
- terrain arrangement;
- frontier signal placement;
- resource habitat placement within rules;
- optional secret placement;
- approach geometry;
- World Pulse hooks;
- connections between known and unknown space.

## Authored responsibilities

- major lore discoveries;
- Main Hero unlocks;
- companion encounters;
- unique story locations;
- campaign-critical objects;
- signature puzzles;
- named locations;
- high-value bespoke encounters.

The generator should create **context around authored meaning**, not procedurally rewrite authored meaning.

---

# 14. Quality Gate — Reject Boring Seeds

A region must pass automated and playtest-oriented checks.

## 14.1 Reachability

There is at least one valid route for the guaranteed current progression state.

## 14.2 Meaningful Alternative

If the proposition claims a choice, at least two options must differ in consequence, information, risk, resource use, or future topology.

## 14.3 Dominance Check

Reject regions where one option is clearly superior across all relevant axes.

## 14.4 Tool Fairness

A tool-gated route cannot be mandatory unless the tool is guaranteed and the player can understand the requirement.

## 14.5 Signal Integrity

A region with a curiosity proposition must expose enough signal to motivate investigation without revealing the entire payoff.

## 14.6 Interaction Density

Reject regions that require too many repeated trivial interactions in a short span.

## 14.7 Recent Similarity

Reject or reroll regions that exceed similarity thresholds across proposition, geometry, interaction, and reward motive.

## 14.8 Return Friction

If a region significantly extends expedition depth, evaluate whether a future shortcut/known-route opportunity is appropriate.

## 14.9 Resource Purpose

Reject resource placements that have no relevant current/future system use or exist only to decorate empty space.

## 14.10 Board Readability

The region must be understandable on the actual target board scale. Do not generate tactically distinct paths that visually collapse into noise.

---

# 15. Internal Generation Metrics

These are **engineering/design metrics only**, not player-facing stats.

Suggested diagnostics:

- `reachableExitCount`;
- `meaningfulBranchCount`;
- `shortestPathLength`;
- `alternatePathLength`;
- `pathOverlapRatio`;
- `toolShortcutBenefit`;
- `signalDistanceFromEntry`;
- `landmarkVisibilityCoverage`;
- `resourceDetourCost`;
- `shelterSpacing`;
- `worldPulseExposureCount`;
- `recentPropositionSimilarity`;
- `recentGeometrySimilarity`;
- `interactionRepeatScore`;
- `deadEndCount`;
- `persistentConsequenceCount`.

Do not optimize one metric in isolation. A region is a player decision, not a geometry benchmark.

---

# 16. Scout Integration

Scout should alter **how much of the proposition the player can read/control**, not simply make regions larger.

## Low Scout

- shortest valid route preview;
- immediate discovered/observed terrain;
- limited frontier signal classification.

## Waypoint Scout

- player can bend route through one meaningful waypoint.

## Awareness Scout

- significant reveal can pause movement;
- `Continue / Stop / Act`.

## Trail Sense Scout

- known terrain consequences appear on route preview.

## Frontier Reading Scout

- partial classification of signals such as:
  - possible passage;
  - likely habitat;
  - threat trace;
  - structural landmark.

Scout should make the player better at **reading generated situations**, which allows the generator to introduce richer situations later.

---

# 17. Will / World Pulse Integration

A region may explicitly use World Pulse as part of its proposition.

Allowed uses:

- patrol advances;
- threat changes lane;
- temporary visibility changes;
- noise consequence propagates;
- temporary terrain state changes;
- resource/world event evolves where clearly represented.

Do not use World Pulse merely to tax the player for standing still.

A good Pulse proposition asks:

> “Where should I finish this Burst before the world moves?”

not:

> “How many turns until the game annoys me?”

---

# 18. Game Kit Impact

This candidate should add as few new visible primitives as possible.

## Reuse

- Hero Token;
- Hex Tile;
- Tool Tokens;
- Interaction Marker;
- Fog/Discovery representation;
- Waypoint Pin;
- Will Sigil;
- Resource Tokens;
- Camp Token/Anchor.

## Candidate additions

### Frontier Signal Marker

Prefer **environmental art/animation** first.

Use a marker only when the signal cannot be communicated clearly through terrain/object representation.

### Known Route Marker

Future candidate for mastered territory.

### Landmark State

Prefer world object/token, not a separate permanent UI card.

No “Region Token” is added. Regions remain an engine concept.

---

# 19. UI/UX Contract

## Glance Layer

Show:

- known physical terrain;
- Hero;
- critical resources/objects;
- visible threats;
- clear frontier signals;
- persistent route changes.

Do not show:

- region boundaries;
- proposition labels;
- generator scores;
- unexplored rectangular grid.

## Decision Layer

On route hover/selection:

- route preview;
- final route length already supported by current implementation;
- known route consequences;
- tool-valid shortcut cue where known;
- waypoint if Scout permits;
- known World Pulse risk where applicable.

## Explanation Layer

On interaction/details:

- why terrain blocks;
- why a tool can/cannot manipulate it;
- resource habitat knowledge;
- discovered signal meaning;
- semantic rule trace after transformation.

---

# 20. Emergent-System Rule

A key long-term target is to create memorable moments from **simple interacting rules**, not bespoke scripting everywhere.

Example:

1. Hero breaks Stone Crust to reach medicinal plants.
2. Passage becomes permanent.
3. Noise attracts/redirects a patrol.
4. Patrol later uses the same new passage.
5. Hero returns through a different known route.

No individual rule is complex. Their interaction creates a story the player owns.

This is preferred over generating more one-off region rules.

---

# 21. Playtest Hypotheses

## H1 — Different Questions Feel Different

Players can describe recent regions by the decision they made, not merely by biome appearance.

## H2 — Curiosity Exists Before Reward

Players voluntarily investigate frontier signals without needing explicit quest markers.

## H3 — Terrain Manipulation Feels Like Authorship

Players remember passages they personally opened and use them later.

## H4 — Resources Teach Geography

Players begin predicting where resources may exist from environmental cues.

## H5 — Scout Increases Mastery

Higher Scout makes players feel more informed/control-oriented rather than simply faster.

## H6 — World Pulse Creates Position Decisions

Players intentionally choose safe/advantageous Burst endpoints before Gathering Will.

## H7 — No Fog Vacuuming

Players do not feel compelled to reveal every single hex.

## H8 — Known World Stops Being Chore

Returning through mastered territory is significantly less frictional than first discovery.

## H9 — Procedural Variety Is Mechanical

After long sessions, players report different situations rather than only different shapes.

---

# 22. Failure Signals Requiring Redesign

Redesign if playtests show any of the following:

- players always choose shortest route;
- Pickaxe becomes mandatory default navigation;
- players clear every unknown hex for completeness;
- resources feel like chores;
- players cannot remember where they are;
- different regions feel identical despite different geometry;
- World Pulse encourages waiting exploits or tedious safe cycling;
- generated regions frequently need manual developer repair;
- authored discoveries feel awkwardly pasted into procedural terrain;
- players cannot read why a route is risky/valuable;
- route changes do not matter on return journeys.

---

# 23. Recommended Vertical Slice

Do **not** implement all 20 grammars first.

The first proof should contain only:

1. `Forked Ridge`;
2. `Pocket Basin`;
3. `Resource Lure`;
4. `Secret Fracture`;
5. `Returning Loop`;
6. `Landmark Ring`.

Supported systems:

- Camp Anchor;
- organic hidden board representation;
- Unknown/Observed/Discovered/Understood;
- Hero route preview;
- Pickaxe + Stone Crust;
- one routine resource;
- one habitat-based resource;
- Gather Will + one simple World Pulse reaction;
- Scout Waypoint/Awareness;
- one authored landmark socket.

This is enough to test the core promise without overbuilding.

---

# 24. Candidate Signature

The intended signature of Hexoflat exploration is:

> **The world does not hand the player a map. It exposes clues. The player chooses a path, reads the land, reshapes it with physical tools, learns where resources belong, accepts the world’s response, and leaves behind routes that become part of their own remembered geography.**

Procedural generation exists to continually create **new applications of understandable systems**, not infinite decorative variation.

---

# 25. Research-Derived Design Notes

These notes inform the candidate but do not supersede the Hexoflat Master Guide.

- _Spelunky_ creator Derek Yu describes how simple, shared behaviors can combine into surprising “complex moments,” and argues that randomization needs an interconnected ruleset worth learning rather than merely offering endless random outcomes. This supports Hexoflat’s emphasis on small reusable terrain/resource/threat rules that can collide emergently.
- Ghost Ship Games’ behind-the-scenes material on _Deep Rock Galactic_ describes procedural cave generation built from authored room templates with potential exits and randomized internal variation, with templates warped/mirrored/overlapped by the generator. This supports a hybrid grammar approach rather than pure noise generation.
- Hybrid procedural level-design case studies describe placing fixed/special elements and arranging purpose-built room/chunk types through concept graphs. This supports Hexoflat’s `proposition graph → hex embedding → authored socket` pipeline.
- Procedural-generation design literature repeatedly warns that random variation can become cosmetic noise unless the underlying building blocks and constraints produce meaningful gameplay variations. The candidate therefore measures proposition, geometry, interaction and motive diversity separately.

Reference sources used for this candidate:

- Game Developer — “How Spelunky got its procedural ‘hook’ & actually got finished” (2021).
- Ghost Ship Games / Steam — “Below Decks at Ghost Ship: Cave generation in Deep Rock Galactic”.
- Game Developer — “Building the Level Design of a procedurally generated Metroidvania: a hybrid approach” (2017).
- Game Developer — “Finding Value in Procedural Generation” (2017).
- Game Developer — “The pros and cons of procedural generation in Overland” (2016).

---

**End of Region Grammar Generator Candidate v0.1**
