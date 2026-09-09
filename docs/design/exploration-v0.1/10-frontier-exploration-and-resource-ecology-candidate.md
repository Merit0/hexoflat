# HEXOFLAT — Frontier Exploration & Resource Ecology

**Version:** Candidate v0.1  
**Status:** Design Candidate — NOT canonical until approved/playtested  
**Primary source of truth:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Scope:** World-map exploration, irregular map representation, fog/discovery, movement rhythm, terrain manipulation, resource interaction, conversion of explored territory into known travel routes.

---

## 0. Canonical compatibility and explicit decisions

This candidate follows the Master Guide principles:

- **The World Is Discovered, Not Selected**.
- **Position → Manipulate → Chain → Consequence**.
- **Board First, UI Second**.
- **Everything Important Is Represented**.
- **No Invisible State** for known decision-relevant information.
- **Progression Expands Possibility** rather than primarily increasing hidden statistics.
- **Anti-Friction Rule**: routine pickup remains direct; only meaningful resource/terrain interactions become deeper decisions.

### Existing implementation preserved

The candidate deliberately reuses the currently implemented systems:

- rectangular technical hex-grid container;
- existing hex coordinates and pathfinding;
- blocked hex state;
- hero movement and route preview;
- green/red destination preview with total route-length number;
- interaction through Hand/Tool tokens rotated around the hero;
- object actions such as Take / Open / Enter;
- destructible stone/rock route blockers;
- Scout parameter currently limiting route length.

### Explicit reinterpretations — not silent overrides

1. **The rectangular grid stays technical only.** The player no longer sees a rectangular board boundary or unrevealed grid outside the known frontier.
2. **Scout distance remains usable in the engine**, but Scout progression is expanded into route control, observation, interruption and frontier-reading abilities.
3. The Master Guide's existing **World Travel Route Pattern** concept is retained, but repositioned primarily for **already-known territory**. First-time traversal of unknown territory uses **Frontier Exploration**.
4. **Will / Воля** becomes a candidate exploration-tempo representation. It is not yet canonical.

---

# 1. Experience Promise

Hexoflat exploration should create the feeling:

> **“I do not uncover a ready-made map. I give the world shape by entering it, understanding it, and physically changing it.”**

The player's repeated questions should be:

1. **What is suggested beyond the frontier?**
2. **Which route do I want to commit to?**
3. **What terrain can I use or transform?**
4. **Where do I want my current burst of movement to end?**
5. **Which resource is worth taking, preserving, or using here?**
6. **What permanent route or knowledge did this expedition create?**

The reward is not primarily clearing fog percentage. The reward is **new knowledge, new topology, new usable routes, new interactions and new possibilities**.

---

# 2. Core Exploration Loop

## 2.1 Moment-to-moment loop

**Observe Frontier → Preview Route → Commit Burst → Reveal/React → Interact/Manipulate → Continue or Stop → Gather Will → World Pulse → Continue**

Detailed flow:

1. Hero stands on a Discovered hex.
2. Frontier around known territory contains visible clues but not full information.
3. Player hovers a destination.
4. Existing pathfinder shows the route and total route length.
5. Known route consequences are shown contextually.
6. Player commits.
7. Hero traverses the route.
8. Each entered hex may reveal adjacent topology/content according to perception rules.
9. If significant new information appears, eligible Scout progression may interrupt movement.
10. Player may continue, stop, or perform a valid interaction.
11. The hero may spend the remaining allowed route distance after an Act where rules permit.
12. Once the player ends the burst, Will becomes dispersed.
13. To begin another full burst, the hero **Gathers Will**.
14. Gathering Will advances the **World Pulse**.
15. Patrols, temporary terrain, threats, sound, weather or other world systems may respond.

This makes the important decision not simply “can I reach that hex?” but:

> **“Where do I want to be when the world gets its next opportunity to change?”**

---

# 3. Map Representation — Hidden Technical Grid, Organic Player-Facing World

## 3.1 Technical map

The engine may continue using a large rectangular or chunked axial-coordinate grid.

This is an implementation detail only.

## 3.2 Player-facing world

Unrevealed space outside the known frontier:

- does not show hex outlines;
- does not show rectangular board boundaries;
- does not show the final silhouette of the location;
- visually reads as unknown world/fog/void beyond the currently understood geography.

The player sees only:

- Discovered terrain;
- Observed frontier silhouettes;
- frontier signals/clues;
- known landmarks;
- currently relevant interaction markers.

The result must visually read as an **irregular landmass/region growing around the hero**, even if the underlying data structure is rectangular.

---

# 4. Camp as World Anchor

When the hero exits Camp for the first time:

1. Camp exists on the World Map as a persistent **Camp Anchor Token**.
2. Hero appears on a valid adjacent world hex near the Camp token.
3. All immediate neighboring Camp hexes are Discovered.
4. A small irregular ring beyond them may be Observed depending on terrain and Scout state.
5. Everything beyond the frontier remains Unknown and has no visible hex grid.

The Camp Anchor is not a menu selector. It is a real place that can be left and returned to physically.

### Starter-frontier rule

The initial frontier should present at least **two distinct curiosity vectors**, for example:

- a visible natural landmark silhouette;
- a resource/environment clue;
- evidence of a route/ruin/threat.

The player should have an immediate reason to choose a direction without being given three quest icons.

---

# 5. Discovery State Machine

Every generated world hex has a discovery state.

## UNKNOWN

- Hex may exist in latent world state but is not represented as a visible tile.
- No terrain identity is shown.
- Hidden content remains hidden.

## OBSERVED

The hero has partial information.

Possible representation:

- terrain silhouette visible through fog;
- broad terrain class visible;
- landmark shape visible;
- threat/resource category hinted but not identified.

Observed state must never reveal information the hero has no rule-based means to know.

## DISCOVERED

The hero has entered, closely observed, or otherwise fully revealed the hex.

- exact terrain displayed;
- normal movement/path rules become readable;
- visible objects appear;
- interactable objects become eligible for contextual tools/actions.

## UNDERSTOOD

The hero has learned the important gameplay meaning of the location/object/route.

Examples:

- recognized a fractured stone wall as breakable;
- identified medicinal vegetation;
- learned a stable shortcut;
- understood a ruin interaction;
- classified a known threat route.

## EXPLOITABLE — future layer

Reserved for discoveries that become reliable tools of the player.

Examples:

- stable known travel route;
- renewable resource source;
- repaired bridge;
- safe shelter;
- discovered extraction/crafting site.

---

# 6. Frontier Signals — Curiosity Before Revelation

Fog itself is not content.

Every meaningful frontier direction should try to expose a **signal** — an information gap that makes the player wonder what is beyond it.

Possible signals:

- distant silhouette;
- glow;
- smoke;
- unusual vegetation transition;
- tracks;
- wind/sound direction;
- broken masonry visible through fog;
- geological fracture;
- river sound;
- enemy evidence;
- resource trace;
- strange world-state effect.

Signals are not generic `?` map icons.

They must be diegetic or represented by small board-native markers.

### Frontier Promise Rule

A frontier signal must imply **a question**, not give away the answer.

Good:

- cracked ridge continuing into fog;
- faint bell sound from the north;
- unusual blue vegetation near a ravine.

Bad:

- `Legendary Chest 12 hexes`.

---

# 7. Region Grammar Generator

## 7.1 Core rule

> **Never generate empty shape. Generate a gameplay proposition, then generate a shape that supports it.**

A region is an invisible generation primitive, not a visible board tile.

Each generated region should contain a small authored/procedural grammar describing:

- spatial identity;
- primary route decision;
- terrain interaction proposition;
- landmark/anchor;
- resource opportunity;
- optional secret;
- exits/frontier sockets;
- danger/threat possibility;
- persistence consequence.

## 7.2 Starter Region Grammars

### A. Forked Ridge

Purpose: route choice.

Structure:

- one entry;
- two meaningful branches;
- one longer open route;
- one shorter gated/destructible route;
- one visual landmark visible before full reveal.

Typical question:

> Do I detour safely, or spend/use a tool to create a shortcut?

### B. Pocket Basin

Purpose: destination commitment.

Structure:

- constricted entry;
- wider internal chamber;
- resource or discovery near the center;
- multiple potential exits;
- position inside basin may be exposed during World Pulse.

Typical question:

> Do I commit deeper for the discovery/resource before I need to Gather Will?

### C. Broken Corridor

Purpose: terrain manipulation.

Structure:

- natural corridor;
- blocked continuation;
- visible destructible crust or side fracture;
- optional alternate route;
- breaking geometry can permanently change future navigation.

### D. Landmark Ring

Purpose: orientation + knowledge.

Structure:

- strong central landmark;
- several approach paths;
- partial visibility from surrounding frontier;
- discovery changes navigation knowledge and can become a future route anchor.

### E. Split Water / Ravine — later candidate

Purpose: conditional traversal.

Requires bridge/rope/fording rule before production use.

## 7.3 Anti-repetition rules

The generator should track recent propositions, not only recent terrain art.

Avoid placing adjacent/recent regions with the same dominant question.

Example proposition tags:

- DETOUR_OR_BREAK
- EXPOSED_COMMITMENT
- RESOURCE_VS_ROUTE
- LANDMARK_NAVIGATION
- SECRET_FRACTURE
- THREAT_BYPASS
- TOOL_GATE
- RETURN_SHORTCUT

The world may reuse visual terrain while changing the actual player problem.

---

# 8. Movement Game — Path of Will

Working name: **Path of Will / Шлях Волі**.

## 8.1 Burst

A **Burst** is the hero's current planned movement opportunity.

Candidate base grammar:

**Shift → Act → remaining Shift**

The existing Scout route-length parameter remains the maximum traversable distance for the Burst.

The player does not need to spend the whole route allowance.

## 8.2 Gather Will

When the player voluntarily completes the Burst and wants another full movement opportunity, they **Gather Will**.

Candidate physical representation:

**Will Sigil** on Player Board:

- Focused;
- Dispersed.

No `Will 7/10` meter is required.

Gathering Will changes Dispersed → Focused and triggers a World Pulse.

## 8.3 World Pulse

World Pulse is the systemic consequence of taking another exploration tempo cycle.

Possible systems reacting to Pulse:

- patrol movement;
- threat movement;
- temporary surface/terrain state;
- noise propagation/decay;
- weather visibility changes;
- time-sensitive discovery;
- resource regrowth where explicitly allowed;
- world events.

Prototype v0.1 should activate only a minimal subset to prevent systemic overload.

Recommended first reaction: **one simple patrol/threat movement rule** or a dummy Pulse event counter for testing movement decisions.

---

# 9. Scout Progression — From Distance to Mastery

Scout must not remain only `Level N = more hexes`.

The existing distance parameter can remain one dimension, while progression unlocks rules.

## Candidate ladder

### Scout — Reach

- current route-length capability;
- normal shortest-path preview.

### Scout — Waypoint

- player may place one temporary Waypoint Pin;
- pathfinder computes `hero → waypoint → destination`;
- no need to manually select every hex.

### Scout — Awareness

When a movement route reveals significant new decision-relevant information, movement may pause.

Context choices:

- Continue;
- Stop;
- Act, if a valid tool/object interaction is available.

Unused route distance remains available where rules permit.

### Scout — Trail Sense

Preview can show known consequences along the route:

- known hazardous terrain;
- known detection area;
- known destructible shortcut opportunity;
- known conditional traversal issue.

No hidden data is exposed.

### Scout — Frontier Reading

Observed frontier can reveal category-level signals earlier or farther away.

Examples:

- fractured geological formation;
- likely passage;
- broad threat category;
- resource-biome clue.

The final ordering/unlock cadence must be playtested.

---

# 10. Terrain as Navigation Gameplay

Terrain does not simply decorate route cost.

Terrain should use qualitative interaction grammar where practical.

## 10.1 Traversal states

- OPEN
- BLOCKED
- DESTRUCTIBLE
- CONDITIONAL

## 10.2 Stone grammar

### Stone Mass

- BLOCKED;
- cannot be destroyed by the basic Pickaxe;
- shapes regional topology.

### Stone Crust

- DESTRUCTIBLE;
- valid Pickaxe interaction from adjacent hero hex;
- once broken, becomes traversable passage.

### Fractured Stone

- may be OBSERVED/UNDERSTOOD as a possible hidden shortcut by Scout/knowledge;
- potentially breakable.

### Collapsed Passage — later

- conditional clearing interaction;
- may require a tool/resource combination.

## 10.3 Permanent consequence

A broken route blocker does not reset casually.

Example:

`STONE_CRUST → CRACKED → BROKEN_PASSAGE`

The resulting passage becomes part of persistent world topology and pathfinding.

If the action also produces a resource, that resource should be a meaningful by-product, not an excuse for repetitive mining.

---

# 11. Resource Ecology — Resources Must Create Choices

## 11.1 Core rule

> **Resources are not a layer of collectible clutter. They are connectors between exploration, terrain manipulation, crafting, healing, camp and future expeditions.**

## 11.2 Two classes of resource interaction

### Routine Pickup

Use direct existing interaction.

Examples:

- loose item;
- small herb bundle;
- dropped component;
- bone fragment;
- already-harvested material.

Flow:

`Hand → token → Take`

No dedicated mini-game.

### Strategic Harvest / Transformation

Used when the action changes a meaningful world state or creates a tradeoff.

Examples:

- Axe → Tree → Fell;
- Pickaxe → Stone Crust → Break Through;
- Tool → rare resource node that changes route/visibility;
- later: repair bridge, clear roots, harvest dangerous plant.

These are gameplay because they affect topology, risk, route, equipment commitment or future systems.

---

# 12. Starter Resource Set

Keep the prototype minimal.

## Medicinal Plant Token

Represents:

- physical healing/crafting input.

Interaction:

- Hand → Take when accessible.

Connection:

- future Healing Game / Elixir crafting.

Design rule:

- should often grow in recognizable environmental contexts so knowledge helps locate it.

## Stone Fragment Token

Represents:

- useful material created from specific breakable geology.

Source:

- selected terrain transformation interactions.

Connection:

- future Camp/Crafting/build/repair rules.

Anti-grind rule:

- not every destroyed stone must shower the player with mandatory fragments.

## Timber Token

Represents:

- usable wood material.

Source:

- meaningful tree interaction.

Future connection:

- camp/crafting/route construction.

Potential later tactical interaction:

- selected trees may be felled directionally to create/block traversal, but this is NOT required for v0.1.

---

# 13. Resource Knowledge and Recognition

Resources should become easier to reason about as the hero/world knowledge grows.

Possible progression:

**Unknown specimen → Observed category → Identified resource → Known source pattern → Exploitable source**

Example:

The player first discovers a medicinal plant manually.

After understanding it:

- the plant receives a stable visual grammar;
- similar growth in Observed terrain may become recognizable;
- Scout/knowledge may identify likely habitat without revealing exact hidden tokens.

This turns **knowledge into exploration progression**, not only inventory progression.

---

# 14. Inventory / Carry Representation

Avoid abstract weight such as `37/60 kg` unless later proven necessary.

Preferred prototype direction:

- visible Bag/Satchel slots on Player Board;
- important resource tokens occupy physical slots or stacks;
- literal quantity may use a number only when repeated token rendering becomes unreasonable.

The purpose of capacity is not to create tedious inventory sorting.

Only add meaningful carry limitation if it creates decisions such as:

- carry a traversal tool vs extra resource;
- preserve a rare item vs common material;
- return to Camp vs push deeper.

If playtesting shows only friction, remove/simplify capacity.

---

# 15. Discovery Rewards — Possibility Before Currency

Do not make exploration primarily:

`Fog → Chest → Gold`.

Priority reward categories:

1. **Topology** — shortcut, passage, bridge, route anchor.
2. **Knowledge** — understand resource/terrain/threat rule.
3. **Capability** — tool, interaction verb, traversal option.
4. **Location** — dungeon, ruin, camp facility connection, narrative site.
5. **Character** — companion/main-hero discovery hooks.
6. **Resource Source** — repeatable/strategic source.
7. **Lore/Story** — must connect to mechanics/world state where possible.
8. **Material reward** — gold/resource/item where appropriate, but not the default answer to curiosity.

---

# 16. Persistent World Memory

The world should remember meaningful player actions.

Persistent examples:

- broken Stone Crust remains a passage;
- repaired route remains usable;
- discovered landmark stays visible;
- Understood resource habitat remains known;
- cleared major obstruction stays cleared;
- player Waypoint Pins persist until removed where appropriate.

The player should feel:

> **“I know this place because I changed and understood it.”**

---

# 17. Known Territory → Travel Network

First-time exploration and repeat navigation should not have the same friction.

## Frontier Exploration

Used when territory is unknown/partially known.

- hero-level route movement;
- Fog and signals;
- Will/Pulse decisions;
- terrain manipulation;
- discovery.

## Known Travel

Once sufficient route knowledge exists, previously canonical Route Pattern concepts become appropriate.

A stable known connection may become:

- Known Trail;
- Shortcut;
- Travel Route;
- Waypoint connection.

The player can traverse already-understood territory with less micro-navigation.

### Design law

> **Discovery once; navigation becomes progressively easier.**

Travel convenience is earned through exploration knowledge, not handed out before exploration occurs.

---

# 18. Anti-Boredom and Anti-Grind Rules

## 18.1 No Fog Completion Chore

Do not display an exploration-completion percentage that pressures players to uncover meaningless remaining hexes.

A region can become Understood without every tile being revealed.

## 18.2 No Repeated Mandatory Harvesting

Avoid recipes requiring repetitive large-volume gathering as the main progression gate.

Prefer fewer, more legible resources with meaningful use.

## 18.3 No Tool Solves Everything

Basic Pickaxe must not make every blocked geological path removable.

Topology retains authority through qualitative terrain classes.

## 18.4 No Procedural Content Without a Question

Every region must contain at least one intentional decision proposition.

## 18.5 No Long Walking Through Solved Space

Known Travel/shortcuts progressively replace repeated manual navigation.

## 18.6 No Hidden Critical State

Known hazards, tool eligibility, destroyed passages and discovery state must be visible on the board.

---

# 19. Authored Content + Procedural Topology

Pure procedural generation risks producing visually different but interactively identical content.

Recommended direction:

### Procedural layer

- region shape;
- route topology;
- obstruction placement;
- terrain composition;
- frontier sockets;
- selected resource opportunities;
- compatible threat placements.

### Authored layer

- important landmarks;
- narrative discoveries;
- unique puzzles;
- hero/companion unlocks;
- major world mechanics;
- rare interaction sequences;
- biome-specific signature propositions.

Authored anchors are inserted into compatible procedural region sockets.

The generator's job is not to invent endless lore. Its job is to create **good playable contexts for authored and systemic content**.

---

# 20. Game Kit Additions

## Existing pieces reused

- Hero Token;
- Hex Tile;
- Camp Token/Facility representation;
- Hand Tokens;
- Tool Tokens (Pickaxe/Axe etc.);
- Interaction Marker;
- Player Board.

## Candidate new pieces

### Will Sigil

Represents:

- exploration tempo state.

States:

- Focused;
- Dispersed.

UI form:

- small reversible/rotating token on Player Board.

### Fog / Discovery Overlay

Represents:

- Unknown/Observed frontier relationship.

UI form:

- board-space visual treatment, not a permanent card.

### Waypoint Pin

Represents:

- player-directed route control.

Source:

- Scout progression.

### Resource Tokens

- Medicinal Plant;
- Stone Fragment;
- Timber.

### Known Route Marker — later

Represents:

- stable Understood/Exploitable travel connection.

---

# 21. UI/UX

## Glance Layer

Always/readily visible:

- hero;
- revealed terrain;
- Camp anchor;
- critical terrain barriers;
- visible resources/objects;
- Will state;
- important threat state;
- frontier visual boundary.

## Decision Layer

On route hover/selection:

- existing route preview;
- green/red destination;
- literal route-length number;
- known terrain consequences;
- known tool-enabled shortcut indication;
- Waypoint controls when unlocked.

On interruption:

- small contextual `Continue / Stop / Act` choice.

## Explanation Layer

On demand:

- why a hex cannot be crossed;
- why a terrain object is breakable/not breakable;
- why a frontier signal is visible;
- discovery-state explanation;
- semantic rule trace.

Example trace:

`Pickaxe → Stone Crust → Crust breaks → Passage opens → pathfinding updates → Stone Fragment created`

---

# 22. Procedural Generation Quality Rules

Candidate internal parameters for prototype/playtesting, not player-facing rules:

- Region size target: ~9–24 hexes.
- Primary exits: 2–4 where topology permits.
- Exactly one dominant exploration proposition per small region.
- 0–2 secondary propositions.
- At least one orientation landmark or strong silhouette in regions above minimal size.
- At least one reachable continuation route from entry unless the region is intentionally a dead-end discovery pocket.
- A hard progression gate must not silently block all global continuation unless authored content explicitly requires it.
- Destructible shortcuts should usually be optional advantages, not mandatory tool checks.
- No immediate repetition of the same dominant proposition tag when alternative grammars are available.

These values require simulation and playtesting.

---

# 23. Research-Derived Design Lessons

The following are external design lessons, not canonical facts from the Master Guide:

- **Outer Wilds:** curiosity works when the world exposes information gaps and knowledge itself advances player capability.
- **Deep Rock Galactic:** destructible geometry is compelling when changing terrain is a core navigational verb, not only cosmetic destruction.
- **Breath of the Wild:** landmarks/topography can guide player curiosity without a dense marker layer.
- **Subnautica:** resources are strongest when obtaining them pushes the player beyond the current comfort zone and unlocks new exploration capability.
- **No Man's Sky / broad procedural-world feedback:** visual/procedural scale does not prevent repetition when interaction grammar and outcomes become homogeneous.

These lessons inform this candidate but do not override Hexoflat's canonical rules.

---

# 24. Playtest Hypotheses

## H1 — Frontier Curiosity

Players voluntarily choose between at least two frontier directions based on world signals rather than only explicit objectives.

## H2 — Route Decision

At least some movement choices are changed by terrain, World Pulse exposure, resources or possible shortcuts rather than always selecting the mathematically shortest route.

## H3 — Terrain Agency

Players understand that they can sometimes create routes, and terrain manipulation feels like a tactical/world decision rather than repetitive harvesting.

## H4 — Resource Relevance

Players can explain why a collected resource matters to another system or future possibility.

## H5 — Low Friction

Routine resource pickup remains fast; players do not feel every object interaction is a mini-game.

## H6 — Persistent Ownership

Players remember self-created passages/landmarks/routes and use them on return trips.

## H7 — Anti-Repetition

After repeated region generation, players describe differences in **problems/decisions**, not only differences in shape.

---

# 25. Success Metrics for Internal Testing

Metrics are internal and may be numerical even though player-facing combat UI avoids abstract numbers.

Track:

- time from Camp exit to first voluntary frontier-choice commit;
- percentage of route previews changed before commit;
- percentage of routes using a waypoint when available;
- number of movement interruptions and continue/stop decisions;
- percentage of explored regions where terrain manipulation is considered/used;
- ratio of direct Take interactions to strategic harvest interactions;
- frequency of revisiting a player-created shortcut;
- time spent traversing already-understood territory;
- repetition rate of dominant region proposition tags;
- resource pickup-to-use latency;
- resources accumulated but never used;
- player recall of landmarks/routes after a session break.

Do not optimize solely for engagement duration. Qualitative playtest interviews remain required.

---

# 26. Development / Validation Roadmap

## Step 1 — Representation Prototype

Goal:

- remove visible rectangular-board feeling without rewriting core grid/pathfinding.

Implement:

- invisible Unknown grid;
- Camp anchor;
- Discovered starting neighbors;
- organic fog frontier;
- no outer board silhouette.

Prove:

- the world visually reads as an irregular discovered territory.

## Step 2 — Deterministic Region Grammar Generator

Implement:

- seeded generation;
- 4 starter grammars: Forked Ridge, Pocket Basin, Broken Corridor, Landmark Ring;
- connectivity validation;
- anti-repeat proposition tags.

Prove:

- generated regions create different route questions, not merely different shapes.

## Step 3 — Discovery States

Implement:

- Unknown / Observed / Discovered / Understood;
- reveal propagation;
- terrain-sensitive observation hooks.

Prove:

- Observed information creates curiosity without spoiling content.

## Step 4 — Path of Will

Implement:

- Focused/Dispersed Will Sigil;
- end Burst;
- Gather Will;
- minimal World Pulse.

Prove:

- destination of the current movement burst matters because of the next Pulse.

## Step 5 — Movement Interruption

Implement:

- significant-reveal detection;
- Continue / Stop / Act;
- preserve unused route distance.

Prove:

- revealing new information during movement produces meaningful adaptation.

## Step 6 — Terrain Manipulation

Implement:

- Stone Mass;
- Stone Crust;
- Pickaxe Break Through;
- persistent topology update;
- pathfinder recalculation;
- semantic trace.

Prove:

- “create a path” competes meaningfully with “take a detour”.

## Step 7 — Minimal Resource Ecology

Implement:

- Medicinal Plant;
- Stone Fragment;
- Timber;
- direct Take vs strategic transformation distinction;
- visible resource storage representation.

Prove:

- resources connect to future actions and do not become collection spam.

## Step 8 — Scout Mastery

Implement incrementally:

- Waypoint;
- Awareness interruption;
- Trail Sense;
- Frontier Reading.

Prove:

- Scout progression changes how players reason about movement.

## Step 9 — Known Routes

Implement:

- Understood route state;
- Known Route marker;
- accelerated/abstracted traversal over solved territory.

Prove:

- return travel loses friction without erasing world geography.

## Step 10 — Authored Discovery Injection

Implement:

- landmark sockets;
- narrative/resource/hero discovery hooks;
- compatibility validation.

Prove:

- procedural structure can carry memorable authored moments.

## Step 11 — Anti-Repetition Lab

Implement headless seed generation and analysis:

- proposition distribution;
- topology metrics;
- dead-end rate;
- gate solvability;
- landmark spacing;
- resource clustering;
- reachable frontier count.

Prove:

- hundreds/thousands of seeds satisfy design invariants before content expansion.

## Step 12 — Longitudinal Playtest

Test not only first 30 minutes but repeated expeditions.

Prove:

- curiosity survives familiarity;
- resources do not become grind;
- repeated travel is not a chore;
- player-created topology remains memorable/useful.

---

# 27. Candidate Signature

The proposed signature of Hexoflat world exploration is:

> **Explore an unseen frontier through Path of Will, read partial signals, choose where to commit, physically transform terrain to create routes, discover resources that connect into other playable systems, and gradually convert a dangerous unknown world into a personally understood travel network.**

This candidate should remain explicitly **Candidate v0.1** until the listed hypotheses are playtested and approved.
