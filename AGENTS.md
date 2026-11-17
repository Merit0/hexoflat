# Hexoflat instructions for Codex

Project guidance is shared with Claude Code. Read `CLAUDE.md` before changing code, especially its architecture and workflow rules. Read relevant current-status sections when working on an existing subsystem; verify historical status against the current code.

## Project skills

Before working in a matching area, read its canonical skill:

| Task                                                                           | Skill                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| Game rules, commands, events, content, seeded randomness, `packages/engine/**` | `.claude/skills/hexoflat-engine/SKILL.md`    |
| Pinia, composables, services, frontend state and interactions                  | `.claude/skills/hexoflat-web-state/SKILL.md` |
| PixiJS layers, canvas, hex geometry, board camera and readiness                | `.claude/skills/hexoflat-render/SKILL.md`    |
| Playwright, UI flows, test hooks, selectors and E2E failures                   | `.claude/skills/hexoflat-e2e/SKILL.md`       |
| Planned phases and multi-step feature or refactoring work                      | `.claude/skills/hexoflat-phase/SKILL.md`     |

Codex discovery entrypoints live in `.agents/skills/`. The `.claude` skill files remain the single source of truth: update them when a feature changes the documented workflow. Interpret references to Claude as the coding agent role, using available Codex tools. Current user instructions and execution permissions take precedence.

For browser E2E, use `sh scripts/pre-push-e2e.sh <spec> [options]`: it starts the current code on dedicated ports with test hooks. A plain Playwright run may reuse a dev server without hooks. Keep spec files selector-free and use the existing Feature/Page/Component layers.

Do not commit without the user's authorization. Preserve existing uncommitted work.
