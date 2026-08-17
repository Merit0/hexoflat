# HEXOFLAT — Landmarks, Traces & Mystery Weave

**Version:** Candidate v0.1  
**Status:** Design Candidate — NOT canonical until approved/playtested  
**Working system name:** **Mystery Weave / Плетиво Таємниць**  
**Parent systems:** Frontier Exploration & Resource Ecology; Region Grammar Generator; Resource Ecology & Discovery Rewards; World Pulse & Living World Director  
**Primary design contract:** `Hexoflat_Master_Design_and_Implementation_Guide_v1.md`  
**Audience:** Game Design, Narrative Design, UI/UX, Engineering, Claude Code

---

# 0. Canonical Compatibility and Explicit Candidate Decisions

This candidate preserves the Master Guide rules:

- **Position → Manipulate → Chain → Consequence**;
- **The World Is Discovered, Not Selected**;
- `Unknown → Observed → Discovered → Understood → Exploitable` as the world-understanding direction;
- **Everything Important Is Represented**;
- **No Invisible State** for known decision-relevant state;
- **Board First, UI Second**;
- **Smallest Sufficient Representation Wins**;
- **Progression Expands Possibility** rather than primarily increasing invisible numbers;
- major systems must create meaningful decisions, while routine inspection/pickup remains low-friction;
- World Lore ↔ Hero Story ↔ Mechanics ↔ Locations ↔ Game Kit ↔ Discoveries must eventually connect;
- procedural systems must not replace authored narrative content with mechanically empty randomness.

This candidate introduces these **non-canonical until approved** decisions:

1. **Landmarks are active navigation/gameplay objects**, not decoration or map labels.
2. A major Landmark should normally provide four layers: **Promise → Approach → Interaction → Insight**.
3. Discoverable evidence is represented through a reusable concept called a **Trace** (`Слід`, working term).
4. Important mysteries are organized as **Question Graphs**, not linear quest checklists.
5. The player may create **Hypothesis Threads** between known Traces and unresolved Questions.
6. Knowledge can unlock rules directly; some progression therefore comes from **understanding**, without requiring a new item or level.
7. Important Insights may **recontextualize already discovered territory**, causing old locations to become newly interesting.
8. Mystery-critical authored facts are never randomly generated. Procedural systems may choose **where/how** evidence is embedded, but not invent critical lore facts.
9. Main-path mysteries require redundant evidence paths or a safe fallback; a single missed clue must not permanently block campaign progress.
10. Hexoflat should avoid default GPS-style objective arrows for exploration mysteries. Manual Waypoint Pins and learned directional cues remain available.

---

# 1. Experience Promise

The intended exploration feeling is:

> **“I saw something I did not understand. I chose to reach it. The journey taught me how the world works. What I learned changed what I can notice, where I can go, and what old places now mean.”**

The player should not primarily think:

> “The map placed another `?` icon, so I should clear it.”

The desired thought chain is:

> “I can see a broken black spire beyond the ridge. The same three-cut mark appeared on the stone I could not break near Camp. If those are related, maybe the old ridge was not a dead end after all.”

This system exists to produce **curiosity with memory**.

---

# 2. Signature Discovery Loop

The candidate discovery loop is:

**Distant Signal → Question → Route Choice → Approach → Local Traces → Interaction → Insight → Recontextualization → New Possibility → New Question**

Example:

1. From a high frontier hex, Hero sees a distant broken tower silhouette.
2. The silhouette is not named. It becomes an **Observed Landmark**.
3. The player manually pins it or simply remembers its direction.
4. Reaching it requires choosing between a sheltered detour and a destructible Stone Crust shortcut.
5. Around the tower the player discovers two Traces: a carved fracture symbol and an abandoned rope fixture.
6. Inspecting the tower provides an Insight: this culture marked load-bearing weak stone with the same fracture symbol.
7. The Insight adds a rule to the player’s knowledge: some previously observed marked stone may be **Fractured Stone**, not ordinary Stone Mass.
8. An older ridge near Camp receives a subtle “reconsiderable” indication only in the Discovery/Memory layer.
9. The player returns through Known Travel, tests the old ridge, creates a new passage and discovers a hidden region.
10. The new region contains a second unresolved question linked to the tower.

The important reward was not only an item. It was:

**knowledge → changed perception → changed route possibilities**.

---

# 3. Landmark System

## 3.1 What a Landmark Is

A Landmark is a persistent world feature that performs at least two of these roles:

- **Orientation** — helps the player build a mental map;
- **Curiosity** — creates a visible/audible/world-state question;
- **Traversal** — shapes routes, gates, shortcuts or terrain decisions;
- **Knowledge** — contains or points toward Traces/Insights;
- **System Access** — unlocks a dungeon, facility, companion, travel connection or other system;
- **World Change** — can be activated, repaired, destroyed, awakened or transformed;
- **Narrative Memory** — anchors authored history/lore to a physical place.

A Landmark that is only a decorative object with a text popup is not sufficient for the core system.

## 3.2 Landmark Scales

### WORLD LANDMARK

Rare, visually dominant, visible from multiple regions where geography permits.

Purpose:

- macro orientation;
- long-term curiosity;
- campaign identity.

Examples of form, not fixed content:

- colossal ruined structure;
- impossible tree;
- distant luminous scar;
- mountain split by an ancient event.

Target: very few per world area.

### REGIONAL LANDMARK

Primary orientation/curiosity anchor for a group of procedural regions.

Examples:

- broken watchtower;
- ring of standing stones;
- distinctive waterfall;
- black ridge;
- abandoned bridge complex.

### LOCAL LANDMARK

Small memorable object that helps route reading or hosts a local discovery.

Examples:

- forked dead tree;
- unusual stone arch;
- collapsed shrine;
- three-pillar formation;
- exposed giant root.

Local landmarks should not become map clutter.

## 3.3 Landmark Promise Contract

Every major Landmark must answer:

1. **Promise** — what makes the player wonder about it before arrival?
2. **Approach** — what route/terrain problem makes reaching it meaningful?
3. **Interaction** — what does the player physically do there?
4. **Insight** — what changes in knowledge, capability, topology or world state?
5. **Echo** — does the discovery recontextualize anything already seen?
6. **Loose End** — what optional question, if any, remains afterward?

A landmark should not require all six every time, but major authored landmarks should usually satisfy at least five.

---

# 4. Landmark Visibility and Navigation Grammar

Hexoflat should use landmarks to create **mental navigation**, not only UI navigation.

## 4.1 Silhouette First

At distance, a landmark is primarily recognized by:

- silhouette;
- relative direction;
- motion/light/smoke;
- sound where appropriate;
- terrain relationship.

The player should not need its name to become curious.

## 4.2 Landmark Triangle Rule

When geography reasonably permits, frontier exploration should allow the player to orient against **2–3 known anchors** rather than one permanent objective arrow.

Example:

> Camp is behind the Hero. The black ridge is left. The broken spire remains ahead-right.

This builds a mental map while still allowing manual Waypoint Pins.

## 4.3 Visibility Budget

Do not reveal ten points of interest from one hill.

Candidate budget:

- normally 0–1 major distant Promise;
- up to 1–2 regional cues;
- local details revealed contextually.

A sparse readable world is preferred over a theme-park skyline.

## 4.4 No Forced Tower Chore

Hexoflat must not require repetitive “climb tower → reveal icons” behavior.

High ground can improve observation, but it should reveal **terrain relationships and signals**, not populate the map with a checklist.

---

# 5. Trace — The Reusable Knowledge Primitive

**Trace / Слід** is the working name for a player-readable piece of evidence that something happened, exists, behaves or connects.

A Trace can be:

- tracks;
- broken vegetation;
- carving;
- damaged tool;
- unusual stone pattern;
- corpse/bone state;
- residue;
- sound;
- smell represented visually if mechanically known;
- abandoned camp;
- repeated symbol;
- structural alignment;
- resource habitat clue;
- enemy behavior evidence;
- authored memory/lore evidence.

A Trace is **not automatically a collectible item**.

Many Traces stay physically in the world.

## 5.1 Trace Interaction

Routine Trace:

**Hand / Inspect → short contextual reveal → knowledge recorded**.

If there is no choice beyond noticing it, do not create a mini-game.

Strategic Trace:

May require:

- specific tool;
- reaching a difficult position;
- observing during a World Pulse;
- comparing with another known Trace;
- altering terrain;
- choosing whether to consume/transform the source.

Only strategic Traces justify deeper interaction.

---

# 6. Discovery Knowledge Model

Physical world discovery continues to use:

**Unknown → Observed → Discovered → Understood → Exploitable**.

Knowledge adds a separate lightweight progression:

### TRACE KNOWN

The player has encountered a meaningful clue.

### CONNECTION SUSPECTED

The player or system can plausibly associate the Trace with an unresolved Question.

### INSIGHT UNDERSTOOD

A relationship/rule has been established.

### INSIGHT APPLIED

The knowledge has been used to alter a real gameplay decision or world interaction at least once.

The UI should not expose these as numeric XP bars.

---

# 7. Mystery as a Question Graph

A Mystery is not:

`Quest → objective 1 → objective 2 → objective 3 → reward`.

It is a graph of **Questions, Traces, Insights and Tests**.

Example:

**Q: Why are the stone passages around this region deliberately sealed?**

Possible Traces:

- same fracture mark on multiple sealed walls;
- broken pickaxe near one wall;
- old rope anchor facing the cliff;
- patrol avoids one section;
- inscription at regional Landmark.

Possible Insights:

- the walls were not defensive barriers;
- the mark identifies engineered weak seams;
- some sealed passages can be reopened;
- reopening them also connects old threat routes.

The order in which the player discovers these can differ.

---

# 8. Hypothesis Threads — Optional Player Reasoning

For major mysteries, the Player Board may open a contextual **Mystery Weave** mode.

This is a substantial system and therefore may justify a dedicated temporary board/mode. It is never permanently visible.

The player sees:

- active Questions;
- known Trace markers;
- established Insights;
- optional **Thread Pins** connecting evidence to a Question.

The player can propose a Hypothesis by connecting sufficient relevant evidence.

Important rules:

1. The system should not dump a long multiple-choice answer list.
2. Wrong hypotheses must not permanently destroy progression.
3. A hypothesis can be tested in the world.
4. Validation should preferably happen through gameplay, not a “Correct!” popup.
5. Minor mysteries may auto-resolve when the evidence is obvious; do not force the board for every clue.

Example:

`Fracture Mark` + `Broken Mining Tool` → Thread to `Sealed Passage Question`.

The world test becomes:

> Return to a similarly marked wall and use Pickaxe.

If the passage responds, the Insight becomes Understood/Applied.

---

# 9. Knowledge as Progression

A key candidate signature of Hexoflat is:

> **Some capabilities are unlocked because the player understands the world, not because an invisible level increased.**

Examples:

### Terrain Recognition

Learned Insight:

> three-cut fracture mark identifies weak stone.

Effect:

- Scout/Inspect can now classify certain Observed stone as likely `Fractured Stone`;
- old observed regions may reveal reconsiderable candidates.

### Resource Habitat Insight

Learned:

> medicinal plants prefer shaded wet stone edges.

Effect:

- Frontier Reading can classify likely medicinal habitat.

### Threat Behavior Insight

Learned:

> a predator follows fresh Disturbance but avoids a specific terrain state.

Effect:

- known threat Intent preview becomes more informative when that evidence applies.

### Structure Insight

Learned:

> a ruin’s aligned pillars point toward hidden entrance geometry.

Effect:

- previously meaningless orientation becomes a usable route clue.

Knowledge should expose **new verbs, classifications, predictions or routes**, not simply grant `+10% discovery`.

---

# 10. Recontextualization — The Signature Knowledge Reward

This candidate introduces **Recontextualization** as a first-class reward.

When the player acquires an Insight, the game may reevaluate already known world state using the new rule.

Example:

Before:

> Old ridge near Camp = ordinary blocked stone.

New Insight:

> three-cut marks indicate Fractured Stone.

After:

> The player can now recognize that one previously seen ridge contains a possible weak seam.

The map should **not** show a giant quest arrow.

Instead, when the player enters Discovery/Memory mode, the old location may show a small contextual **Memory Spark / Reconsideration Mark**.

The player thinks:

> “Wait. I saw that before.”

This is intended to create meaningful backtracking without repetitive walking because Known Travel already reduces solved-space friction.

---

# 11. The Loose-End Rule

Strong exploration repeatedly creates a manageable unfinished thought.

Candidate rule:

- major Landmark resolution should usually leave **0–1 optional Loose End**;
- major discovery chains may expose one stronger new Question;
- routine discoveries should often resolve cleanly.

Do not create an endless task list where every clue opens three more clues.

The desired rhythm is:

**Question → partial understanding → payoff → one intriguing residue**.

---

# 12. Mystery Density and Cognitive Budget

Hexoflat should not become a detective notebook management game unless the player chooses a mystery-heavy path.

Candidate limits for early game:

- 1–2 major active Questions;
- 0–3 local unresolved Questions;
- no more than 1 new major Question introduced by a normal region;
- Mystery Weave remains contextual/collapsible.

Late-game limits can expand after playtest.

If the player cannot remember why a clue matters without repeatedly opening a journal, density is too high.

---

# 13. Authored Mystery + Procedural Embedding

Critical rule:

> **Procedural generation may arrange evidence, but it may not invent canonical truth.**

## 13.1 Authored Layer

Defines:

- Mystery ID;
- actual truth;
- Questions;
- valid evidence set;
- optional evidence;
- Insights;
- world-rule unlocks;
- narrative text;
- authored Landmark core if required;
- allowed procedural embeddings;
- progression/fallback rules.

## 13.2 Procedural Layer

May choose:

- which compatible region hosts a Trace;
- which route proposition guards it;
- exact hex position;
- which optional evidence appears first;
- terrain presentation;
- nearby resource/threat interaction;
- whether evidence is seen from a Landmark, found in a passage, or observed through a World Pulse.

## 13.3 Never Procedurally Randomize

- culprit/truth of a canonical story mystery after save creation unless explicitly designed as a seeded campaign variable;
- meaning of authored symbols;
- character history;
- main-campaign causal facts;
- critical prerequisite without guaranteeing a recoverable path.

---

# 14. Evidence Redundancy and Anti-Block Rules

Main-path knowledge gates require redundancy.

Candidate rule:

A critical Insight should normally have:

- **2 independent evidence routes**, or
- 1 evidence route + 1 explicit safe fallback/recovery mechanism.

Examples:

- Trace A at Landmark OR Trace B at alternate ruin;
- failed hypothesis creates a new observable Trace;
- Scout mastery can later reveal a missed critical clue;
- returning NPC/companion knowledge may recover a missed fact if narrative allows.

Do not require pixel hunting or complete fog clearing.

---

# 15. Landmark ↔ Region Grammar Integration

Region Grammar should treat landmarks as **topological attractors**, not random decoration.

A region can receive roles such as:

- `APPROACH_TO_LANDMARK`;
- `LANDMARK_OVERLOOK`;
- `LANDMARK_GATE`;
- `LANDMARK_RING`;
- `LANDMARK_BACK_ROUTE`;
- `LANDMARK_ECHO`.

Example:

A Regional Landmark may be visible for three regions before arrival.

Region 1 asks:

> Which direction is the easiest approach?

Region 2 asks:

> Do I break through or follow the long ridge?

Region 3 asks:

> Do I risk crossing the patrol route before Gather Will?

The landmark is therefore a **multi-region promise**, not content pasted into a random tile.

---

# 16. Landmark ↔ World Pulse Integration

Landmarks can participate in the living world.

Examples:

- a bell structure emits a Pulse signal under conditions;
- smoke from a distant site disappears after a World Cycle;
- a patrol uses a visible tower as an anchor;
- a repaired bridge changes remote route topology;
- a moving world phenomenon changes which landmark is visible.

Important:

World Pulse must not arbitrarily invalidate a mystery clue before the player can reasonably interact with it.

Persistent evidence required for critical progression must remain recoverable.

---

# 17. Landmark ↔ Resource Ecology Integration

A landmark can teach the player resource ecology rather than simply containing a chest.

Examples:

- ruin drainage creates a medicinal habitat;
- old quarry reveals fracture patterns and Stone Fragment sources;
- fallen sacred grove teaches timber preservation vs extraction;
- bridge remains reveal Binding Fiber sources nearby.

The landmark reward may therefore be:

**Knowledge + Habitat + Route**, with no conventional loot chest at all.

---

# 18. Landmark ↔ Tools / Interaction Grammar

Keep the existing physical grammar.

Examples:

- Hand → Trace → Inspect;
- Pickaxe → Fractured Structure → Open passage;
- Rope/Gear → anchor → Create connection;
- Axe → root barrier → Clear;
- Hand → mechanism → Open/Turn/Take when allowed.

Do not replace this with a landmark-specific menu.

The same object interaction language should work across routine resources, terrain and mysteries.

---

# 19. Scout Integration

Scout should improve **reading**, not auto-solve mysteries.

Candidate capabilities:

### LANDMARK SENSE

At appropriate observation points, reveals a distant silhouette/category without naming exact content.

### TRACE AWARENESS

Can interrupt movement when an important known-category Trace becomes observable.

### PATTERN RECALL

When a new Insight matches something previously Observed, marks a small number of old locations as reconsiderable in Discovery mode.

### CONTEXT READING

Shows that a known Trace is likely related to an active Question, but does not state the answer.

### DISTANT CLASSIFICATION

With sufficient mastery, distinguishes broad landmark class or terrain relationship at distance.

Scout must not become a wallhack that turns mystery into icon collection.

---

# 20. Will Integration

Gather Will can support observation without becoming a spam action.

Candidate behavior:

At certain observation states, the player may choose to **Hold Attention** while Gathering Will.

This does not create a separate resource.

Possible result:

- a moving signal becomes classifiable;
- a sound direction resolves;
- a distant threat intent becomes clearer;
- a landmark animation provides a Trace.

But World Pulse still happens.

Therefore observing is a tactical commitment:

> “Do I stay here to understand the signal while the world moves?”

Do not allow repeated Gather Will spam to reveal every clue.

---

# 21. Game Kit Additions

Reuse existing primitives wherever possible.

## 21.1 Landmark

**UI Form:** world geometry/object/token depending on scale.  
**Represents:** persistent orientation/curiosity/world function.  
**States:** Unknown / Observed / Discovered / Understood / transformed variants.  
**Player Verb:** approach, inspect, manipulate, revisit.  
**Reusable:** global system primitive.

## 21.2 Trace Marker

**UI Form:** very small contextual marker/glyph, usually only visible when relevant.  
**Represents:** known evidence/sign.  
**States:** unnoticed / known / connected / resolved relevance.  
**Player Verb:** inspect; optionally pin to a Question.  
**Reusable:** global.

## 21.3 Question Pin

**UI Form:** compact Mystery Weave node; not a permanent HUD element.  
**Represents:** unresolved meaningful question.  
**States:** open / partially informed / resolved / dormant.  
**Reusable:** mystery system.

## 21.4 Thread Pin / Thread

**UI Form:** simple connection line or thread marker inside Mystery Weave.  
**Represents:** player hypothesis linking Trace → Question/Trace.  
**States:** proposed / supported / disproven / established.  
**Reusable:** mystery system.

## 21.5 Memory Spark / Reconsideration Mark

**UI Form:** tiny optional marker visible only in Discovery/Memory context.  
**Represents:** new knowledge may apply to an old location.  
**States:** active / inspected / resolved.  
**Reusable:** knowledge system.

No new permanent top bar or quest tracker is introduced.

---

# 22. UI/UX Layers

## Glance Layer

On Game Board:

- physical landmark silhouette;
- visible world-state change;
- critical nearby Trace only when learned/observable;
- manually placed Waypoint Pin.

Do not show:

- mystery graphs;
- clue counts;
- percentages;
- lists of unresolved objectives.

## Decision Layer

When landmark/Trace is selected or route preview is active:

- interaction verbs;
- known route consequences;
- relevant Scout classification;
- active Question relationship if already known;
- optional pin action.

## Explanation Layer

Contextual Player Board mode:

- Mystery Weave;
- full Trace detail;
- origin/provenance;
- established Insights;
- semantic rule trace showing what gameplay rule an Insight unlocked.

---

# 23. No Checklist Exploration Rules

Hard rules:

- no region completion percentage;
- no “3/7 clues” unless a specific authored puzzle genuinely needs a count;
- no automatic `?` markers across unexplored space;
- no generic reward for clearing all fog;
- no objective arrow to every mystery clue;
- no collectible Trace spam;
- no mandatory inspection of every prop;
- no hidden main-path clue that requires pixel hunting;
- no lore dump as the only reward for a major traversal challenge;
- no repeated tower-unlocks-icons loop.

---

# 24. Mystery Reward Taxonomy

A resolved mystery should normally create at least one functional consequence.

Possible rewards:

1. **Topology Insight** — discover/create route or classify passages.
2. **Behavior Insight** — better understand enemy/world response.
3. **Habitat Insight** — learn where a resource can be found.
4. **Capability Insight** — learn a new use for an existing tool/interaction.
5. **System Access** — dungeon, companion, facility, travel mode.
6. **World State** — activate/repair/disable/transform something persistent.
7. **Narrative Revelation** — understand world/hero history.
8. **Recontextualization** — old locations acquire new meaning.

Major optional mysteries should usually combine two categories.

---

# 25. Anti-Repetition Memory

The procedural system must remember recent mystery/landmark experience dimensions:

- landmark scale;
- landmark role;
- cue channel (`VISUAL`, `AUDIO`, `TERRAIN`, `BEHAVIOR`, `RESOURCE`);
- approach grammar;
- primary player verb;
- reward category;
- evidence type;
- hypothesis/test pattern;
- whether the payoff recontextualized past space.

Example rejection:

Recent sequence:

1. visual tower → climb → read symbol;
2. visual statue → climb → read symbol.

Even with different geometry, a third `visual object → climb → inspect symbol` candidate should receive a strong repetition penalty.

---

# 26. Quality Linter for Landmarks and Mysteries

Reject or warn when:

- major landmark has no visible/audible Promise before arrival;
- major landmark provides only material loot;
- critical evidence has a single missable source;
- player must clear arbitrary fog to locate a critical clue;
- procedural embedding places required evidence behind an impossible traversal state;
- mystery resolution does not change knowledge/world state;
- more than configured active Question budget is introduced;
- landmark has no distinct silhouette/navigation role;
- recontextualization marks too many old locations at once;
- Trace density exceeds readability threshold;
- hypothesis can be brute-forced through a short answer list;
- procedural generation invents lore truth not present in authored data.

---

# 27. Starter Vertical Slice

Do not implement the whole mystery system first.

Build one small authored mystery embedded in procedural geography.

## Required setup

- Camp Anchor;
- 1 Regional Landmark visible from frontier;
- 3 approach regions;
- 1 Stone Crust shortcut;
- 1 Patrol interaction;
- 2 primary Traces;
- 1 optional Trace;
- 1 Question;
- 1 Insight;
- 1 old previously Observed location that becomes reconsiderable;
- 1 persistent passage/world change caused by applying the Insight.

## Target player experience

1. See Landmark before knowing what it is.
2. Choose to pursue it voluntarily.
3. Make at least one meaningful route decision on approach.
4. Discover evidence without UI checklist guidance.
5. Understand or propose a relationship.
6. Gain an Insight that changes an existing world rule.
7. Remember/revisit an earlier place.
8. Use the Insight there.
9. Create a new route/discovery.
10. Feel that knowledge, not loot quantity, caused progression.

---

# 28. Example Vertical Slice — “Marked Stone” (Working Content Only)

This is a **mechanical example, not canonical lore**.

### Promise

A broken narrow spire is visible beyond a ridge.

### Approach

- long sheltered path;
- shorter path through Stone Crust that creates Noise;
- Patrol may investigate the shortcut.

### Traces at Landmark

- repeated three-cut symbol on structural seams;
- broken mining tool placed beside one marked seam;
- optional rope anchor aligned with a collapsed opening.

### Question

> Why are identical marks cut into apparently solid stone?

### Insight

> The mark identifies intentionally weakened stone seams.

### Recontextualization

A previously Observed marked ridge near Camp becomes reconsiderable.

### Application

Player returns, uses Pickaxe on the marked seam, opens a hidden passage.

### Consequence

The passage is permanent and can later affect threat routes.

### Reward

- Topology;
- Knowledge;
- future Scout classification;
- optional mystery continuation.

No chest is required.

---

# 29. Research-Derived Design Lessons

The system is informed by several strong external patterns, without copying their content:

- **Curiosity-driven exploration:** unanswered but understandable questions are stronger motivators than generic objective markers.
- **Knowledge progression:** discovering that the player could interpret/use something differently all along can produce powerful recontextualization.
- **Landmark navigation:** salient global/regional anchors help players build more reliable mental maps than pure turn-by-turn guidance.
- **Deduction must resist brute force:** meaningful inference needs sufficient possibility space and evidence structure rather than a tiny answer menu.
- **Secrets require a normal baseline:** a secret passage is meaningful because most walls are genuinely walls; if everything hides a secret, nothing feels secret.

These are design inputs, not canonical rules by themselves.

---

# 30. Playtest Hypotheses

## H1 — Landmark Curiosity

Players voluntarily deviate toward a visible Landmark without a quest objective.

## H2 — Mental Map

After 15–20 minutes, players can describe important locations using landmarks rather than coordinates/UI arrows.

## H3 — Knowledge Reward

Players perceive an Insight-driven unlock as a meaningful reward even without item loot.

## H4 — Recontextualization

Players experience “I saw that before” moments and willingly revisit an old place after new knowledge.

## H5 — Low Cognitive Overhead

Players can follow 1–2 active major Questions without constantly reopening Mystery Weave.

## H6 — No Pixel Hunting

Players find critical evidence through world signals and route logic, not exhaustive clicking.

## H7 — Mystery Agency

Players can form/test at least one hypothesis without the game revealing the answer immediately.

---

# 31. Success Metrics

Internal telemetry/playtest measures:

- % of players who pursue optional visible Landmark;
- time from first Landmark observation to decision to pursue/ignore;
- percentage of navigation decisions using manual pins;
- landmark recognition recall after session;
- critical Trace miss rate;
- Mystery Weave opens per resolved Question;
- hypothesis attempts per mystery;
- incorrect hypothesis recovery rate;
- percentage of Insights applied in-world;
- recontextualization revisit rate;
- time spent walking through already solved territory;
- percent of major Landmark rewards consisting only of material reward (target: near zero);
- player-reported curiosity vs checklist feeling.

---

# 32. Explicitly Out of Scope for v0.1

Do not implement yet:

- dozens of active mysteries;
- procedural canonical lore generation;
- cryptographic language puzzles;
- community-scale ARG puzzles;
- permanent quest HUD;
- generic detective dialogue trees;
- clue rarity tiers;
- clue XP;
- “detective vision” that highlights all interactables;
- randomized answers to main-story mysteries;
- mandatory puzzle blocking every region;
- full narrative integration of the Soul Without a Name story until separately approved.

---

# 33. Candidate Approval Gates

This design should become canonical only if playtest proves:

1. landmarks improve navigation without UI overload;
2. players pursue curiosity signals voluntarily;
3. knowledge can function as satisfying progression;
4. recontextualization causes meaningful return trips without chore-like backtracking;
5. critical evidence remains discoverable without pixel hunting;
6. Mystery Weave is used as reasoning support, not constant bookkeeping;
7. procedural embedding preserves authored truth and solvability;
8. the system strengthens Frontier Exploration, Resource Ecology and World Pulse rather than feeling like a separate detective mini-game.

---

# 34. Final Candidate Rule

> **A good Hexoflat discovery should not merely answer “what did I find?” It should change at least one of the player’s future questions: where can I go, what can I recognize, what can I manipulate, what will the world do, or what did an old place actually mean?**

**End of Candidate v0.1**
