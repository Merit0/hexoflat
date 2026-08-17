# HEXOFLAT — Known World Travel & Expedition Planning

**Candidate Version:** v0.1  
**Status:** Candidate — requires playtest approval before promotion to canonical  
**Primary design contract:** Hexoflat Master Design & Implementation Guide v1.0  
**Depends on:** Frontier Exploration & Resource Ecology v0.1; Region Grammar Generator v0.1; World Pulse & Living World Director v0.1; Landmarks, Traces & Mystery Weave v0.1

---

# 0. Canonical Compatibility and Explicit Candidate Decisions

This candidate preserves the Master Guide's principles that:

- the world is discovered rather than selected;
- World Travel is a playable system;
- known consequences are previewed;
- Scout progression should unlock control and information rather than only longer movement;
- repeated meaningless clicking should be removed;
- travel uses physical/visual representations instead of abstract menu-only state;
- the Game Board remains primary;
- the Player Board is contextual and compact.

## Explicit candidate reinterpretation

The Master Guide's World Travel v0.1 describes Route Patterns as the primary first-order travel mechanic, including placing/rotating a route pattern from a known World Hex.

The Frontier Exploration candidate already repositions this idea:

- **Unknown territory:** explored physically through Frontier Exploration, Path of Will, Scout, terrain manipulation, discovery and World Pulse.
- **Known territory:** Route Patterns become a learned navigation layer that reduces solved traversal without turning the world into a teleport menu.

This is a **candidate reinterpretation**, not a silent replacement of the Master Guide.

## Additional narrative candidate

The existing story candidate establishes the motif that living will leaves a **trace**. This design proposes that a travelled route can leave a world-readable **Trail Imprint**. This narrative linkage is candidate-only until explicitly approved for lore canon.

---

# 1. Experience Promise

Known-world travel should make the player feel:

> **“I earned the right to move through this place efficiently because I explored it, understood it and changed it.”**

The system must preserve three feelings simultaneously:

1. **Memory** — the world remembers where the hero has been.
2. **Mastery** — previously difficult geography becomes easier because the player learned it.
3. **Risk continuity** — a living world can still invalidate or complicate a known route for a visible reason.

Known-world travel must not become either extreme:

- repeated manual walking through solved territory;
- unrestricted teleportation that erases geography, World Pulse and route consequences.

---

# 2. The Travel Paradox

Exploration is valuable because the first traversal contains uncertainty.

Repeated traversal usually contains much less uncertainty.

If the player must manually repeat the same solved path, exploration degrades into commuting.

If the game simply teleports the hero, geography loses meaning.

Hexoflat resolves this with:

> **Discover physically → leave a Trail Imprint → understand the route → travel it as a Route Thread → interrupt only where a meaningful decision returns.**

This is the core rule of Known World Travel v0.1.

---

# 3. Signature Loop

**Camp / Known Anchor → Choose Expedition Intent → Preview Route Threads → Choose Travel Mode → Commit → Accelerate through reliable segments → Pause at Decision Gate / World Response / Frontier → Act → Continue or return**

The system should compress **execution**, not compress **decisions**.

---

# 4. Trail Imprint — The Core Bridge From Exploration to Travel

The already-implemented hero path/trail becomes a design primitive rather than only movement feedback.

## 4.1 Fresh Trail

During normal movement the existing trail shows the exact route the hero is taking.

After traversal, the world may retain a subtle route memory.

This does not need to remain permanently bright or visually noisy.

## 4.2 Route Knowledge States

A route edge/segment may conceptually exist in one of these states:

**Untraveled → Traversed → Known → Reliable**

### Untraveled

The hero has not physically completed the segment.

### Traversed

The hero has successfully passed through it at least once.

The exact geometry is remembered.

### Known

Important route properties are understood:

- stable terrain;
- known gates;
- known obstruction rules;
- known threat crossings where applicable;
- known shelter/anchor relation.

### Reliable

The segment can be accelerated because no unresolved known decision exists along it in the current world state.

Reliable does **not** mean permanently safe.

A route can later become Frayed if the world changes.

---

# 5. Route Threads

Once a useful path is sufficiently understood, its Trail Imprint can become a **Route Thread**.

A Route Thread is a player-facing visual connection through the actual discovered hex topology.

It is not a separate map edge invented independently from the hex world.

It represents:

- “I know how to traverse this”;
- “the game can compress the solved portions”;
- “if something meaningful changes, travel can stop here.”

## Visual direction

A Route Thread should look like a subtle remembered path woven through known hexes.

It should not resemble a modern GPS line.

Candidate visual language:

- faint etched line / spectral filament / worn trail;
- stronger at Anchors and Gates;
- broken/irregular when Frayed;
- hidden until route preview if permanent display becomes cluttered.

---

# 6. The Known World Travel Network

The network is generated from the actual world topology.

Do not create a second unrelated travel graph that can contradict the board.

## 6.1 Anchor Types

Only decision-relevant places become network anchors.

Candidate anchors:

### Camp Anchor

Home/base entry and return point.

### Landmark Anchor

A major understood landmark.

### Junction Anchor

Meaningful fork where travel choices diverge.

### Shelter Anchor

A known place suitable for a safe Gather Will / staging point where rules allow.

### Source Anchor

A mastered or important resource source/habitat.

### Gate Anchor

A traversal dependency such as:

- repaired bridge;
- Stone Crust passage;
- rope crossing;
- narrow threat crossing;
- conditional route.

### Frontier Anchor

The last understood point before unknown territory resumes.

## Rule

Do not place an Anchor merely because a hex exists.

An Anchor exists because the player may make a meaningful travel decision there.

---

# 7. Decision Gates — What Accelerated Travel Is Not Allowed to Skip

A **Decision Gate** is any point where the current world state produces a meaningful choice that cannot safely be auto-resolved.

Examples:

- a previously open passage is blocked;
- a known patrol now occupies or controls the route;
- a new Mystery recontextualization has made an old trace relevant;
- a resource source requested by Expedition Intent is reached;
- an unexpected Disturbance changed topology;
- a known route now crosses a combat detection zone;
- the route reaches Frontier;
- a conditional tool is no longer available;
- a World Event changes a required crossing.

Rule:

> **Known Travel may skip solved execution, never a new meaningful decision.**

---

# 8. Accelerated Travel — Not Teleportation

When the player commits a Reliable Route Thread:

1. the hero remains represented on the Game Board;
2. the Route Thread highlights;
3. the Hero Token traverses the known path in accelerated form;
4. remote/local world simulation advances consistently;
5. the system stops at the first Decision Gate, interruption, requested stop or destination;
6. the player regains normal board control.

The player should understand where the hero went.

There is no fade-to-black requirement and no abstract destination menu requirement.

---

# 9. Travel Modes — Route Patterns Reinterpreted

For Known World Travel, the player chooses **how the route solver should use the known network**, not individual footsteps.

The working Route Pattern concept becomes a compact physical Mode Token / pattern rule applied to the travel preview.

Do not use full cards unless a mode later contains enough rule complexity to justify one.

## 9.1 STRIDE — Direct Known Travel

Fantasy:

> “Use the most direct reliable trail.”

Behavior:

- prefers shortest understood route;
- does not deliberately detour for optional resources;
- stops on new meaningful risk;
- does not reveal extra unknown territory merely because the player is travelling quickly.

This is the default repeated-travel solution.

## 9.2 VEIL — Threat-Aware Travel

Fantasy:

> “Move through what I know while avoiding known attention.”

Behavior:

- prefers known shelter and low-exposure route geometry;
- avoids known threat crossings where an understood alternative exists;
- never invents knowledge about hidden enemies;
- may choose a longer Route Thread if the reason is known and previewable.

## 9.3 SURVEY — Travel Along the Edge of Knowledge

Fantasy:

> “Use the known road to reach the frontier while reading what lies beside it.”

Behavior:

- prefers route segments adjacent to Observed/Unknown territory where legal;
- preserves/extends Scout observation opportunities;
- stops more readily on new significant Frontier Signals;
- is primarily useful when a known route is being used as a launch corridor into new exploration.

## 9.4 GATHER — Later candidate, not v0.1

Potential behavior:

- include a mastered Source Anchor matching Expedition Intent;
- pause at source rather than auto-collecting;
- never harvest automatically.

Do not implement until Resource Ecology v0.1 has proven that source revisits are useful rather than grind.

---

# 10. Expedition Intent

The player should be able to leave Camp with a **reason**, not necessarily a quest.

Examples:

- Investigate Broken Spire;
- Find Medicinal Plant habitat;
- Return to Fractured Ridge after new Insight;
- Reach unexplored northern Frontier;
- Enter discovered Dungeon;
- Repair known bridge.

The Intent is a small planning marker, not a quest HUD.

## Rule

Expedition Intent may influence route suggestions using **knowledge the hero already possesses**.

It must not reveal hidden coordinates.

Example:

`Find Medicinal Plant`

may suggest:

- known Medicinal Source Anchor;
- known habitat region;
- frontier direction with matching learned habitat clues.

It must not say:

`Plant at q43,r17` if that location is still unknown.

---

# 11. Expedition Planning at Camp

Expedition Planning is a playable but intentionally compact preparation step.

It must answer only meaningful questions.

Starter flow:

1. Hero is physically at Camp / departure facility.
2. Player chooses an Intent or leaves without one.
3. Player selects/inspects a destination, Landmark Promise or Frontier Anchor.
4. System previews 1–3 materially different known route options when they exist.
5. Player selects Travel Mode.
6. Player verifies relevant held tools / Quick Items.
7. Known blockers are shown.
8. Player commits departure.

Do not make the player fill a checklist every time.

If only one route is meaningfully different, show one route.

If no special preparation matters, departure should remain fast.

---

# 12. Route Preview Grammar

A route preview should communicate known consequences without becoming a spreadsheet.

The path itself is the primary representation.

Along the thread, use small semantic markers for known Decision Gates.

Examples:

- Stone Gate icon;
- Shelter icon;
- Known Patrol Crossing icon;
- Resource Source icon;
- Frontier icon;
- Mystery Memory Spark;
- Broken/Frayed marker.

Do not show:

- risk percentages;
- travel difficulty score 1–100;
- route efficiency rating;
- abstract danger number.

---

# 13. The Route Must Remember World Manipulation

Player-created topology changes are part of Route Knowledge.

Examples:

- Stone Crust broken → passage can join the travel network;
- bridge repaired → new connection becomes eligible;
- tree felled → opening may create route;
- route collapses → Route Thread becomes Frayed;
- threat occupies the new shortcut → accelerated travel stops before exposure.

This creates the desired world authorship:

> **The player does not merely discover roads. The player can create roads.**

But every created road may also be usable by compatible world actors.

---

# 14. Frayed Routes — The Living World Pushes Back

A Known or Reliable Route is never treated as immutable.

If current world state invalidates its assumptions, the Route Thread becomes **Frayed**.

Possible causes:

- new obstruction;
- bridge damage;
- active threat crossing;
- world event;
- collapsed passage;
- new dangerous surface;
- conditional tool unavailable;
- unresolved recontextualized discovery.

## Player-facing behavior

The thread visibly changes at the affected section.

Known Travel stops at the last valid safe position/Anchor before the unresolved gate.

The game explains the cause semantically.

Example:

`Known Trail → Bridge changed → route interrupted`

not:

`Travel Error`.

---

# 15. World Pulse During Accelerated Travel

Known travel cannot freeze the living world.

However, simulating a full manual Gather-Will cycle on every skipped hex would recreate bookkeeping.

Candidate rule:

> **Accelerated travel advances the world at meaningful route transitions, not at every skipped footstep.**

Internal simulation may use Journey Beats tied to:

- region transitions;
- Anchor crossings;
- significant time-bearing Gate crossings;
- explicit rules of the selected Travel Mode.

The exact internal math may use counts, but the player sees semantic consequences.

The same deterministic world rules must govern both normal and accelerated travel.

The system must not grant immunity from patrol movement or world changes simply because travel is accelerated.

---

# 16. Travel Interruption

Travel can pause for:

- a Decision Gate;
- combat detection;
- a new major Frontier Signal;
- a recontextualized Trace;
- requested resource stop;
- route invalidation;
- explicit player cancel where safe;
- destination reached.

At interruption:

1. Hero Token is placed on the exact canonical hex.
2. Game Board returns to normal movement scale.
3. Remaining Route Thread remains previewable where still valid.
4. Current Will/world state is preserved according to travel rules.
5. Player may continue, change route, Act or abandon the travel plan.

---

# 17. Return Travel Is Part of Expedition Design

The system should make “how do I get home?” relevant without turning it into punishment.

## Return Thread

When the player pushes beyond a Known Route into Frontier, the latest reliable Anchor behind them acts as a **Return Thread origin**.

The player can usually return along understood terrain more efficiently than they entered it, unless the world changed.

This creates a natural expedition structure:

**Known Network → Frontier Anchor → Unknown Exploration → New Knowledge / Manipulation → reconnect to Known Network → easier future travel**

## No mandatory walk of shame

After completing a difficult discovery, forcing the player to manually replay 30 solved hexes back to Camp is not a reward.

If the return path is understood and no new decision exists, compress it.

---

# 18. Recontextualization Integration

New knowledge can make an old Route Thread interesting again.

Example:

1. Hero previously travelled through Stone Ridge.
2. Later Insight teaches the Fracture Mark pattern.
3. A previously observed stone beside the old route is now potentially meaningful.
4. The route receives a subtle **Memory Spark**.
5. On future preview, the player can choose to stop there.

Rule:

Known Travel must not silently skip a newly meaningful optional discovery if the system itself has just taught the player how to recognize it.

The player may still choose to ignore it.

---

# 19. Resource Ecology Integration

Known resource habitats may become Source Anchors only when sufficiently understood.

A route may deliberately include a known source if:

- the player has an Expedition Intent that matches it;
- the source is currently relevant/available under Resource Ecology rules;
- the detour creates a meaningful decision.

Travel never auto-collects resources.

At a Source Anchor:

- player can stop and interact normally;
- Hand / Tool grammar remains unchanged;
- routine Take stays routine.

This prevents the travel layer from becoming an offline resource harvesting system.

---

# 20. Scout Integration

Scout becomes increasingly useful across both Frontier and Known World.

Candidate capabilities:

### Trail Memory

Recognizes useful traversed paths as Route Thread candidates faster/with better clarity.

### Waypoint

Player can force the known-route solver through one chosen Anchor/hex where legal.

### Trail Sense

Shows known Gate consequences in route preview more clearly.

### Pulse Sense

Shows known likely world responses before committing Gather Will / long known travel.

### Frontier Reading

Makes SURVEY more useful near Unknown territory.

### Route Recovery — later

A Frayed Route may reveal a known alternate connection immediately if Scout knowledge supports it.

Do not reduce Scout to travel-speed bonuses.

---

# 21. Equipment and Tool Integration

The travel system queries current physical equipment state.

Examples:

- Pickaxe held/carried → Stone Crust Gate is potentially usable;
- Rope/Gear → conditional crossing is eligible;
- missing required tool → route preview shows concrete blocker;
- tool consumed/broken before reaching Gate → route becomes Frayed and stops before the Gate.

The route solver must not assume inventory that the hero does not currently possess.

---

# 22. Combat Transition

If accelerated known travel reaches valid enemy detection:

1. travel stops on the exact detection hex;
2. Hero Token remains in physical world position;
3. combat frame/state activates;
4. enemy/hero positional geometry is preserved;
5. there is no teleport to a generic encounter room unless the specific content explicitly defines one.

Known Travel cannot bypass a combat trigger that manual traversal would legally trigger.

---

# 23. Player Board — Expedition Mode

Expedition Planning must not become a permanent dashboard.

Candidate contextual Player Board layout:

### Glance

- Hero identity;
- Will state;
- held tools / Hand Holders;
- critical Vitality/Protection;
- active Expedition Intent pin if any.

### Decision

When planning travel:

- selected destination/Frontier Promise;
- available Travel Mode tokens;
- route thread preview;
- only relevant known Gate requirements;
- optional waypoint.

### Explanation

On demand:

- why route is Reliable/Frayed;
- what a Gate requires;
- why a route mode chose this path;
- known World Pulse implications;
- source/mystery relevance.

---

# 24. Game Kit Additions

Keep additions minimal.

## 24.1 Trail Imprint / Route Thread

**Represents:** remembered and increasingly understood path through world topology.  
**Player Verb:** inspect/select/route through.  
**States:** Fresh/Traversed/Known/Reliable/Frayed.  
**Source:** successful physical traversal + knowledge validation.  
**Sink:** not consumed; state may degrade/change if world changes.  
**Reusable:** global.  
**UI Form:** subtle world-line / path overlay.  
**Explanation:** “You know this way; travel can be compressed until something meaningful changes.”

## 24.2 Anchor Marker

**Represents:** meaningful known travel decision point.  
**Player Verb:** select as destination/waypoint.  
**States:** active, blocked, frontier-adjacent, source-ready where relevant.  
**Reusable:** global.  
**UI Form:** small contextual marker integrated with existing world token/landmark where possible.

## 24.3 Travel Mode Token

Starter tokens:

- STRIDE;
- VEIL;
- SURVEY.

**Represents:** route-selection policy.  
**Player Verb:** choose before commit.  
**Reusable:** global.  
**UI Form:** small token/pattern primitive, not a full card.

## 24.4 Expedition Intent Pin

**Represents:** what the player is currently trying to accomplish.  
**Player Verb:** place/change/clear.  
**Reusable:** global Marker/Pin.  
**UI Form:** small Player Board/world planning marker.

## 24.5 Frayed Marker

Prefer a visual state of the Route Thread rather than a separate token unless playtest proves the state is unreadable.

---

# 25. Anti-Friction Constitution

1. Do not ask the player to confirm every Anchor crossing.
2. Do not replay every hex animation at manual speed on a solved route.
3. Do not show three route choices when they are functionally identical.
4. Do not require an Expedition Intent to leave Camp.
5. Do not require manual route planning for trivial return journeys.
6. Do not make Route Thread maintenance a chore.
7. Do not require the player to “level up” every road through repeated grinding.
8. Do not auto-harvest resources during travel.
9. Do not create an unrestricted teleport list disguised as travel.
10. Stop compression immediately when a meaningful new decision appears.

---

# 26. Failure and Fallback Rules

## No Reliable Route

Return to standard physical Frontier/Known movement.

## Route becomes invalid during preview

Recompute from canonical current state before commit.

## Route becomes invalid during execution

Stop at the last legal safe hex/Anchor before the invalid segment.

## Travel Mode has no meaningful alternative

Use the only legal route and explain that the selected mode creates no route difference here.

Do not create fake differences.

## Destination becomes unreachable

Show the concrete known cause and preserve any still-valid partial route.

## Player loses required tool

Stop before the dependent Gate; do not teleport through.

---

# 27. Procedural/World Generation Requirements

Region generation must expose stable travel semantics after discovery without exposing region/chunk boundaries.

Generator should support:

- meaningful Anchor sockets;
- Gate metadata;
- landmark connectivity;
- future shortcut edges;
- source/habitat relation;
- frontier exits;
- at least one return-safe topology where content requires return.

Not every region needs every Anchor type.

The travel network is derived only after relevant world topology is committed/discovered.

---

# 28. Travel Network Linter Rules

Reject or flag:

- Route Thread that crosses Unknown hex as if known;
- accelerated route that bypasses a Decision Gate;
- Reliable route containing unresolved conditional traversal;
- route that assumes unavailable required equipment;
- Source Anchor for an unidentified resource source;
- disconnected Anchor with no legal path;
- two route options whose meaningful Gate/decision sequence is identical;
- Frayed route with no visible/explainable cause;
- travel compression that bypasses combat detection;
- travel plan that reveals hidden threat data;
- mandatory repeated manual traversal of a fully Reliable route without a new decision.

---

# 29. Starter Vertical Slice

Use one world containing:

- Camp Anchor;
- one Landmark Anchor;
- one Shelter Anchor;
- one Frontier Anchor;
- one Stone Crust shortcut;
- one alternate long path;
- one Patrol crossing;
- one Medicinal Source Anchor;
- one recontextualizable Trace beside an old route.

Hero has:

- Hand;
- Pickaxe;
- current Scout starter progression;
- Will / Gather Will;
- STRIDE, VEIL and SURVEY travel modes.

## Required playable sequence

1. Player leaves Camp and physically explores to Landmark.
2. First traversal creates Trail Imprint.
3. Player discovers/breaks Stone Crust shortcut.
4. Route becomes Known/Reliable.
5. Player returns to Camp using compressed Route Thread.
6. Player selects Medicinal Plant Expedition Intent.
7. STRIDE and VEIL produce meaningfully different known-route previews because of Patrol.
8. Player commits one route.
9. World advances during travel.
10. A changed Patrol/Disturbance can Fray the route and interrupt travel.
11. Later Insight creates Memory Spark beside the old Route Thread.
12. SURVEY/normal travel lets player stop and exploit the recontextualized location.
13. Frontier Anchor transitions seamlessly back into full Frontier Exploration.

---

# 30. Playtest Hypotheses

## H1 — Mastery Reward

Players perceive faster known travel as something they earned through exploration rather than a convenience toggle.

## H2 — Geography Retention

Players retain a mental map because accelerated travel still uses physical Route Threads and Anchors.

## H3 — No Commute Fatigue

Repeat traversal time drops substantially after a route is solved.

## H4 — Living World Credibility

Players accept travel interruptions when the Frayed cause is visible and explainable.

## H5 — Route Choice

STRIDE vs VEIL vs SURVEY produce distinct situational decisions without requiring constant menu use.

## H6 — Return Satisfaction

Players do not experience returning to Camp after a successful expedition as punishment.

## H7 — Recontextualization

New knowledge can make a known route worth revisiting without a quest-marker checklist.

## H8 — No Fast-Travel Collapse

Players still care about geography, shortcuts, tools and threat placement after Known Travel unlocks.

---

# 31. Success Metrics

Internal telemetry/playtest measures:

- repeat-travel manual hex interactions before vs after Reliable Route;
- percentage of travel time spent at meaningful Decision Gates;
- route interruption rate and reason;
- Frayed-route comprehension in player interviews;
- percentage of route previews with materially distinct alternatives;
- Travel Mode usage by context;
- voluntary waypoint usage;
- Expedition Intent usage without quest requirement;
- return-to-Camp abandonment rate;
- recontextualization stop rate;
- rate of manual travel through fully Reliable unchanged territory;
- frequency of route changes caused by player-created topology;
- percentage of accelerated trips that bypass a meaningful event (target: zero).

---

# 32. Research-Derived Design Guardrails

These are design inputs, not canonical rules by themselves.

## Traversal can itself be gameplay

Death Stranding demonstrates the value of route planning, equipment choice and terrain as active traversal problems, including player-created bridges and ladders and long-range navigation through difficult geography.

Hexoflat should preserve this value during **first traversal and changed traversal**.

## Traversal mastery should reduce old friction

Player discussion around Death Stranding often values the progression from struggling through terrain to later using roads/paths/structures that make the same space easier.

Hexoflat should make known-route efficiency feel like world mastery.

## No-fast-travel purity can become commuting

Player discussion around games such as Outward and Valheim repeatedly shows the tradeoff: forced travel can support immersion and map knowledge, but repeated walks between already-known locations can become tedious.

Hexoflat should preserve consequential travel while compressing solved execution.

## Fast travel can erase adventure if unconstrained

Unrestricted teleportation removes route planning, incidental discovery and world-state contact.

Hexoflat therefore uses physical Route Threads and Decision Gates instead of a destination list.

---

# 33. Explicitly Out of Scope for v0.1

Do not implement yet:

- mounts;
- vehicles;
- caravans;
- player-built road economy;
- dozens of Travel Modes;
- route maintenance chores;
- random travel encounter tables detached from world state;
- abstract travel stamina meter;
- unrestricted teleport points;
- automatic resource harvesting;
- multiplayer shared-route infrastructure;
- real-time travel clocks;
- dynamic seasons/weather effects unless separately approved;
- large expedition supply simulation.

---

# 34. Candidate Approval Gates

Promote only if playtest proves:

1. first-time Frontier traversal remains the primary discovery experience;
2. repeated known traversal becomes faster without erasing geography;
3. route interruptions are understandable and feel causally fair;
4. player-created passages matter to future travel;
5. Travel Modes create meaningful choices rather than cosmetic route variations;
6. Expedition Planning remains compact and optional where preparation is trivial;
7. World Pulse/Living World remains active during compressed travel;
8. Scout provides navigation mastery rather than numeric speed inflation;
9. known-route travel integrates resources/mysteries without automating them away;
10. players still look at the Game Board rather than living inside a travel menu.

---

# 35. Final Candidate Rule

> **The first journey teaches the world. The next journey proves that the player learned it. Hexoflat should compress what is solved, preserve what can still change, and stop the moment the world asks a new question.**

**End of Candidate v0.1**
