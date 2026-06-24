# Phases vocabulary v1

**spec_version:** 1

Canonical skill specs reference phases via `applicable_phases:` in their frontmatter. This document defines the phase vocabulary so emitters + the SDLC orchestrator can route correctly.

Phases also map to the three-tier enforcement model: some skills only emit for tiers that support the mechanisms the phase needs.

---

## SDLC phase vocabulary

| Phase slug | Description | Skills that operate in this phase |
|---|---|---|
| `define` | Capture intent + initial constraints. Produce epic.md + tasks.md (1-2 components) or per-component specs/ (3+). | `spec` (the `define` skill was merged into `spec` per ADR-0006) |
| `plan` | Break down approved scope into ordered TDD task list. Produce plan.md + tasks.md. | `plan`, `plan-next` |
| `build` | Execute TDD red-green-refactor against tasks.md, one task per slice. | `build` (the instructional TDD runner; composes with the mechanical R2/R2b hook rule) |
| `review` | Self-review built work; ship on pass. | `review` |
| `refactor` | Execute controlled refactors (moves, renames, restructuring) with safety gates. | `refactor` |
| `audit` | Periodic governance health check on the repository. | `audit` |
| `session-close` | End-of-session ritual: capture learnings, write memory, trigger harvest. | `session-harvest` |
| `cross-phase` | Operates across phases (orchestrator or always-on). | `sdlc` |

A canonical skill may declare one or more phases:

```yaml
applicable_phases: [plan]
applicable_phases: [define, plan]
applicable_phases: [cross-phase]
```

If `applicable_phases` is omitted, the skill is treated as `[cross-phase]` (always available).

---

## Epic-status routing (single source of truth)

An epic's `**Status:**` line in `dev/epics/<NNN>-<name>/epic.md` — auto-scanned from `dev/epics/*/epic.md` — is the single source that decides which phase runs next. Both the `sdlc` orchestrator (its Step 2) and the `plan-next` skill **consume** this table; neither restates it. Change routing here, in one place (ADR-0011, closes F15).

| epic.md `**Status:**` | Route to |
|---|---|
| no `dev/epics/`, or no epics found | Define phase (new epic) |
| `Defining` | Define phase (resume) |
| `Approved` / `Planned` | Build phase |
| `Building` | Build phase (resume) |
| `Built` | Review phase |
| `Shipped` | Done — advance to the next unstarted epic |

Skill-specific behaviour layers on top of this table; it does not duplicate it:

- `sdlc` invocation overrides: `/sdlc "description"` forces a new epic regardless of existing state; `/sdlc {epic-name}` targets a specific epic and routes by its status.
- `plan-next` signal priority: epic-status outranks the roadmap's "next unstarted items" (which may lag); structural risk re-ranks candidates.

---

## Three-tier enforcement model

Per ADR-0004 (to be authored in S6.2):

### Tier 1 — full enforcement

Tools: `claude-code`, `copilot-agent`

Mechanisms available:
- Write-time hook intercept (PreToolUse-style)
- Adversarial subagent invocation in a separate context
- Session lifecycle hooks (SessionStart, SessionEnd)
- LLM-invocable named skills

What this means for skills: every canonical skill emits in its full form. Adversarial pre-review skills (e.g., wired through `reviewer-agent`) actually run a subagent. Write-time gates actually block.

### Tier 2 — advisory + commit-time

Tools: `cursor`, `codex`

Mechanisms available:
- Glob-applied advisory rules (Cursor MDC) OR single steering file (AGENTS.md)
- LLM-invocable named skills (partial / not at all)
- Git pre-commit gate (engine-backed)

What this means for skills: skills emit as advisory steering content + commit-time enforcement. Adversarial pre-review degrades to inlined review logic in the skill body. Write-time gating degrades to commit-time gating.

### Tier 3 — steering + commit-time only

Tools: `aider`, `continue`

Mechanisms available:
- Single steering file (CONVENTIONS.md or `.continuerc.json` systemMessage)
- Slash commands in some cases (Continue)
- Git pre-commit gate (engine-backed)

What this means for skills: skills emit as ambient guidance text in the steering file. No per-skill invocation in most cases. Subagent logic is omitted (the host can't run isolated reviewer contexts).

---

## Capability fallbacks

When a canonical skill declares `requires.<capability>` with a `degrades_to:` field, the value is one of these recognised fallbacks. Emitters and skill authors share this vocabulary so degradation is consistent.

### `hook_intercept` fallbacks

| Fallback | What it means |
|---|---|
| `commit_time_gate` | The check moves from write-time PreToolUse to git pre-commit. The bad code may have been written, but the commit fails. |
| `advisory_only` | The check moves to the steering file as a "you should not do X" advisory; no mechanical enforcement. |
| `audit_log_only` | The check records to an audit log but never blocks anything. |

### `subagent_invocation` fallbacks

| Fallback | What it means |
|---|---|
| `inline_review_in_skill_body` | The would-be subagent's checks are written as a checklist inside the skill body, run by the main LLM session. Weaker (no fresh-context adversarial pass) but functional. |
| `omit` | The subagent step is dropped entirely for this tool. The skill emits without any review step. |

### `session_lifecycle_hooks` fallbacks

| Fallback | What it means |
|---|---|
| `manual_invocation` | The hook's work moves to a named skill the user invokes (e.g., `/session-harvest` at session end instead of an automatic SessionEnd hook). |
| `commit_time` | The hook fires on git commit instead of session boundary. |
| `omit` | The hook's work doesn't happen on this tool. |

### `llm_inline_invocation` fallbacks

| Fallback | What it means |
|---|---|
| `glob_applied_rule` | The skill becomes a glob-applied advisory rule (Cursor MDC). Applied when the file glob matches; not user-invoked. |
| `inline_in_steering` | The skill's content folds into the project's steering file (CONVENTIONS.md, AGENTS.md). No invocation mechanism. |
| `omit` | The skill is skipped for this tool. |

### Emitter behaviour summary

For each canonical skill / agent:
1. Read its `requires.<capability>` declarations.
2. For each capability, check the target tool's support in `tool-capabilities.yaml`.
3. If supported → emit normally.
4. If not supported and `degrades_to:` is set → emit using the fallback's shape.
5. If not supported and `degrades_to:` is missing → behaviour depends on `level`:
   - `required` → skip the skill; record in emit report §Skipped
   - `preferred` → emit a minimum version; record in emit report §Degraded
   - `not_needed` → emit normally (capability is irrelevant)

---

## How to update this document

- New phase slug: add a row to the phase vocabulary table. Document which skills land in it. Emitters need no change (phases are documentation for the SDLC orchestrator + skill authors).
- New capability fallback: add to the appropriate fallback table. Document what emitters do when they see it. If existing skills should adopt the new fallback, that's a separate canonical-spec change.
- Tier reshuffle (e.g., a tool gains a capability that promotes its tier): update `tool-capabilities.yaml` `tier:` field + the tool's entry, then update the tier descriptions here if affected. ADR if the change affects emitter logic.

---

## Cross-reference

- `canonical/emitter-contract.md` (capability mapping mechanism)
- `canonical/tool-capabilities.yaml` (tool capability data)
- `canonical/governance-rule.schema.md` (severity + enforcement vocabulary)
- ADR-0003 (canonical spec format — pending S6.1)
- ADR-0004 (three-tier enforcement — pending S6.2)
