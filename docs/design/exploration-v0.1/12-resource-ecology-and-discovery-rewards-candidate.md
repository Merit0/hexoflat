# HEXOFLAT — Resource Ecology & Discovery Rewards

**Version:** Candidate v0.1  
**Status:** Design Candidate — NOT canonical until approved/playtested  
**Parent systems:** `Hexoflat_Frontier_Exploration_and_Resource_Ecology_Candidate_v0.1.md`, `Hexoflat_Region_Grammar_Generator_Candidate_v0.1.md`  
**Primary design contract:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Audience:** Game Design, Product, UI/UX, Engineering, Claude Code

---

# 0. Canonical Compatibility and Explicit Boundaries

This candidate preserves the current Hexoflat design contract:

- **Position → Manipulate → Chain → Consequence**;
- **The World Is Discovered, Not Selected**;
- **Everything Important Is Represented**;
- **Progression Expands Possibility**;
- **Board First, UI Second**;
- **Smallest Sufficient Representation Wins**;
- **No Invisible State** for known decision-relevant information;
- **Anti-Friction Rule**: small pickup actions stay fast and integrated;
- resources connect major playable systems rather than existing as isolated inventory clutter;
- natural counted quantities may use numbers, but abstract RPG power values should not become the player-facing language.

This candidate makes the following **new candidate decisions** and does not silently promote them to canon:

1. Important resource types live in **recognizable habitats**, not independent random scatter.
2. A resource can progress through **knowledge states** so learning where it belongs becomes player mastery.
3. Routine loose pickup and strategic harvesting are different interaction classes.
4. Strategic resource sources can leave persistent world states after harvesting.
5. Major discoveries should usually reward the player on **two dimensions**, not only with material loot.
6. Repeatedly needed resources must eventually become easier to source through knowledge, known routes, source mastery, Camp production, or another approved systemic shortcut.
7. The resource system must never require the player to vacuum every visible node or clear a percentage of a biome.

---

# 1. Experience Promise

Hexoflat resource play should create this feeling:

> **“I do not search for colored loot dots. I learn what the land is telling me, decide whether a source is worth changing my route for, take what I need, and use what I found to unlock another way of interacting with the world.”**

The player should gradually move through this mastery arc:

**See object → recognize clue → identify resource → learn habitat → predict source → exploit source intelligently → need less explicit guidance**

A successful resource discovery should often answer one question and create another:

> “I found the remedy plant.” → “Why does it only grow beside these cold stones?” → “Can I find more near the northern ridge?” → “Can this plant be cultivated at Camp?”

The long-term resource fantasy is **world literacy**, not inventory accumulation.

---

# 2. Signature Resource Loop

The candidate loop is:

**Need / Curiosity → Environmental Signal → Route Decision → Source Discovery → Interaction Choice → Resource / Knowledge → Use in Another System → New Capability / Route / Question → Deeper Exploration**

Examples:

### Healing chain

**Wound/Vitality need → recognize medicinal habitat → detour → Take/Harvest plant → return/use Crafting or Healing Game → create Elixir → recover → next expedition can go deeper**

### Route chain

**See broken ravine route → discover Timber source → harvest/logically obtain Timber → use future bridge/repair system → route becomes traversable → new region becomes accessible**

### Geology chain

**Stone Crust blocks route → Pickaxe breaks crust → Stone Fragment appears as by-product → fragment later supports Crafting/Camp/route stabilization → permanent shortcut remains**

The resource should therefore be a **connector**, not an endpoint.

---

# 3. Resource Taxonomy by Gameplay Role

Do not classify resources primarily as `Common / Rare / Epic`.

Classify them by what they let the player do.

## 3.1 Recovery Resources

Feed healing, remedy, status recovery, or expedition preparation.

Example starter candidate:

- Medicinal Plant.

## 3.2 Structure Resources

Feed world topology, Camp growth, repairs, traversal structures, or physical construction.

Starter candidates:

- Timber;
- Stone Fragment.

## 3.3 Binding / Utility Resources

Feed tools, ropes, bindings, field equipment, repairs, or temporary world manipulation.

Later candidate:

- Binding Fiber.

## 3.4 Catalysts

Change how another resource/tool/system behaves rather than being a bulk ingredient.

Later examples:

- alchemical catalyst;
- heat-reactive resin;
- spirit-reactive material.

## 3.5 Unique Specimens / Relics

Finite authored discoveries.

They should not respawn and should not behave like farmable crafting currency.

Possible uses:

- lore/mystery;
- new interaction grammar;
- permanent Camp/system unlock;
- hero/companion/story connection.

## 3.6 Knowledge Discoveries

Not necessarily physical inventory resources.

Examples:

- recognize Fractured Stone;
- learn that a plant grows at a specific terrain boundary;
- understand a threat trace;
- learn a safe harvesting method;
- understand that a certain ruin symbol marks an underground passage.

Knowledge is a legitimate reward category.

---

# 4. Resource Definition Contract

Every resource type must answer all of these before implementation:

| Field                 | Requirement                                                 |
| --------------------- | ----------------------------------------------------------- |
| Identity              | What is it in-world?                                        |
| Role                  | Which gameplay possibility does it enable?                  |
| Habitat               | Why is it found there?                                      |
| Signal                | What can the player notice before finding the exact source? |
| Interaction           | Take, Cut, Break, Extract, Preserve, etc.                   |
| Source State          | How does the source visibly change?                         |
| Sink                  | Where is the resource meaningfully used?                    |
| Repeat Need           | How often will the player need it?                          |
| Anti-Grind Escape     | How does sourcing become easier after mastery?              |
| Representation        | Token / source object / terrain state / marker              |
| Inventory Form        | Loose token, stack, slot, special item, etc.                |
| Knowledge Progression | What can the player learn about it?                         |
| Procedural Rule       | Which Region Grammars may place it?                         |
| Narrative Hook        | What must lore eventually explain?                          |

A resource fails design review if it is included only because “crafting games need materials.”

---

# 5. The Two Interaction Classes

This distinction is mandatory for avoiding grind.

## 5.1 Routine Pickup

Used when there is **no meaningful harvesting decision**.

Examples:

- loose Stone Fragment created by breaking a wall;
- dropped Timber piece;
- already-cut herb bundle;
- item lying on the ground.

Control remains the existing Hexoflat grammar:

**Hand Token → overlap resource token → Take**

Candidate rule:

- routine Take should not create a separate minigame;
- where action economy allows, it should not unnecessarily end the entire exploration flow;
- animation is short and skippable/fast;
- resource token physically disappears or changes state when collected.

## 5.2 Strategic Harvest / Transformation

Used only when the interaction creates a meaningful decision.

Examples:

- cut a living tree and alter route geometry;
- break Stone Crust and create a permanent passage;
- harvest a rare patch in a way that affects future regrowth;
- extract a source that makes noise near a patrol;
- consume a source to create an immediate terrain effect.

Strategic harvesting may consume the exploration **Act** because the action itself is gameplay.

### Design law

> **If harvesting does not change route, risk, future source state, knowledge, or another system, it should probably be Routine Take.**

---

# 6. Resource Sources Are States, Not Vending Machines

A strategic source must have readable physical states.

Generic candidate grammar:

**Unrecognized → Recognized → Available → Disturbed / Preserved / Transformed → Recovering / Stable / Exhausted**

Not every resource uses every state.

No hidden percentage such as `Plant Node 63% regenerated` is required.

Examples:

### Medicinal patch

**Healthy Patch → Harvested Patch → Recovering Patch → Healthy Patch**

### Stone Crust

**Intact → Broken Passage**

No regeneration.

### Tree

Possible later grammar:

**Standing → Felled → Timber + Changed Terrain**

A source state matters only if it changes player decisions.

---

# 7. Habitat Grammar — The Core Unique Hook

Resources must have **places where they make sense**.

A habitat is a relationship between terrain and world cues, not a random spawn radius.

A resource habitat can reference:

- terrain type;
- terrain boundary;
- shelter/exposure;
- nearby water;
- geology;
- ruin presence;
- threat behavior;
- world-state condition;
- time/event condition later if approved.

Example candidate medicinal habitat:

> grows beside cool Stone Mass where damp ground meets low vegetation.

The player first notices the plant itself.

Later they learn:

> **cool stone + damp fringe = likely medicinal habitat.**

Then future exploration changes from:

> “Where did the generator spawn the green token?”

into:

> “That ridge has the exact terrain pattern I learned. I should inspect it.”

This is **resource mastery through observation**.

---

# 8. Resource Knowledge Progression

Use the same world-discovery philosophy as the map.

Candidate resource knowledge states:

## UNKNOWN

The player has not encountered the resource or its reliable clue.

## SEEN

The resource/source has been directly observed, but its use or habitat may be unclear.

## IDENTIFIED

The player understands what it is and at least one meaningful use.

## HABITAT_KNOWN

The player understands reusable environmental cues associated with the source.

## SOURCE_MASTERED

The player has a reliable way to exploit or revisit the source without repeated blind searching.

Possible mastery outcomes:

- known habitat markers on already-understood map areas;
- Known Route connection;
- Camp cultivation/production later;
- extraction tool upgrade;
- Scout can classify habitat from farther away;
- source becomes part of expedition planning.

Do not award knowledge purely through an XP bar.

Knowledge should come from:

- discovery;
- use;
- authored teaching event;
- observing a pattern;
- interacting with an expert/facility later.

---

# 9. Resource Clues and Breadcrumbs

The player should often be able to infer a source **before seeing the exact token**.

Clue types:

- distinctive nearby vegetation;
- stone coloration/fracture;
- fallen leaves/branches;
- tracks;
- spores;
- reflected glow;
- environmental sound;
- animal behavior;
- ruin material;
- terrain boundary.

The clue must not become a floating `RESOURCE HERE` icon.

Scout progression can improve clue interpretation:

- low Scout: sees visual cue only;
- Frontier Reading: classifies it as `possible medicinal habitat`;
- later mastery: recognizes exact known resource family if justified.

---

# 10. Need-Driven Exploration Without Quest-Marker Spam

The game should help the player remember **what they need** without telling them exactly where hidden resources are.

Candidate model:

1. Another system creates a need, e.g. Elixir requires Medicinal Plant.
2. Player can pin that need as an **Expedition Intent**.
3. The map does not reveal hidden plant tokens.
4. Known `HABITAT_KNOWN` areas may receive a subtle board-native emphasis when the Player Board is in travel/exploration context.
5. Scout may classify new environmental signals relevant to the pinned need.

This turns the map into:

> “Where do I expect to find this?”

not:

> “Follow the glowing line to resource icon #12.”

Expedition Intent is a candidate marker/Player Board state, not a permanent quest panel.

---

# 11. Strategic Harvest Choices — Use Sparingly

Not every plant asks the player to choose a harvest mode.

For **important renewable sources**, a strategic choice may exist.

Candidate pattern:

## Preserve

- take a smaller immediate yield;
- source stays stable or recovers quickly;
- low world disturbance.

## Extract

- take the full current usable source;
- source becomes Disturbed/Exhausted for a longer cycle;
- may create Noise or topology consequence where appropriate.

## Transform

- use the source as a world tool rather than carrying it away;
- example: fell tree to create/clear route;
- source changes topology permanently or semi-permanently.

This choice is valid only when both outcomes are useful in different contexts.

Do **not** create a moral meter for harvesting by default.

Do **not** make every common herb a sustainability decision.

---

# 12. Resource Ecology and World Pulse

World Pulse may advance clearly represented resource states.

Possible candidate uses:

- Recovering Patch advances toward Healthy after expedition/world-cycle conditions;
- a temporary exposed resource decays/disappears;
- threat behavior shifts around a disturbed habitat;
- weather later changes which clue becomes visible.

Critical rule:

> **The player must not be encouraged to stand beside a resource and repeatedly press Gather Will until it respawns.**

Therefore renewable recovery should prefer:

- expedition completion;
- meaningful world milestones;
- region/world cycles;
- multiple World Pulses plus distance/absence conditions;

rather than immediate local farming.

Exact cadence remains a tuning parameter and should be invisible unless decision-relevant.

---

# 13. Resource Scarcity Without Grind

Scarcity should create **route decisions**, not repetitive chores.

Good scarcity:

> “I have one Remedy source known nearby and a deeper expedition ahead. Do I use the current Elixir now or save it?”

Bad scarcity:

> “I need 37 plants, so I will walk the same loop twelve times.”

Candidate laws:

1. No starter recipe should require a large pile of repeated pickups merely to create playtime.
2. Resources required frequently must have a mastery shortcut.
3. A newly unlocked system should not immediately invalidate old habitats; old areas can remain useful when their resource identity remains relevant.
4. Rare means **situationally difficult to access or understand**, not necessarily microscopic drop chance.
5. Avoid random enemy drops as the primary source for exploration resources unless enemy ecology is itself meaningful.

---

# 14. Resource Sinks — Every Resource Must Matter

A resource source is pointless if the sink is weak.

## 14.1 Sink Rule

A repeatable resource should have either:

- at least two meaningful sinks;

or

- one strong recurring systemic sink plus a clear progression path that keeps it relevant.

Avoid disposable intermediate ingredients whose only purpose is:

`A + B → Intermediate C → immediately use C in D`.

If C creates no decision, remove it.

## 14.2 Sink Categories

- Healing Game;
- Crafting Game;
- Camp development;
- traversal construction/repair;
- equipment maintenance only if maintenance becomes meaningful gameplay;
- companion contract/support later;
- authored world interaction;
- trade only if Shop/Trading system eventually creates an interesting decision.

Do not add “sell junk” resources solely to fill loot tables.

---

# 15. Resource-to-World Reciprocity

A signature rule for Hexoflat should be:

> **The world gives the player resources; the player can use some of those resources to change the world.**

Examples:

- Timber → repair a bridge;
- Rope/Gear → create a traversal connection;
- Stone → stabilize a collapsed route;
- Remedy → survive/prepare for a deeper dangerous region;
- special catalyst → alter a terrain state later.

This creates the loop:

**Explore → Gather → Build/Transform → Reach → Discover → Gather something new**

Resource progression therefore expands **topology and verbs**, not just crafting menus.

---

# 16. Discovery Reward Taxonomy

A discovery can reward the player in several dimensions.

## R1 — Topology

- shortcut;
- passage;
- bridge socket;
- Known Route;
- safe return path.

## R2 — Knowledge

- habitat understanding;
- threat behavior;
- terrain rule;
- mystery clue;
- location relationship.

## R3 — Capability

- new Tool Token;
- new Tool interaction;
- Scout capability;
- traversal method;
- ability mode.

## R4 — System Access

- Healing facility;
- Crafting facility;
- Camp upgrade;
- companion opportunity;
- dungeon/location access.

## R5 — World State

- safe source established;
- threat displaced;
- route repaired;
- landmark understood;
- region changed.

## R6 — Narrative / Mystery

- authored clue;
- hero history;
- world explanation;
- unresolved question that points elsewhere.

## R7 — Material

- resource;
- item;
- gold;
- equipment.

Material is valid, but it should not be the universal answer to curiosity.

---

# 17. The Two-Dimensional Discovery Reward Rule

Candidate rule:

> **A major optional discovery should usually reward at least two different dimensions.**

Examples:

### Secret fracture

- R1 Topology: hidden shortcut;
- R2 Knowledge: learn Fractured Stone cue.

### Rare medicinal habitat

- R7 Material: Medicinal Plant;
- R2 Knowledge: learn habitat pattern.

### Ruin

- R6 Mystery: authored clue;
- R4 System Access: new location interaction later.

### Broken bridge repair

- R1 Topology;
- R5 World State.

This prevents the repeated pattern:

**explore → chest → currency**.

Minor discoveries may reward only one dimension.

---

# 18. Reward Motive Rotation

The Region Grammar anti-repetition memory should track recent **reward motives**.

Candidate motive tags:

- `MATERIAL`;
- `KNOWLEDGE`;
- `TOPOLOGY`;
- `CAPABILITY`;
- `NARRATIVE`;
- `SYSTEM_ACCESS`;
- `WORLD_STATE`;
- `RESOURCE_SOURCE`.

If the last three optional branches mainly paid Material, the generator should strongly prefer a different motive where context permits.

Do not guarantee a rigid sequence.

The goal is to prevent the player from learning:

> “Every side path is just another resource cache.”

---

# 19. Discovery Should Create Another Question

Major discoveries should ideally produce a **continuation hook**.

Examples:

- a plant source points to a colder region where a stronger variant may exist;
- a broken emblem matches a ruin visible elsewhere;
- a shortcut exposes an unknown valley;
- a resource requires a tool the player has seen but not unlocked;
- a map clue suggests another landmark.

This is curiosity-driven progression.

The hook should often be environmental or journal/knowledge-based rather than a quest-marker chain.

---

# 20. No Empty Container Rule

Do not fill exploration with barrels, crates, bushes, stones, and corpses that invite interaction but frequently contain nothing meaningful.

If an object visually promises interaction:

- it should usually provide a relevant outcome;
- or its emptiness must itself communicate useful world information.

Avoid teaching the player to stop caring about interactable objects.

---

# 21. Resource Density Rules

The map should not look like a field of tokens.

Candidate principles:

- resources appear in **clusters or sources**, not even random distribution;
- one habitat can visually contain several decorative plants but expose only the meaningful interactable source/token;
- the player should often recognize “this is a medicinal patch” rather than click five separate leaves;
- strategic nodes should be sparse enough to read as important;
- routine loose by-products should disappear quickly after Take.

The UI must prioritize world readability over collectible density.

---

# 22. Starter Resource Ecology Vertical Slice

Do not implement ten resources initially.

Use three resources plus one optional fourth.

## 22.1 Medicinal Plant

**Role:** Recovery resource.  
**Habitat:** damp/shaded boundary near Stone Mass or equivalent starter terrain clue.  
**Interaction:** routine Take for loose specimen; strategic source interaction only for a persistent patch.  
**Sink:** Healing/Crafting integration, even if mocked initially.  
**Knowledge lesson:** resources live in recognizable habitat.  
**Anti-grind escape:** known habitat memory; later Camp cultivation candidate.

## 22.2 Stone Fragment

**Role:** Structure/Crafting by-product.  
**Source:** breaking approved Stone Crust, authored loose geological source.  
**Interaction:** Pickaxe transformation creates fragment; Hand Take is routine.  
**Sink:** mocked route stabilization or Crafting sink in vertical slice.  
**Knowledge lesson:** terrain manipulation can produce usable material.  
**Anti-grind escape:** never require repeatedly breaking cosmetic rock solely for fragments.

## 22.3 Timber

**Role:** Structure/traversal/Camp.  
**Source:** fallen timber token for v0.1; strategic tree transformation may come later.  
**Interaction:** routine Take for fallen piece; Axe/Fell later for strategic source.  
**Sink:** mocked bridge/route repair or Camp project.  
**Knowledge lesson:** resource can become topology.

## 22.4 Binding Fiber — optional fourth

**Role:** Utility/traversal.  
**Habitat:** wet/edge vegetation pattern distinct from Medicinal Plant.  
**Sink:** Rope/Gear or field route tool later.  
**Purpose in slice:** test whether two visually similar plant families can be learned from different habitat cues without UI clutter.

Do not add Binding Fiber until the first three-resource loop is readable.

---

# 23. Starter Discovery Reward Set

The vertical slice should deliberately contain all of these:

1. **Material discovery** — Medicinal Plant.
2. **Knowledge discovery** — learn one habitat cue.
3. **Topology discovery** — break/open one persistent shortcut.
4. **Mystery discovery** — one authored clue with no immediate material reward.
5. **Future capability tease** — visible route/interaction that cannot yet be used but is clearly not a bug.
6. **Known Source** — one resource habitat becomes remembered on the understood map.

This tests whether exploration remains satisfying without a chest at every endpoint.

---

# 24. Interaction with Path of Will

Resource decisions must affect movement.

Examples:

### Route deviation

A medicinal habitat lies two hexes away from the efficient destination.

The player decides whether to:

- continue main route;
- detour now;
- end the current Burst near the habitat;
- Gather Will in a safer location and return.

### World Pulse exposure

A resource lies in an exposed basin.

Gathering Will there may let a patrol move.

### Tool transformation

Stone Crust is on the route.

`Move → Pickaxe/Break → passage opens → Take fragment → remaining Move` where rules permit.

The resource system therefore participates in **route planning**, not only inventory.

---

# 25. Interaction with Scout

Scout should improve **resource reasoning**, not spawn rates.

Candidate effects:

### Reach

More route options can reach habitat safely.

### Waypoint

Can deliberately route through a known habitat.

### Awareness

Can interrupt movement when an important resource/habitat clue becomes newly visible.

### Trail Sense

Can show known route consequences near a resource branch.

### Frontier Reading

Can classify a visible ecology signal:

- `likely medicinal habitat`;
- `mineral fracture`;
- `unknown biological source`.

Scout never reveals exact hidden resources without a rule-based reason.

---

# 26. Interaction with Camp

Camp should gradually absorb solved maintenance needs.

Possible later progression:

- Healing facility turns Medicinal Plant into Elixir;
- garden/herbal facility can cultivate a **known mastered** common plant;
- workshop uses Timber/Stone for route/Camp projects;
- storage lets known-resource expedition planning stay compact.

Critical design rule:

> **Camp production should reduce repetitive maintenance gathering, not replace the joy of discovering new resource families.**

New/deeper resources should still pull the player outward.

---

# 27. Interaction with Crafting

Crafting recipes should reinforce exploration logic.

Prefer recipes where ingredients communicate function and geography.

Avoid recipe inflation.

Candidate recipe principles:

- few ingredients;
- every ingredient has a recognizable source;
- no unnecessary intermediate busywork;
- recipe can create a new verb, tool, route, or system interaction;
- crafting need can create an Expedition Intent without exact map coordinates.

The player should be able to answer:

> “I know where I should search for this.”

---

# 28. Interaction with Narrative and World Lore

Per Hexoflat narrative design, every important resource must eventually receive an in-world explanation:

- what it is;
- why it exists in that habitat;
- why the tool/harvest interaction works;
- why it affects Healing/Crafting/terrain in that way;
- what cultures/factions/creatures do with it.

Do not create resource names and magical effects independently from world lore forever.

For v0.1, mechanical placeholder names are allowed and should be marked as working names.

---

# 29. Procedural Placement Rules

The Region Grammar Generator must place **habitats**, not tokens first.

Pipeline:

1. select proposition;
2. build topology;
3. assign terrain grammar;
4. identify legal habitat sockets;
5. choose resource role/motive consistent with recent reward memory;
6. place environmental clue;
7. place source state/entity;
8. validate route cost/risk and purpose;
9. lint against repetition/clutter;
10. commit with deterministic seed.

Resource placement is invalid if:

- no meaningful sink exists;
- habitat clue contradicts resource definition;
- source blocks mandatory progression with no fallback;
- branch cost is obviously unreasonable for current need;
- same resource/habitat has dominated recent regions;
- resource exists only to fill empty geometry.

---

# 30. Resource Ecology Anti-Repetition Memory

Track recent resource experience separately from region shape.

Candidate memory fields:

- recent resource identities;
- recent habitat types;
- recent interaction verbs;
- recent sink motives;
- recent strategic harvest choices;
- recent reward dimensions.

Example bad sequence:

`Medicinal Plant detour → Medicinal Plant detour → different-shaped Medicinal Plant detour`

This remains repetitive even if the region geometry changes.

The generator should prefer:

`Medicinal habitat → topology shortcut → mystery clue → Timber opportunity → medicinal habitat returns in a threat-adjacent context`.

---

# 31. Resource Regeneration Model

Not all resources regenerate.

## Persistent finite

- Stone Crust;
- authored relic;
- unique specimen;
- permanent tree transformation where approved.

## Renewable source

- medicinal habitat;
- some biological/farming sources later.

## Systemically renewable

- Camp cultivation/production after mastery;
- trade/source later if approved.

The resource definition declares renewal semantics explicitly.

No generic global `respawn all nodes every N minutes` rule.

---

# 32. Failure and Fallback Rules

## Player lacks needed resource

- main campaign-critical route must have another valid route or explicit future-return state;
- optional content can remain inaccessible;
- UI explains concrete missing affordance, not `Invalid action`.

## Player over-harvests renewable source

- do not permanently soft-lock required progression;
- another habitat, recovery path, Camp alternative, or authored fallback must exist.

## Inventory full

- important discovery must not silently vanish;
- player receives clear physical/contextual choice;
- routine source stays in world if not taken where possible.

## Source becomes unreachable due topology mutation

- generator/linter must prevent critical cases;
- optional cases may become emergent consequence only if clearly understandable.

---

# 33. Game Kit Additions

Reuse existing:

- Hero Token;
- Hand Tokens;
- Tool Tokens including Pickaxe/Axe where implemented;
- Hex Tiles;
- Interaction Marker;
- Player Board;
- Fog/Discovery representation;
- Waypoint Pin;
- Will Sigil candidate.

Candidate additions:

## Resource Token

Represents collected physical resource or loose world resource.

States:

- World;
- Held/Inventory;
- Consumed/Transferred.

## Resource Source Object

Represents persistent habitat/source state when a single token is insufficient.

Examples:

- Medicinal Patch;
- Fallen Timber source;
- future tree source.

## Habitat Cue

Prefer environment art/state, not a new floating token.

Only use a marker if the clue cannot be communicated through world visuals.

## Known Source Marker

Small map-native marker shown only after the source/habitat becomes understood/mastered.

Not a loot pin for undiscovered resources.

## Expedition Intent Marker — candidate

Small temporary Player Board/map planning marker for a currently desired resource/system need.

Must disappear when no longer relevant or when unpinned.

---

# 34. UI/UX Contract

## Glance Layer

Show:

- physical resource/source;
- source state if important;
- obvious habitat cue;
- held quick resource where relevant;
- current Will/route state;
- critical known resource need only if player pinned it.

Do not show:

- every possible recipe;
- every resource count permanently;
- hidden resource locations;
- habitat percentages;
- respawn timers.

## Decision Layer

When resource/tool/source is selected or overlapped:

- valid verbs;
- route consequence where known;
- whether action transforms source/terrain;
- known important consequence such as Noise or permanent depletion;
- whether current tool supports the interaction.

## Explanation Layer

On demand:

- resource identity;
- known uses;
- known habitat clue;
- source renewal behavior if learned;
- semantic trace of transformation;
- why an action is unavailable.

---

# 35. Semantic Rule Trace Examples

Routine pickup:

`Hand → Medicinal Plant → Take → Plant enters Bag`

Terrain/resource chain:

`Pickaxe → Stone Crust breaks → Passage opens → Stone Fragment released → Pathfinder gains new route`

Strategic harvest:

`Harvest Source → Resource taken → Source becomes Disturbed → future source unavailable until recovery condition`

Knowledge:

`Observe habitat pattern → identify Medicinal Plant source → habitat becomes Known → future matching ecology signal can be classified`

---

# 36. Anti-Grind Laws

1. **No resource exists only to be sold as junk in v0.1.**
2. **No resource is placed without a current/future systemic use.**
3. **Routine collection must not halt exploration flow.**
4. **Strategic harvesting exists only when the choice matters.**
5. **Frequent needs acquire sourcing shortcuts over time.**
6. **No “collect every node” completion requirement.**
7. **No giant recipe quantities as substitute for progression.**
8. **No invisible respawn timers the player must farm.**
9. **No random-resource confetti after every fight.**
10. **No one tool/resource should invalidate world topology.**
11. **No side path reward motive should repeat indefinitely.**
12. **No discovery should train the player that curiosity usually yields useless clutter.**

---

# 37. Research-Derived Design Lessons

These are supporting lessons, not external source-of-truth overrides.

## Subnautica

Unknown Worlds publicly described several resource-design problems they intentionally redesigned: players not knowing where materials came from, resources being too plentiful, one-use intermediate ingredients creating busywork, and deeper areas lacking special reasons to visit. Their redesign concentrated resources into recognizable source contexts and removed unnecessary intermediates. This strongly supports Hexoflat's **habitat clarity + low-intermediate-count + deeper-exploration pull** direction.

## Outer Wilds

Developer discussions consistently frame curiosity and knowledge as progression: locations should teach something useful and steer the player toward another question without heavy waypointing. This supports treating **Knowledge** as a first-class discovery reward.

## GDC — Rewarding Exploration with Collectables and Gatherables

The talk emphasizes that gathering systems fail when they become tedious, thematically inconsistent, unintuitive, or economically unsupported. It also emphasizes visible patterns, teaching players where to look, rewarding exploration off the main path, and not letting collection halt gameplay flow. This directly supports the candidate's **habitats, reward-motive variety, and Routine Take vs Strategic Harvest split**.

## Astroneer development lessons

Public GDC material notes that crafting progression can stagnate when new systems/resources do not create a major shift in what the player can do. This supports the Hexoflat rule that resource progression should unlock **new verbs, topology and systems**, not merely longer recipes.

---

# 38. Playtest Hypotheses

## H1 — Players Learn Habitat

After a short tutorial-free exposure, players can predict at least one likely resource location from environmental cues.

## H2 — Resource Changes Route

Players sometimes choose a different route because of resource opportunity, not simply take every resource on the shortest path.

## H3 — Routine Pickup Feels Fast

Loose resource pickup does not feel like a minigame or repeated UI interruption.

## H4 — Strategic Harvest Feels Meaningful

When a strategic harvest choice appears, players can explain why one option might be preferable in another situation.

## H5 — Resource Has Purpose

Players can explain at least one downstream use for every collected starter resource.

## H6 — Knowledge Is Rewarding

At least some players intentionally investigate a clue even when no immediate material reward is promised.

## H7 — Reward Variety

Players do not predict that every optional branch ends in the same reward category.

## H8 — No Maintenance Grind

Longitudinal testers do not repeatedly run the same known loop only to restock a basic resource.

## H9 — World Reciprocity

Players use at least one resource to change access/topology and understand that their resource decision changed the world.

## H10 — Scout Feels Like Mastery

Improved Scout/knowledge makes players better at reading the world rather than merely increasing collection quantity.

---

# 39. Telemetry / Internal Metrics

Record internally:

- resource source discovered per region;
- percentage of visible routine pickups taken;
- percentage of strategic sources ignored;
- time from system need to first valid source discovery;
- route deviation caused by resource clue;
- repeated trips solely for maintenance resource;
- resource pickup-to-use latency;
- inventory accumulation with no sink;
- habitat clue recognition success in playtest tasks;
- source revisit rate;
- known-source use rate;
- reward dimension distribution;
- side-branch abandonment after reveal;
- discovery endpoints with no downstream player action;
- strategic harvest choice distribution;
- permanent topology changes created from resource/tool actions.

Metrics diagnose; they do not replace observation/playtest.

---

# 40. Redesign Warning Signals

Redesign if players:

- click every resource automatically without thinking;
- ignore most resources because inventory is full or sinks are weak;
- cannot remember where anything is found;
- need wiki-like external lookup for basic sources;
- repeatedly farm the same loop;
- treat Scout as only movement distance;
- find every side path ends in material loot;
- stop investigating environmental clues;
- feel punished for not vacuuming every node;
- discover a new resource but cannot explain why it matters;
- feel forced into strategic harvest choices for trivial objects;
- see resource tokens cluttering the board more than terrain and landmarks.

---

# 41. Recommended Implementation / Validation Roadmap

## Phase A — Resource Meaning Before Spawn

1. Finalize three starter resource contracts.
2. Give each at least one mocked downstream sink.
3. Define environmental habitat cues.
4. Confirm Game Kit representation.

## Phase B — One Habitat

1. Medicinal Plant habitat.
2. Environment clue.
3. Routine Take.
4. Knowledge state transition.
5. Known Source memory.

Prove that players can learn _where to look_.

## Phase C — Terrain By-Product

1. Existing Stone Crust + Pickaxe.
2. Broken Passage mutation.
3. Stone Fragment by-product.
4. Take.
5. Mock sink.

Prove `terrain → topology + resource` feels coherent.

## Phase D — Resource Route Choice

1. Resource Lure grammar.
2. Add detour cost/exposure.
3. Integrate Path of Will.
4. Measure whether players intentionally deviate.

## Phase E — Reward Variety

1. Add topology discovery.
2. Add knowledge-only discovery.
3. Add mystery discovery.
4. Add motive memory.

Prove curiosity survives without constant loot.

## Phase F — One Strategic Renewable Source

1. Healthy/Harvested/Recovering states.
2. One meaningful Preserve/Extract choice.
3. World-cycle recovery.
4. No local respawn farming.

Only keep the choice if playtest proves it adds value.

## Phase G — Expedition Intent

1. Pin a resource need.
2. Emphasize only known habitat information.
3. Scout classifies relevant new clues.
4. Never reveal hidden exact coordinates.

## Phase H — Longitudinal Anti-Grind Test

Playtest multiple expeditions.

Measure:

- repeated maintenance routes;
- ignored resources;
- accumulation;
- habitat learning;
- whether Known Routes/Camp mastery remove solved friction.

---

# 42. Candidate Signature

> **Hexoflat resources are not loot dots scattered across fog. They belong to readable habitats, alter route decisions, leave visible world states, feed other playable systems, and teach the player how the world works. Discovery rewards knowledge, topology, capability and mystery alongside material gain, so exploration creates new possibilities rather than a larger pile of ingredients.**

---

**End of Resource Ecology & Discovery Rewards Candidate v0.1**
