# HEXOFLAT — World Map MVP Generator v0.1

**Status:** Candidate / implementation-ready MVP  
**Scope:** First local World Map zone generated immediately after the Hero exits Camp  
**Audience:** Claude Code / Engineering / Game Design / UI  
**Important:** This document defines **map generation and map representation only**. It intentionally does **not** define the final Hero movement mechanic.

---

# 0. Source of Truth and Scope

This MVP must comply with the current Hexoflat Master Design & Implementation Guide.

Canonical constraints that matter here:

- Board First, UI Second.
- The world is discovered, not selected.
- Important world state must have a visible representation.
- Terrain must be capable of becoming gameplay, not mere decoration.
- Progression and future movement systems should create meaningful spatial decisions.
- Avoid needless UI panels and abstract numerical RPG presentation.
- Camp is a physical playable board, not a menu.
- World Map must be able to support future Scout, travel, terrain interaction, combat detection, and exploration systems without being redesigned from scratch.

This document intentionally freezes only the **World Map MVP generator**.

Do **not** implement:

- final Hero movement rules;
- Will / stamina / action economy;
- World Pulse;
- patrol AI;
- combat logic;
- resource ecology;
- procedural quests;
- weather;
- hunger / thirst;
- mounts;
- factions;
- large-scale world simulation.

The generator should leave architectural room for those systems, but must not invent them.

---

# 1. MVP Goal

The first objective is to answer one question:

> **Can Hexoflat generate a World Map around Camp that looks organic, mysterious, readable, and structurally suitable for a future tactical movement system?**

The MVP is successful when the player exits Camp and immediately sees a convincing piece of unknown world that:

1. does not look like a rectangular hex board;
2. clearly communicates where Camp and the Hero are;
3. exposes 2–3 interesting exploration directions;
4. creates at least one meaningful spatial choice before any advanced movement mechanic exists;
5. visually suggests that more world exists beyond the known frontier;
6. contains route structure useful for later tactical movement design.

---

# 2. Existing Context That Must Be Preserved

Current game/UI assumptions:

- Desktop uses a large Game Board on the left and Player Board on the right.
- Camp already exists as a physical hex map.
- Hero Token already exists.
- Hex-grid movement/pathfinding already exists elsewhere in the project.
- Hexes can be blocked.
- Terrain/objects can later become interactable.
- Camp visually behaves as a finite physical location.
- World Map must feel broader and less board-like than Camp.

Do not replace the Two-Board architecture.

The World Map occupies the existing Game Board area.

---

# 3. Core Representation Decision

## 3.1 Technical Grid May Remain Rectangular

The engine may continue to use a rectangular/finite axial hex coordinate container internally.

This is an implementation detail only.

The player must **never** perceive the World Map as a rectangular board.

Do not render the complete technical grid.

## 3.2 Deep Unknown Has No Visible Hex Grid

The World Map has three visual depth zones:

### Known World

Fully rendered physical hexes.

### Ghost Frontier

At most one shallow boundary layer where the player can faintly perceive possible neighboring hex structure / terrain silhouette through Fog.

### Deep Unknown

No visible hex-grid structure.

Deep Unknown is not represented as:

- black locked hexes;
- grey disabled hexes;
- empty rectangular cells;
- a complete grid hidden under dark opacity.

It should visually read as **unknown space**, not as hidden cells waiting to be filled.

---

# 4. Camp as World Anchor

When the Hero exits Camp:

1. Game Board transitions from Camp Board to World Map.
2. Camp is represented as a persistent **Camp World Anchor Token**.
3. The Hero appears on a hex adjacent to Camp.
4. The side of Camp from which the Hero exits should determine the Hero's initial World Map side where practical.

Example:

Camp east exit:

`[CAMP] [HERO] → frontier`

Do not spawn the Hero at an arbitrary side of Camp if the exit direction is already known.

---

# 5. Initial Reveal Around Camp

The World Map must not start as a perfect circle around Camp.

The initial revealed area must be:

- asymmetric;
- irregular;
- readable;
- geographically intentional.

Bad:

- perfect radius;
- symmetric flower of hexes;
- centered Camp inside a round blob.

Good characteristics:

- one side opens farther;
- one side narrows;
- one side is bounded by terrain;
- one side directly touches Ghost Frontier;
- Camp can sit slightly off-center.

The initial World Map should make Camp feel located **inside a place**, not centered inside a generated board.

---

# 6. Recommended Visual Model

Use a hybrid:

# **Organic Revealed World + Ghost Frontier**

### Known area

Full terrain/material/hex readability.

### Frontier edge

Soft Fog plus faint contextual silhouettes.

### Deep unknown

No visible board structure.

The frontier should feel organic.

Avoid a continuous decorative frame around the entire World Map.

Unlike the Camp board, the World Map boundary should be defined by:

- stone ridge;
- forest mass;
- water;
- cliff;
- broken ground;
- Fog itself;
- future terrain types.

The world should not look like a board surrounded by border tiles.

---

# 7. Core Generator Philosophy

Do not build a pure random blob generator.

Do not generate random hexes first and attempt to make them interesting afterward.

The MVP uses:

# **Archetype-Driven Procedural Generation**

The generator first chooses a spatial proposition, then produces geometry that expresses that proposition.

The map must generate **a situation**, not merely a shape.

---

# 8. MVP Generation Pipeline

The generator should execute the following conceptual layers.

## Layer 1 — Hidden Technical Grid

Create or reuse the internal coordinate space.

Responsibilities:

- coordinate identity;
- neighbor lookup;
- valid technical bounds;
- future pathfinding compatibility.

This layer is invisible to the player.

## Layer 2 — World Shape Mask

Generate an irregular set of World Hexes around Camp.

Requirements:

- asymmetrical footprint;
- Camp not mathematically centered by default;
- at least 2 viable directional branches;
- no obvious rectangular boundary;
- no simple circular radius;
- sufficient contiguous space for readable terrain composition.

The shape mask determines which technical cells currently exist as part of the local generated world.

## Layer 3 — Terrain Structure

Lay down large spatial masses.

MVP terrain structure may use abstract categories such as:

- OPEN_GROUND;
- STONE_RIDGE;
- FOREST_EDGE;
- BROKEN_GROUND;
- NARROW_PASS;
- POCKET;
- FRONTIER_EDGE.

At this stage terrain is primarily structural.

Do not add many decorative micro-types.

The purpose is to create route geometry.

## Layer 4 — Route Structure

Each accepted map must contain route-supporting geometry.

Minimum target:

- 1 clearly safer/easier route;
- 1 alternate route or potential shortcut;
- 1 side pocket;
- 1 chokepoint or narrowing;
- 1 open area;
- 1 spatial branch meaningful enough that two players may choose different first directions.

These are structural affordances only.

The final movement mechanic is not yet defined.

## Layer 5 — Frontier Promises

Add 2–3 visual curiosity signals.

A Frontier Promise is **not** a quest marker.

Possible MVP promise types:

- distant ruin silhouette;
- unusual stone formation;
- visibly different vegetation;
- glow in Fog;
- smoke;
- beginning of an old path;
- stream disappearing into Fog;
- partially visible obelisk;
- suspicious fracture;
- unusual elevation silhouette.

The player should think:

> "What is that?"

Do not display:

- exclamation marks;
- quest arrows;
- objective GPS lines;
- labels that reveal exactly what is hidden.

## Layer 6 — Gameplay Anchors

Place a very small number of future-facing anchor points.

MVP may reserve:

- 1 main landmark slot;
- 1 optional obstacle slot;
- 1 terrain interaction candidate;
- 1 resource-hint candidate;
- 1 shortcut candidate;
- 1 side-interest / return-worthy slot.

These anchors need not have final gameplay yet.

They exist so the generated map can later support tactical movement and interaction.

---

# 9. MVP Archetypes

Implement only 3–4 strong archetypes.

Do not begin with a large library.

## 9.1 FORKED_FRONTIER

### Player-facing idea

The Hero exits Camp and quickly sees two meaningfully different exploration directions.

### Required topology

- Camp near a branch;
- left/right or forward/side route distinction;
- one direction visually more open;
- another direction partially constrained;
- one Promise visible beyond one branch.

### Purpose

Tests whether the map naturally produces route curiosity.

## 9.2 RIDGE_AND_POCKET

### Player-facing idea

A stone ridge shapes movement, while a small optional pocket invites investigation.

### Required topology

- visible terrain barrier;
- natural route around it;
- side pocket;
- possible future destructible/interactive section;
- another route continues toward Frontier.

### Purpose

Tests future compatibility with terrain manipulation such as stone breaking.

## 9.3 OPEN_FIELD_NARROW_PASS

### Player-facing idea

Contrast between open maneuvering space and a constrained passage.

### Required topology

- one meaningful open area;
- one narrow passage;
- frontier beyond or adjacent to the pass;
- visual reason to consider both spaces.

### Purpose

Tests map readability and future combat/movement potential.

## 9.4 LANDMARK_PULL

### Player-facing idea

A strong distant Promise is visible, but the direct route is not trivial.

### Required topology

- one high-salience landmark silhouette;
- no straight trivial path;
- at least two possible approaches or one approach + side option;
- terrain visually explains the detour.

### Purpose

Tests exploration motivation.

---

# 10. Recommended First MVP Blend

For the first visible prototype, prioritize a blend of:

# **FORKED_FRONTIER + RIDGE_AND_POCKET**

Target composition:

- Camp Anchor;
- Hero adjacent to Camp;
- two exploration directions;
- one main Landmark Promise;
- one stone/terrain ridge;
- one side pocket;
- one open area;
- one narrow transition;
- one potential alternate/shortcut line.

This composition is likely to expose whether later tactical movement can become interesting.

---

# 11. Frontier Promise Rule

Adopt the following MVP design rule:

> **Every visible Frontier should contain at least one reason to wonder what lies beyond it.**

This does not mean every edge needs content.

At any given first-screen composition:

- minimum 1 strong Promise;
- ideally 2–3 different signals;
- avoid visually overloading the player.

Promise strength should vary.

Example:

- one major distant silhouette;
- one minor strange stone;
- one subtle vegetation cue.

---

# 12. Route-Friendly Map Requirements

Because the final Hero movement mechanic will be designed later, the generator must avoid maps that eliminate tactical potential.

Every accepted seed should support the following categories.

## 12.1 Route Choice

At least two plausible early movement choices.

Not two paths that immediately reconverge with no meaningful difference.

## 12.2 Spatial Contrast

At least two of:

- open;
- narrow;
- blocked;
- pocket;
- edge;
- branching;
- obstacle-adjacent.

## 12.3 Meaningful Stopping Locations

The topology should contain places where a future movement system could reasonably create a decision to stop.

Examples:

- before a pass;
- beside a terrain interaction;
- at a branch;
- inside a sheltered pocket;
- at the edge of Frontier.

Do not implement stop rules yet.

## 12.4 Interaction-Compatible Adjacency

Terrain structures should produce useful adjacent hexes around:

- stone;
- landmark;
- resource candidate;
- obstacle candidate.

This preserves compatibility with Hexoflat's existing interaction grammar where the Hero is typically adjacent to the interacted object/hex.

## 12.5 Readability

A player should be able to visually read:

- route;
- barrier;
- open area;
- frontier;
- Camp;
- Hero;
- at least one Promise.

Do not require labels for basic spatial comprehension.

---

# 13. Seed Rejection

Not every generated result is valid.

The generator must reject bad seeds.

Minimum rejection conditions:

1. Camp is visually over-centered in a symmetric blob.
2. Revealed world is nearly circular.
3. Map silhouette visibly exposes the rectangular technical grid.
4. Fewer than 2 plausible exploration directions exist.
5. No meaningful branch exists.
6. No open area exists.
7. No narrowing/chokepoint exists.
8. No side pocket exists.
9. All Frontier edges look compositionally identical.
10. No Frontier Promise exists.
11. All candidate routes are effectively equivalent.
12. Landmark Promise is immediately adjacent to Camp with no exploration.
13. Terrain composition is visually noisy/unreadable.
14. Hero spawn has no clear legal neighboring continuation.
15. Generated barrier blocks all progression.
16. A future interaction candidate has no valid adjacent Hero hex.
17. The output looks like a board with decorative border tiles rather than world terrain.

Rejected seeds should be regenerated.

---

# 14. Generator Output Contract

Suggested conceptual output:

```ts
type WorldMapMvpResult = {
  seed: string;
  archetype: WorldMapArchetype;
  campAnchor: CampAnchorPlacement;
  heroSpawn: HexCoord;
  worldHexes: GeneratedWorldHex[];
  frontier: FrontierDescriptor[];
  promises: FrontierPromise[];
  anchors: GameplayAnchor[];
  validation: GeneratorValidationResult;
};

type WorldMapArchetype =
  'FORKED_FRONTIER' | 'RIDGE_AND_POCKET' | 'OPEN_FIELD_NARROW_PASS' | 'LANDMARK_PULL';

type HexCoord = {
  q: number;
  r: number;
};

type GeneratedWorldHex = {
  coord: HexCoord;
  terrainType:
    | 'OPEN_GROUND'
    | 'STONE_RIDGE'
    | 'FOREST_EDGE'
    | 'BROKEN_GROUND'
    | 'NARROW_PASS'
    | 'POCKET'
    | 'FRONTIER_EDGE';
  traversability: 'OPEN' | 'BLOCKED' | 'RESERVED_INTERACTION';
  discoveryVisual: 'KNOWN' | 'GHOST_FRONTIER';
};

type CampAnchorPlacement = {
  coord: HexCoord;
  exitDirection?: number;
};

type FrontierPromise = {
  id: string;
  type:
    | 'LANDMARK_SILHOUETTE'
    | 'STONE_FORMATION'
    | 'VEGETATION_SIGNAL'
    | 'GLOW'
    | 'SMOKE'
    | 'OLD_PATH'
    | 'STREAM'
    | 'OBELISK_FRAGMENT'
    | 'FRACTURE_SIGNAL';
  sourceCoord?: HexCoord;
  frontierDirection: number;
  strength: 'SUBTLE' | 'MEDIUM' | 'STRONG';
};

type GameplayAnchor = {
  id: string;
  coord: HexCoord;
  kind:
    | 'LANDMARK_SLOT'
    | 'OBSTACLE_SLOT'
    | 'TERRAIN_INTERACTION_SLOT'
    | 'RESOURCE_HINT_SLOT'
    | 'SHORTCUT_SLOT'
    | 'SIDE_INTEREST_SLOT';
};

type FrontierDescriptor = {
  boundaryCoords: HexCoord[];
  dominantDirection: number;
  ghostDepth: 0 | 1;
};

type GeneratorValidationResult = {
  accepted: boolean;
  rejectionReasons: string[];
  metrics: {
    branchCount: number;
    promiseCount: number;
    openAreaCount: number;
    chokePointCount: number;
    pocketCount: number;
    symmetryScore: number;
  };
};
```

These names are implementation suggestions, not permanent canonical naming.

Prefer adapting to existing project naming conventions rather than duplicating established types.

---

# 15. Discovery Rendering for MVP

The MVP needs only two actual rendered world states plus Deep Unknown.

## KNOWN

Fully rendered terrain hex.

## GHOST_FRONTIER

Soft/faint representation of the immediate frontier.

Possible presentation:

- low-opacity terrain silhouette;
- muted geometry;
- partially obscured hex edge;
- fog overlay.

Do not reveal full object/content identity.

## DEEP_UNKNOWN

Do not render underlying hex structure.

Use board background / fog field / darkness / atmospheric treatment.

Deep Unknown is a visual absence of map knowledge.

---

# 16. World Map Visual Composition

The map should sit naturally inside the current Game Board area.

Do not force the generated cluster to fill the entire left panel.

Empty surrounding board space is acceptable and desirable.

Camera framing should:

- include Camp;
- include Hero;
- include immediate known area;
- include at least one visible Promise;
- leave meaningful Fog/deep unknown around the cluster.

The player should visually feel that the world continues beyond what is currently understood.

---

# 17. UI Requirements

No new permanent panel is required for the MVP.

Use the current Game Board + Player Board architecture.

For this MVP:

- Player Board does not need new generator/debug information in production mode.
- Debug mode may show seed/archetype/validation.
- No top bar is introduced.
- No minimap is required.
- No percentage explored.
- No "Map 12%" counter.
- No quest-marker layer.

Board remains the primary source of navigation information.

---

# 18. Debug / Developer Controls

For iteration, add a development-only generator control surface or console API.

Minimum developer functionality:

- generate random seed;
- regenerate same seed;
- generate next seed;
- force archetype;
- show/hide Ghost Frontier;
- show technical hex grid;
- show rejected-seed reason;
- display structural analysis;
- export seed;
- copy seed.

The debug UI must not leak into production player UI.

---

# 19. Determinism

The MVP generator must be deterministic.

Given:

- generator version;
- seed;
- archetype;
- same configuration;

the generated topology must be identical.

This is required for:

- debugging;
- QA;
- visual comparison;
- later playtests;
- reproducible bug reports.

Suggested identifier:

`world-map-mvp-v0.1:<seed>:<archetype>`

---

# 20. Generation Order

Recommended implementation order:

1. Reuse/confirm axial hex coordinate utilities.
2. Define World Map MVP data model.
3. Define deterministic seeded random source.
4. Implement Camp Anchor placement.
5. Implement irregular shape-mask generator.
6. Add asymmetry validation.
7. Implement terrain-structure layer.
8. Implement route-structure analyzer.
9. Detect branches.
10. Detect open areas.
11. Detect chokepoints.
12. Detect side pockets.
13. Implement initial archetype: FORKED_FRONTIER.
14. Implement RIDGE_AND_POCKET.
15. Implement OPEN_FIELD_NARROW_PASS.
16. Implement LANDMARK_PULL.
17. Implement Frontier boundary extraction.
18. Implement Ghost Frontier one-layer descriptors.
19. Implement Frontier Promise placement.
20. Implement Gameplay Anchor reservation.
21. Implement seed validation.
22. Implement seed rejection/regeneration loop.
23. Render KNOWN world.
24. Render Ghost Frontier.
25. Ensure Deep Unknown renders no hex structure.
26. Integrate Camp World Anchor token.
27. Spawn Hero adjacent to Camp.
28. Respect Camp exit direction if available.
29. Add camera framing.
30. Add development generator controls.
31. Add seed/archetype debug overlay.
32. Save/load seed + generator version.
33. Add automated topology tests.
34. Generate visual sample set.
35. Review 10+ accepted maps manually.
36. Freeze MVP generator for movement-design evaluation.

Do not implement movement mechanics after step 36 inside this task.

---

# 21. Automated Validation / Linter

The generator validator should evaluate at least:

### Connectivity

Hero must have reachable OPEN space.

### Branching

At least 2 meaningful initial exploration directions.

### Route distinction

Branches must differ structurally.

### Open area

At least one open cluster above a configured minimum size.

### Chokepoint

At least one narrowing.

### Pocket

At least one side pocket or optional branch.

### Promise

At least one strong/medium Promise.

### Asymmetry

Reject strongly symmetric maps.

### Rectangular visibility

Reject maps whose visible footprint strongly exposes technical bounds.

### Interaction readiness

Reserved interaction anchors need at least one adjacent usable Hero hex.

### No hard lock

Terrain cannot seal the Hero into Camp start.

---

# 22. MVP Configuration Parameters

Keep configurable rather than hardcoding.

Suggested starting parameters:

```ts
type WorldMapMvpConfig = {
  knownHexMin: number;
  knownHexMax: number;

  minInitialBranches: number;
  maxInitialBranches: number;

  minOpenAreaSize: number;
  minPocketSize: number;

  requiredChokePoints: number;
  requiredPromises: number;
  maxPromises: number;

  ghostFrontierDepth: 1;

  maxSeedAttempts: number;

  campCenterBias: number;
  symmetryRejectThreshold: number;

  archetypeWeights: Record<WorldMapArchetype, number>;
};
```

Do not expose raw generator numbers to the player.

These are design/engineering parameters only.

---

# 23. First Visual Review Set

Before connecting a movement system, generate at least:

- 3 FORKED_FRONTIER maps;
- 3 RIDGE_AND_POCKET maps;
- 2 OPEN_FIELD_NARROW_PASS maps;
- 2 LANDMARK_PULL maps.

Minimum total:

# **10 accepted maps**

For each sample capture:

- full Game Board screenshot;
- seed;
- archetype;
- known hex count;
- branch count;
- chokepoint count;
- pocket count;
- promises;
- rejection attempts before acceptance.

---

# 24. Human Review Questions

For each of the 10 maps ask:

1. Does it look like a place rather than a generated board?
2. Can I immediately locate Camp and Hero?
3. Does the map hide its rectangular technical origin?
4. Do I see at least two plausible directions?
5. Is one direction visually more interesting?
6. Do I want to know what lies beyond the Fog?
7. Is the map too symmetric?
8. Is the map too noisy?
9. Can I mentally identify route structure?
10. Can I imagine a tactical movement mechanic making these spaces interesting?
11. Is there at least one natural stopping/decision point?
12. Does terrain appear capable of becoming interactable later?
13. Does any Promise feel like a quest marker rather than a world signal?
14. Does Fog feel like unknown world rather than disabled board cells?

If repeated answers are negative, tune generator grammar before designing final Hero movement.

---

# 25. Stop Gate for This MVP

Stop adding generator features when the MVP can reliably generate at least 10 maps that satisfy:

1. same recognizable Hexoflat world-map language;
2. visibly irregular shape;
3. no obvious rectangular board;
4. no obvious copy-paste layout;
5. at least two exploration choices;
6. at least one strong curiosity Promise;
7. useful open/narrow/pocket/barrier contrast;
8. route geometry suitable for movement experimentation;
9. clear Camp/Hero readability;
10. accepted seeds survive both automated validation and human visual review.

At that point:

# **FREEZE GENERATOR MVP**

Then begin design of the Hero World Movement mechanic using these generated maps as the actual testbed.

Do not add:

- more biomes;
- weather;
- procedural NPCs;
- complex resources;
- rivers simulation;
- ecology;
- large landmarks library;

until movement experiments reveal that they are necessary.

---

# 26. Acceptance Criteria

The MVP is implementation-complete when:

### Generation

- Same seed produces same map.
- All four archetypes can generate accepted maps.
- Invalid seeds are rejected.
- Generator does not infinite-loop when a seed cannot satisfy constraints.

### Representation

- Technical rectangular grid is not visible to the player.
- Deep Unknown contains no visible hidden hex grid.
- Ghost Frontier is max one shallow layer.
- World shape is irregular.
- Camp appears as a World Anchor.
- Hero appears adjacent to Camp.

### Spatial Design

- Every accepted map contains at least 2 meaningful early directions.
- Every accepted map has open-space contrast.
- Every accepted map has at least one chokepoint.
- Every accepted map has at least one side pocket.
- Every accepted map includes at least one Frontier Promise.
- No accepted map hard-locks the Hero.

### UI

- No additional permanent gameplay panel is required.
- Game Board remains dominant.
- No exploration percentage.
- No quest-marker system.
- Fog does not read as disabled rectangular tiles.

### Engineering

- Seed and generator version are serializable.
- Generator is independent from the final movement mechanic.
- Existing pathfinding can later consume generated traversability.
- Terrain and anchors are data-driven.
- Debug tooling can reproduce a seed.

### Review

- At least 10 accepted maps are reviewed visually.
- A designer can plausibly imagine multiple movement strategies on the sample set.
- Generator is then frozen for movement-design testing.

---

# 27. Explicit Non-Goals

Do not implement in this MVP:

- full infinite/open world;
- chunk streaming;
- hero movement economy;
- turns;
- Scout progression;
- Will;
- World Pulse;
- stealth;
- enemies;
- combat detection;
- dynamic terrain destruction;
- harvesting;
- crafting;
- quests;
- resource respawn;
- fast travel;
- travel network;
- minimap;
- weather;
- time of day.

Any code hooks for future systems should remain lightweight and data-driven.

---

# 28. Key Design Rule

The most important rule of the MVP:

> **The generator must not ask “What random shape should I make?”**

It must ask:

> **“What spatial situation should the player see when stepping into the unknown?”**

Shape, terrain, Frontier, and Promises are generated to support that situation.

---

# 29. Final Implementation Target

After implementation, the developer/designer should be able to:

1. exit Camp;
2. enter World Map;
3. see Camp represented as one World Anchor;
4. see Hero beside Camp;
5. see an irregular known-world cluster;
6. see immediate Ghost Frontier;
7. see no grid in Deep Unknown;
8. recognize at least two exploration directions;
9. see 1–3 environmental Promises;
10. regenerate multiple seeds/archetypes;
11. compare at least 10 visually distinct but structurally useful maps.

Only after this target is reached should Hexoflat begin the next design phase:

# **Unique Hero World Movement Mechanic**

The movement system must be designed **against real generated map samples**, not against an abstract empty hex grid.

---

**End of document.**
