# Capability matrix

**Snapshot:** 2026-05-18 (matches `canonical/tool-capabilities.yaml` `as_of` dates)
**Scaffold version:** 0.1.3-dev

This document summarises how each canonical skill / agent emits to each supported tool, and why degradations happen.

For the design rationale: see ADR-0003 (canonical spec format) and ADR-0004 (three-tier enforcement).

For tool-specific capability details: see `canonical/tool-capabilities.yaml`.

## Per-skill emit outcome

Legend:
- **Full** — emits in full; all capabilities supported.
- **Degraded** — emits with at least one capability falling back per `degrades_to:`.
- **Skipped** — required capability has no `degrades_to:` and tool doesn't support it; nothing emitted.

| Canonical | claude-code (T1) | copilot-agent (T1) | cursor (T2) | codex (T2) | aider (T3) | continue (T3) |
|---|---|---|---|---|---|---|
| **skills/sdlc** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/plan** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/plan-next** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/spec** | Full | Degraded | Degraded | Degraded | Degraded | Degraded |
| **skills/review** | Full | Degraded | Degraded | Degraded | Degraded | Degraded |
| **skills/refactor** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/audit** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/build** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/debugging-and-error-recovery** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/performance-optimization** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **skills/session-harvest** | Full | Degraded | Degraded | Degraded | Degraded | Degraded |
| **skills/scaffold** | Full | Full | Degraded | Degraded | Degraded | Degraded |
| **agents/reviewer-agent** | Full | Skipped | Skipped | Skipped | Skipped | Skipped |

## Why each degradation / skip

### Cursor (Tier 2)

All 12 skills degrade on Cursor for two reasons:

1. **`llm_inline_invocation: required → glob_applied_rule`** — Cursor doesn't support user-typed `/skill-name` invocation. Skills become glob-applied MDC rules; they fire passively when a matching file is edited. The phase-to-globs mapping is owned by `emitters/cursor` and documented in that emitter's README.

2. **`session_lifecycle_hooks: preferred → manual_invocation`** (where declared) — Cursor has no session lifecycle. Skills that prefer auto-harvest at session-end fall back to manual `/session-harvest` invocation by the user (Cursor's slash-command-equivalent via glob rule).

**`agents/reviewer-agent` is Skipped on Cursor** because it requires `subagent_invocation: required` with no `degrades_to:` declared. Adversarial pre-review on Cursor degrades to inline review checks already baked into `skills/review` body; the standalone agent has no Cursor analog.

### Codex (Tier 2)

Same pattern as Cursor with a few extras:

1. **No `llm_inline_invocation` at all** — Codex reads `AGENTS.md` as ambient guidance; user can't invoke skills by name. Skills emit as numbered sections within `AGENTS.md`.

2. **No session lifecycle** — same fallback as Cursor.

3. **`agents/reviewer-agent` Skipped** — same reason as Cursor.

### Copilot agent mode (Tier 1, with partial support)

Tier 1 because hooks + inline invocation work. Three specific skills degrade:

1. **`skills/spec`** declares `subagent_invocation: preferred → inline_review_in_skill_body` (absorbed from the merged-in `define` per ADR-0006). Copilot agent mode has no subagent invocation, so the inline review checklist in the skill body runs instead of the standalone `reviewer-agent`.

2. **`skills/review`** has the same degradation reason.

3. **`skills/session-harvest`** declares `session_lifecycle_hooks: preferred → manual_invocation`. Copilot agent mode supports `SessionStart` but not `SessionEnd`; the harvest is invoked manually instead of auto-firing at session-end.

4. **`agents/reviewer-agent` Skipped** — Copilot agent mode has no `.claude/agents/`-equivalent surface. The agent's checklist is consumed inline via the degraded `skills/{define,review}` bodies.

### Aider (Tier 3)

All 12 skills emit as ambient guidance inside `CONVENTIONS.md`. Specific degradations:

1. **`llm_inline_invocation: required → inline_in_steering`** — Aider has no slash commands. Skill content folds into `CONVENTIONS.md` as numbered sections; user reads the conventions but does not invoke skills by name.

2. **No subagent invocation** — `agents/reviewer-agent` Skipped; review checklist inlines into `skills/review` body inside `CONVENTIONS.md`.

3. **No session lifecycle** — `session-harvest` becomes a documented ritual the user runs manually at session end.

### Continue (Tier 3)

Slightly better than Aider because Continue has `customCommands` in `.continuerc.json`:

1. **`llm_inline_invocation: required → glob_applied_rule`** (where applicable) OR inline_in_steering. For skills with cleanly-mappable invocation, emitter generates a `customCommands` entry. For skills that don't map (e.g. `audit` which is invoked but produces side-effect-heavy output), inline into systemMessage.

2. **No subagent + no session lifecycle** — same as Aider.

3. **`agents/reviewer-agent` Skipped** — same.

## Per-tier rollup

| Tier | Skills "Full" | Skills "Degraded" | Skills "Skipped" | Agents "Full" |
|---|---|---|---|---|
| Tier 1 (claude-code) | 12/12 | 0/12 | 0/12 | 1/1 |
| Tier 1 (copilot-agent) | 9/12 | 3/12 | 0/12 | 0/1 (Skipped) |
| Tier 2 (cursor) | 0/12 | 12/12 | 0/12 | 0/1 (Skipped) |
| Tier 2 (codex) | 0/12 | 12/12 | 0/12 | 0/1 (Skipped) |
| Tier 3 (aider) | 0/12 | 12/12 | 0/12 | 0/1 (Skipped) |
| Tier 3 (continue) | 0/12 | 12/12 | 0/12 | 0/1 (Skipped) |

Note: "Degraded" still means the skill emits + is usable, just with capability fallbacks. Adopters get something on every tier.

## How this matrix is maintained

For v0.1.x: hand-maintained in this file alongside emitter authoring.

For v0.2+: each emitter's emit report includes per-(skill, tool) outcome rows; a small aggregator script reads all emit reports + emits `docs/capability-matrix.md` automatically. The 2D matrix becomes a function of canonical/ × tool-capabilities.yaml.

For now (v0.1.x): if you change a canonical skill's `requires.*` block, OR you change a tool's entry in `tool-capabilities.yaml`, OR you author a new canonical skill: update this file in the same PR.

## When this matrix is stale

- Any canonical skill's `requires.*` changes (new requirement, new `degrades_to:`)
- Any entry in `tool-capabilities.yaml` changes (capability added, removed, `as_of` bumped past 180 days)
- A new tool ships its emitter

The CI workflow's "stale `as_of` warning" surfaces drift in tool-capabilities. The capability matrix itself is not validated by CI in v0.1.x (it's documentation); v0.2 ties them together.

## Cross-reference

- ADR-0003 (canonical spec format)
- ADR-0004 (three-tier enforcement model — defines the vocabulary used in this matrix)
- `canonical/tool-capabilities.yaml`
- `canonical/phases.md`
- `canonical/emitter-contract.md`
- `emitters/cursor/README.md` (Cursor-specific glob heuristics + degradation notes)
- `emitters/copilot/README.md` (Copilot-specific instruction-file structure + degradation notes)
