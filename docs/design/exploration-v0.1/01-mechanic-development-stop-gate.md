# HEXOFLAT — Mechanic Development Stop Gate

**Candidate Version:** v0.1  
**Status:** Global design-governance candidate  
**Primary design contract:** Hexoflat Master Design & Implementation Guide v1.0

---

# Purpose

Hexoflat has a deliberate risk: because every major function should be playable, it is easy to keep inventing layers until a strong mechanic becomes an over-designed system.

This Stop Gate prevents that.

> **A mechanic is not improved merely because another rule can be added.**

The correct moment to stop design expansion is when the core decision can be tested cleanly.

---

# The Stop Rule

Enter **Mechanic Freeze → Implementation/Playtest** when all ten statements are true:

1. The experience promise fits in one sentence.
2. The core player loop has start → decision → consequence → continuation/fallback.
3. At least two meaningful strategies exist; three is preferred for a major system vertical slice.
4. Important state has a sufficient board/Game Kit representation.
5. Failure/fallback cannot soft-lock the game.
6. The system has meaningful input/output connections to the wider Hexoflat ecosystem.
7. A minimal vertical slice can test whether the unique decision is fun.
8. Known conflicts with the Master Guide are explicitly documented.
9. The UI/complexity budget is still readable.
10. The next proposed feature fails the **Marginal Decision Test**.

---

# Marginal Decision Test

Ask of every proposed feature:

> **If this feature is removed, do we lose a necessary kind of meaningful decision from the system's experience promise?**

If **yes**, it may be core.

If **no**, defer it as:

- content variety;
- progression extension;
- advanced module;
- polish/game feel;
- future candidate.

---

# After Freeze

Do not expand because something “sounds cool.”

A new mechanic may be added only to solve an observed playtest problem.

Evaluate in this order:

**Kill → Simplify → Tune → Expand**

Expansion is last.

---

# Example — Current Exploration System

Core exploration already contains:

- Frontier discovery;
- irregular Region Grammar;
- terrain manipulation;
- resource habitats;
- Path of Will / Scout;
- Gather Will / World Pulse;
- Landmarks/Traces/Mystery knowledge;
- Trail Imprint / Known Travel;
- Expedition continue/return;
- Camp consequence handoff.

Therefore after the Expedition v0.1 slice, the exploration macro-system should enter provisional Freeze.

Do not add weather, hunger, thirst, mounts, detailed ecology, procedural quests, complex carry weight or dozens of resource types until playtest shows a specific deficiency that one of those systems would solve.

---

# Final Governance Question

Before approving another mechanic, ask:

> **“Are we solving a player problem, or are we entertaining ourselves as designers?”**

If no tested player problem exists and the current loop is already testable, stop and play it.
