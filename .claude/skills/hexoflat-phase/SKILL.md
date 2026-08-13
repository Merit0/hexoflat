---
name: hexoflat-phase
description: How work is executed in this repo — one planned phase per chat, dedicated branch, characterization tests before refactoring, ask before every commit, and record progress back into the plan doc. Use at the start of any task that references a phase from docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md, docs/MIGRATION-PLAN.md or docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md, or any multi-step refactoring or feature task in this repo.
---

# How work is run in hexoflat

## Planning docs

| Doc                                              | What it covers                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md`           | Gameplay content and tactical mechanics — the active track                               |
| `docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md` | God Class diagnosis, phases G0–G6, and the target store contract in Part 6               |
| `docs/MIGRATION-PLAN.md`                         | Infrastructure phases (1–10 done; 11–12 deliberately paused)                             |
| `docs/design/*.md`                               | Scout reports — design inspiration only, never a source of copied names/text/art/balance |

## The rules

**One phase per chat.** Do not mix phases in one conversation. If a task turns out to need work from another phase, say so and stop rather than silently widening scope.

**Dedicated branch, always.** Create or switch to a task-scoped branch before editing files. Never edit on whatever branch happens to be checked out.

**Ask before every `git commit`** — not just before push. This applies to every commit in a multi-commit phase.

**One extraction per commit** during refactoring, so a regression can be bisected to a single move.

**Characterization tests first.** When changing existing behaviour-bearing code, write tests that pin the current behaviour _before_ moving anything. Never mix a refactor and a behaviour change in the same commit — otherwise it is impossible to say what broke.

**Record progress in the doc.** When a phase is finished, add `[DONE — date]` to its heading and update any before/after table in that doc. The plan file is the source of truth for what is done.

## Scope discipline

These are the failure modes that have actually cost this project time:

- **Fixing the deliberate exception.** Combat living outside the engine pipeline is a tracked design decision, not an oversight. Do not migrate it, and do not add combat commands, unless explicitly asked.
- **Grandfathering instead of fixing.** `KNOWN_CYCLE_FILES` in `eslint.config.js` records reviewed legacy cycles. Adding a file to it to silence a new error converts "we will fix this" into "this is now the architecture".
- **Raising a threshold to pass lint.** The size/complexity limits are pinned to measured maximums. Trip one → split the code, not the limit.
- **Extracting without wiring up.** Three composables once sat with zero importers while their logic stayed duplicated inline. Always verify the new module is actually imported and the old copy is deleted.
- **Refactoring with no consumer.** Reshaping code (or writing a schema) with no near-term user is speculative design. Prefer letting real feature work pull the shape out.

## Definition of done

- [ ] Scope stayed inside the one phase
- [ ] Work done on a dedicated branch
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; no threshold raised
- [ ] No new import cycle
- [ ] Behaviour unchanged, unless the task was explicitly to change it
- [ ] Plan doc updated with `[DONE — date]` and refreshed numbers
- [ ] Commit permission asked for, not assumed

## Originality constraint (applies to all content work)

The game is inspired by general tactical dungeon-crawler concepts, including Frosthaven, but must not copy names, characters, story, texts, artwork, terminology, or balance. All mechanics, worldbuilding, classes, enemies, abilities, scenarios and visual assets must be original. The scout reports in `docs/design/` are input for reasoning, never a source to lift from.
