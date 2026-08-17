# HEXOFLAT — Expedition Risk, Return & Camp Consequence Loop

**Candidate Version:** v0.1  
**Status:** Candidate — requires playtest approval before promotion to canonical  
**Primary design contract:** Hexoflat Master Design & Implementation Guide v1.0  
**Depends on:** Frontier Exploration & Resource Ecology v0.1; Region Grammar Generator v0.1; World Pulse & Living World Director v0.1; Landmarks, Traces & Mystery Weave v0.1; Known World Travel & Expedition Planning v0.1

---

# 0. Canonical Compatibility and Explicit Candidate Decisions

This candidate preserves the Master Guide's rules that:

- Camp → Prepare → Travel → Discover → Encounter → Resolve → Return/Continue is the intended macro-loop;
- Vitality and Protection are discrete player-facing states rather than abstract HP/defense numbers;
- the world is discovered rather than selected;
- travel and return are playable, but solved execution should not become repeated friction;
- the Player Board remains contextual and compact;
- Downed is not permanent death;
- major systems must create meaningful decisions and connect to other systems;
- routine bookkeeping must be minimized.

## Explicit candidate decisions

1. Hexoflat does **not** use a universal numerical `Expedition Risk`, `Travel Energy`, `Hunger`, or `Depth` meter in v0.1.
2. The decision to continue or return emerges from visible world/player state: Vitality, Protection, tool capability, route reliability, critical payload, known threats and Frontier uncertainty.
3. Returning to Camp is not an instant teleport. Reliable known-route execution may be accelerated using the Known Travel system.
4. Solo Downed recovery requires a non-permadeath fallback. The exact narrative explanation is candidate-only and must later be reconciled with hero lore.
5. A finite expedition payload representation is allowed as a later candidate, but **is not required for the first vertical slice**.

---

# 1. Experience Promise

An expedition should produce the feeling:

> **“I can go one region deeper — but doing so changes what I am risking, what I can still solve, and how confidently I can return.”**

The player must not be forced home by an arbitrary bar.

The player should return because the **state of the expedition has changed**.

The core emotional arc is:

**Prepared → Curious → Committed → Stretched → Choice → Return or Push Deeper → Homecoming → Consequence → New Possibility**

---

# 2. The Expedition Question

At meaningful Frontier points the game should naturally create one recurring question:

> **“Do I continue, or do I turn what I have learned/gained into a safer future journey?”**

This must arise from the board, not from a modal `Continue? Yes / No` dialog.

Signals may include:

- damaged Vitality/Protection pieces;
- consumed or unavailable tool capability;
- a Frayed return Route Thread;
- a new patrol/threat occupying the known route;
- a valuable/critical payload now being carried;
- a Mystery clue that recontextualizes a known place;
- a new Frontier Promise visible beyond the current region;
- a known shelter/anchor behind the hero;
- the next World Pulse likely to matter because of visible signals.

---

# 3. No Universal Risk Meter

Do not implement:

- `Risk 73%`;
- `Expedition Depth 8`;
- `Travel Energy 4/10`;
- `Hunger 62/100` as a mandatory v0.1 travel limiter.

Risk is a **composition of visible state**, not a hidden scalar.

## 3.1 Expedition Pressure Sources

Candidate pressure sources:

### Body Pressure

- Vitality damaged;
- Protection damaged/broken;
- harmful Condition present.

### Capability Pressure

- Pickaxe/tool unavailable or consumed where applicable;
- required traversal capability missing;
- critical interaction option no longer available.

### Route Pressure

- return Route Thread Frayed;
- known Gate changed;
- patrol controls a known crossing;
- topology changed.

### World Pressure

- known Noise/Disturbance still active;
- visible threat is converging;
- next safe Gather Will position is uncertain.

### Payload Pressure

- hero carries an artifact, rescued entity, rare resource or other object whose loss/handling would meaningfully matter.

Not all expeditions need all pressure categories.

---

# 4. Expedition State Is Read From Pieces

The player should be able to glance at the board and Player Board and understand why continuing is becoming dangerous.

Examples:

- one Vitality Sigil visibly wounded;
- Shield/Protection piece broken;
- Pickaxe holder empty;
- Route Thread behind hero visibly Frayed;
- Noise Echo Ring still active near the return corridor;
- Artifact token physically occupies a carried-object location.

No large permanent expedition dashboard is required.

---

# 5. The Continue / Return Decision Is Spatial

The decision should normally occur at a **Decision Horizon** rather than an explicit menu.

A Decision Horizon is a location/state where:

- current region has been substantially resolved;
- the next Frontier Promise becomes readable;
- a known return route exists or its complication is visible;
- the hero has enough information to intentionally choose deeper travel or homeward travel.

Candidate examples:

- Frontier Anchor;
- Landmark overlook;
- cave threshold;
- repaired bridge leading to an unknown region;
- safe shelter before a hostile basin;
- newly opened Stone passage.

The board itself communicates:

**forward = new uncertainty**  
**backward = known value and consolidation**

---

# 6. Push Deeper — What Makes It Tempting

Going deeper cannot be attractive only because “there is more loot.”

A deeper Frontier should promise one or more different reward motives:

- a visible Landmark Promise;
- new resource habitat;
- Mystery evidence;
- new topology/shortcut opportunity;
- system access;
- new hero/companion possibility;
- capability discovery;
- story/world-state consequence.

The player should often see enough to become curious but not enough to know the answer.

---

# 7. Return Is Also Gameplay

Return must not mean manually replaying every solved hex.

Use the Known World Travel rules:

1. player chooses Camp or another valid understood Anchor as homeward destination;
2. reliable Route Threads are previewed;
3. hero travels accelerated through solved segments;
4. Living World advances consistently;
5. travel stops at Frayed segment / Decision Gate / combat detection / relevant Mystery recontextualization;
6. player resolves the new decision;
7. accelerated return can resume.

Rule:

> **Return compresses solved movement, never unresolved consequence.**

---

# 8. Homeward Thread — Player-Facing Return Confidence

No numeric “chance to return” is shown.

The route preview itself communicates confidence.

Candidate visual grammar:

- continuous Route Thread = currently Reliable;
- rough/broken section = Frayed;
- known Gate icon = conditional crossing;
- threat marker overlapping Thread = known danger;
- unknown beyond Frontier = no route guarantee.

The player therefore reads the actual geography instead of a risk percentage.

`Homeward Thread` is a working name for this player-facing interpretation of Known Route Threads; it does not require a new state system.

---

# 9. Critical Payloads

Some discoveries should change how the player thinks about returning.

Examples:

- artifact fragment;
- rescued NPC/creature;
- fragile world object;
- rare ingredient required by a Camp system;
- unique trace/evidence object that physically exists.

A Critical Payload must be represented physically when it materially affects decisions.

Possible consequences:

- occupies a hand/tool holder;
- changes which interactions remain available;
- prevents a particular traversal method;
- attracts a known enemy behavior;
- must reach Camp/Anchor to unlock a downstream system.

Do not make every resource a Critical Payload.

---

# 10. Resource Security — Avoid Artificial Banking Chores

Routine resources do **not** need to become unusable until Camp merely to force return trips.

Candidate rule:

- ordinary gathered resources are canonically owned when successfully collected unless another approved rule says otherwise;
- Camp may be required to **transform** them through Healing/Crafting/Workshop systems;
- Critical Payloads may have special delivery rules because their physical handling is itself gameplay.

This avoids “return only to bank inventory” friction.

---

# 11. Downed Far From Camp

Master Guide canon requires:

**Active → Downed → Rescued / Revived / Exhausted**

Permanent death is not the current direction.

## 11.1 With Companion

If a companion is present and rules permit:

- companion may protect/revive/move the Downed hero;
- direct or Tactical Order rules apply;
- encounter continues according to combat rules.

## 11.2 Solo Expedition Candidate Fallback

A solo hero cannot create an unwinnable permanent state solely because no companion exists.

Candidate fallback:

### Will Break

If no valid tactical rescue exists and the encounter/expedition resolves in defeat:

1. Hero becomes `EXHAUSTED` rather than dead.
2. The run resolves to the nearest valid recovery Anchor according to known-world rules, normally Camp or an explicitly approved Shelter.
3. Vitality/Protection consequences persist according to the Healing/Recovery rules.
4. unresolved world changes remain; the world is not rewound.
5. a Critical Payload may remain as a recoverable `Lost Cache` **only if that creates a meaningful future recovery decision**.
6. routine resource punishment is not automatic.

The exact fiction for Will Break is **not canonical** yet and must later be aligned with `Душа без імені` and the final death/return lore.

---

# 12. Lost Cache — Optional Consequence, Not Corpse Run

Do not make “walk back to your corpse for all your inventory” the default failure loop.

A Lost Cache may be created only for:

- a unique Critical Payload;
- an authored expedition object;
- a deliberate high-risk contract/objective.

It must create a different tactical/exploration question on recovery.

It must not become routine punishment for every defeat.

---

# 13. Camp Arrival Is a Payoff, Not an Administrative Wall

Arriving at Camp should create a compact **Homecoming Beat**.

The Game Board remains Camp.

The hero physically returns through the Camp world entry.

The game surfaces only meaningful changes:

- newly understood Route Thread;
- new Landmark/Mystery insight;
- newly available Camp interaction;
- resource relevant to a playable Camp system;
- Vitality/Protection state requiring attention;
- world consequence that reached Camp.

Do not create a mandatory long post-expedition checklist.

---

# 14. Camp Consequence Loop

The intended loop is:

**Return → Consolidate → Choose what to transform → World/Camp changes → Prepare a new intent → Depart**

Candidate system connections:

### Healing

Medicinal Plant / Elixir / Vitality damage feed the Healing Game.

### Crafting / Workshop

Stone Fragment / Timber / discovered recipes or capabilities feed future crafting/building playable systems.

### Route Development

Camp may later allow deliberate investment into known routes, bridges, shelters or travel tools.

### Mystery / Story

Some Insights unlock new questions, world-state changes or conversations rather than an item reward.

### Companion System

Gold/discovery may enable hiring a companion for a future expedition.

No connection should be added merely for completeness; it must create a real future decision.

---

# 15. Expedition Intent Becomes a Before/After Arc

Before departure:

**Intent:** “Investigate Broken Spire.”

During expedition:

- route chosen;
- Frontier opened;
- trace discovered;
- resource gathered;
- threat diverted;
- new passage created.

On return, the game should show a compact semantic result:

**Broken Spire — Understood**  
**Fractured Ridge — new passage remembered**  
**Medicinal habitat — source identified**

No generic XP recap is required.

---

# 16. Expedition Mastery

Progression should reduce solved friction and increase meaningful agency.

Possible future progression hooks:

- more reliable Route Threads;
- better Frontier reading;
- ability to establish a temporary Shelter Anchor;
- alternate recovery options;
- carrying/handling capabilities for Critical Payloads;
- improved World Pulse prediction;
- route engineering tools.

Do not default to `+20% expedition endurance`.

---

# 17. Anti-Grind Rules

1. Do not require the player to return solely because an arbitrary meter emptied.
2. Do not make Camp a mandatory banking terminal for every ordinary resource.
3. Do not manually replay reliable known routes without a new decision.
4. Do not punish every defeat with a full corpse run.
5. Do not respawn Frontier uncertainty merely to make return dangerous again.
6. Do not create a long Homecoming checklist.
7. Do not spawn threats behind the hero to force artificial tension.
8. Do not force “one more region” through FOMO-only rewards.
9. Do not turn every resource into a critical carry object.
10. Do not add hunger/thirst/weather attrition until the core expedition choice proves too weak without them.

---

# 18. Starter Vertical Slice

Use only:

- Camp Anchor;
- one Reliable known route;
- two Frontier regions;
- one Stone Crust shortcut;
- one Patrol;
- one Medicinal Plant habitat;
- one Landmark Promise;
- one Critical Payload candidate (optional A/B test);
- Vitality/Protection pieces;
- Gather Will / World Pulse;
- one Frayed Route event;
- return to Camp;
- compact Homecoming Beat.

## Required player decisions

The same slice should allow at least these strategies:

### Conservative

Resolve first region → return with known value.

### Opportunistic

Use terrain/Noise/route knowledge to enter second region and return before the route worsens.

### Committed

Push into second region for the Landmark/Critical Payload, accepting a more complicated homeward route.

If these do not feel meaningfully different, the system is not ready for expansion.

---

# 19. Playtest Hypotheses

H1. Players can explain **why** they chose to return without referring to an arbitrary meter.

H2. At least two players can make different reasonable continue/return decisions from the same visible state.

H3. Returning through Reliable routes feels earned and efficient rather than like teleportation.

H4. A Frayed return route creates a new decision without feeling like arbitrary punishment.

H5. Camp arrival feels like payoff/consolidation, not administration.

H6. The possibility of going one region deeper creates tension even without hunger, stamina or a numerical risk bar.

H7. Failure does not make the player feel that exploration time was erased.

---

# 20. Mechanic Development Stop Gate — Global Candidate Rule

This section is intentionally broader than Expedition design. It defines when Hexoflat should **stop inventing new mechanics for a system and move to implementation/playtest**.

## 20.1 The Core Principle

> **Stop adding rules when the system already produces the intended decision, and the next idea adds variety more than it adds a new necessary decision.**

Design does not stop when no more ideas exist.

Design stops when more ideas would reduce our ability to learn whether the core is fun.

## 20.2 Mandatory Stop Conditions

A major mechanic enters **MECHANIC FREEZE / PLAYTEST** when all of the following are true:

1. **Experience Promise is clear.**  
   We can state in one sentence what the player should feel/do.

2. **Core Loop is complete.**  
   The system has a beginning, meaningful decision, consequence and return/continuation state.

3. **At least two real strategies exist.**  
   Ideally three in the vertical slice. They must differ in decision, not animation.

4. **Failure/Fallback exists.**  
   The mechanic cannot soft-lock the campaign or depend on undefined behavior.

5. **Representation is sufficient.**  
   Important state is visible using the Game Kit/UI without a new permanent dashboard.

6. **System connections are proven.**  
   It feeds at least one other meaningful system and receives input from at least one other system where appropriate.

7. **A minimal vertical slice can test the unique hypothesis.**  
   No missing subsystem is required merely to discover whether the core decision is fun.

8. **Known conflicts with Master Guide are explicitly flagged.**  
   None are hidden behind implementation convenience.

9. **Additional mechanics fail the Marginal Decision Test.**  
   If an idea mostly adds content, realism, edge cases or additional knobs, defer it.

10. **Complexity budget is still readable.**  
    A new player can understand what decision matters without memorizing several independent subsystems.

When these pass, **stop designing new rules** and build/playtest.

## 20.3 Marginal Decision Test

For every proposed addition ask:

> “If we remove this feature, does the player lose a meaningful kind of decision that is necessary to the system promise?”

### If YES

The feature may belong in the core.

### If NO

Classify it as one of:

- Content Variety;
- Progression Extension;
- Advanced Module;
- Polish / Game Feel;
- Future Candidate;

and do not block the vertical slice on it.

Examples for Exploration:

- `World Pulse` — YES. Without it Gather Will does not create the intended spatial risk decision.
- `Frayed Route` — YES for Known Travel validation. Without it accelerated travel erases living-world consequences.
- `Weather fronts` — NO for v0.1. They may add variety later, but the loop can be proven without them.
- `Mounts` — NO for v0.1.
- `Ten resource families` — NO.
- `Hunger/thirst` — NO unless playtest shows no organic reason to return.
- `Day/night simulation` — NO unless it solves a measured problem.

## 20.4 Post-Playtest Expansion Rule

After freeze, a new mechanic may enter the system only if playtest evidence identifies a concrete problem such as:

- decisions are too obvious;
- return has no tension;
- routes become repetitive;
- resource motivation is weak;
- world responses are unreadable;
- failure is too punishing/too trivial;
- known travel removes too much geography;
- Scout progression has no meaningful mastery.

The new mechanic must name the problem it solves.

“Would be cool” is not sufficient after freeze.

## 20.5 Kill / Simplify / Tune / Expand Order

After playtest, evaluate in this order:

1. **Kill** — does the mechanic fail to create value?
2. **Simplify** — can the same decision exist with fewer rules/pieces?
3. **Tune** — is the core correct but parameters/UX wrong?
4. **Expand** — only after the previous three are rejected.

This prevents solving a weak system by stacking more systems on top of it.

---

# 21. Stop Gate Assessment for the Current Exploration Macro-System

Current exploration now contains:

- Frontier discovery;
- irregular Region Grammar;
- terrain manipulation;
- Resource Ecology;
- Scout/Path of Will;
- Gather Will / World Pulse;
- Landmarks/Traces/Mystery Knowledge;
- Known World Travel / Trail Imprint;
- Expedition continue/return loop;
- Camp consequence handoff.

## Assessment

After this Expedition module, the **macro-system should enter a provisional design freeze**.

Do **not** add the following before vertical-slice playtest unless implementation exposes a hard dependency:

- weather simulation;
- day/night survival rules;
- hunger/thirst;
- mounts;
- complex ecology chains;
- dozens of resources;
- procedural quests;
- multiple Shelter tiers;
- global faction simulation;
- random travel encounter decks;
- deeper logistics/carry-weight systems.

Those are expansion candidates, not prerequisites for proving exploration fun.

---

# 22. Acceptance Criteria — Design

The candidate is design-ready for implementation when:

- [ ] Continue vs Return can be explained without a numeric expedition meter.
- [ ] Reliable return uses Known Travel rather than teleport/manual commuting.
- [ ] Frayed route interrupts return for a concrete reason.
- [ ] Downed solo fallback is defined and non-permadeath.
- [ ] Camp arrival surfaces only meaningful consequences.
- [ ] Ordinary resources do not require banking chores.
- [ ] At least three vertical-slice expedition strategies exist.
- [ ] No new permanent UI panel is required.
- [ ] World state is not rewound on defeat.
- [ ] Mechanic Stop Gate is applied before adding further exploration subsystems.

---

# 23. Candidate Summary

The expedition system should not ask:

> “How much travel energy remains?”

It should ask:

> **“Given what has happened to my body, tools, route, world and discoveries — is the next unknown region worth committing to before I convert this expedition into lasting progress?”**

The intended full exploration arc becomes:

**Camp → Intent → Known Route → Frontier → Signal → Route Decision → Manipulate → Discover → World Pulse → Push Deeper / Return → Known Travel Home → Homecoming Consequence → New Capability/Knowledge → New Expedition**

After v0.1, the correct next step is **implementation and playtest**, not another layer of exploration mechanics.
