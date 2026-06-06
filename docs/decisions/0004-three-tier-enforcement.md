# ADR-0004: Three-tier enforcement model

**Status:** Accepted
**Date:** 2026-05-18
**Supersedes:** None

## Context

The scaffold was reframed (option δ, locked 2026-05-17 in spine memory `wave4_option_delta_lock.md`) as a tool-agnostic SDLC discipline kit for mixed-tool engineering teams. The core technical observation: **hooks and subagents are Claude-Code-specific.** Cursor, Aider, Continue have no equivalents to PreToolUse interception. The scaffold's strongest claim ("write-time governance gate blocks bad agent moves") cannot apply uniformly across tools.

A naive emitter design would either (a) skip many skills on non-Tier-1 tools (leaving teams using Cursor with very thin output) or (b) pretend equivalence (emitting skills that reference hook-intercept mechanisms the host tool can't fire).

Both are wrong. The correct design is **degradation as a first-class concept**, with a small fixed vocabulary of fallbacks shared by emitters.

## Decision

Adopt a **three-tier enforcement model** as the scaffold's positioning + technical contract:

### Tier 1 — full enforcement

**Tools:** `claude-code`, `copilot-agent` (VS Code Copilot agent mode)

**Mechanisms available:**
- Write-time hook intercept (PreToolUse-style; can refuse a tool call before it executes)
- Adversarial subagent invocation in an isolated context
- Session lifecycle hooks (SessionStart, SessionEnd)
- LLM-invocable named skills (user types `/skill-name`; host dispatches)

**What this means for skills:** every canonical skill emits in its full form. Adversarial pre-review skills actually run an isolated subagent. Write-time gates actually block.

### Tier 2 — advisory + commit-time

**Tools:** `cursor`, `codex`

**Mechanisms available:**
- Glob-applied advisory rules (Cursor MDC) OR single steering file (Codex AGENTS.md)
- LLM-invocable named skills (partial / not at all)
- Git pre-commit gate (engine-backed)

**What this means for skills:** skills emit as advisory steering content + commit-time enforcement. Adversarial pre-review degrades to inlined review-checklist in the skill body. Write-time gating degrades to commit-time gating.

### Tier 3 — steering + commit-time only

**Tools:** `aider`, `continue`

**Mechanisms available:**
- Single steering file (`CONVENTIONS.md` or `.continuerc.json` systemMessage)
- Slash commands in some cases (Continue's `customCommands`)
- Git pre-commit gate (engine-backed)

**What this means for skills:** skills emit as ambient guidance text. Subagent invocation is omitted (the host can't run isolated reviewer contexts). No per-skill invocation in most cases.

### Capability-fallback vocabulary (locked)

When a canonical skill declares `requires.<capability>` with a `degrades_to:` field, the value MUST be one of these recognised fallbacks. Emitters and skill authors share this vocabulary so degradation is consistent across tools.

For `hook_intercept`:
- `commit_time_gate` — the check moves from write-time PreToolUse to git pre-commit. Bad code may have been written; commit fails.
- `advisory_only` — the check moves to the steering file as guidance; no mechanical enforcement.
- `audit_log_only` — the check records to an audit log but never blocks.

For `subagent_invocation`:
- `inline_review_in_skill_body` — the subagent's checks become a checklist inside the skill body, run by the main LLM session. Loses fresh-context isolation; keeps checklist value.
- `omit` — the subagent step is dropped entirely.

For `session_lifecycle_hooks`:
- `manual_invocation` — the hook's work moves to a named skill the user invokes (e.g. `/session-harvest` at session end).
- `commit_time` — the hook fires on git commit instead of session boundary.
- `omit` — the hook's work doesn't happen on this tool.

For `llm_inline_invocation`:
- `glob_applied_rule` — the skill becomes a glob-applied advisory rule. Applied when the file glob matches; not user-invoked.
- `inline_in_steering` — the skill's content folds into the project's steering file. No invocation mechanism.
- `omit` — the skill is skipped for this tool.

The full vocabulary lives in `canonical/phases.md` §"Capability fallbacks". This ADR is the canonical reference; `canonical/phases.md` is the implementation reference.

### Degradation-is-mechanical rule

**Skill authors do not write tier-specific logic.** Canonical skill bodies stay tool-agnostic; capability requirements + `degrades_to:` declarations are the only points where tier-awareness enters the design.

The emitter resolves capability requirements against `canonical/tool-capabilities.yaml` and applies the declared fallback (or skips the skill if no fallback exists). Adopters see emit reports that name every degradation explicitly.

## Consequences

### Positive

- **Honest positioning.** The kit's pitch ("author once, emit to any coding tool; same standards across IDEs") is qualified by an explicit capability matrix. No over-claiming.
- **Adopter trust.** A team adopting the kit sees exactly what their tool gets vs Tier 1 — no surprises post-adoption.
- **Mechanical degradation.** A new canonical skill ships with `requires.*.degrades_to:` declarations and works across all tiers automatically; no per-tier skill rewriting.
- **Mechanical tool addition.** A new tool ships with a `tool-capabilities.yaml` entry and an emitter; existing canonical skills emit (or degrade) against it automatically.
- **Honest case-study evidence.** The README's 8% → 92% claim is Tier 1 evidence (Claude Code analyser + hook + subagent loop). Tier 2/3 evidence would need separate measurement; the kit doesn't claim equivalence.

### Negative

- **Tier 3 outcomes are thinner.** Aider and Continue users get steering-file guidance + commit-time gating, not write-time gates. This is honest; some adopters will choose Tier 1/2 tools as a result. That is the correct response to the constraint.
- **Tier classification can drift.** Vendors add features (e.g., Cursor adds hooks → tier upgrade) or remove them (less common). The `as_of` date in `tool-capabilities.yaml` is the staleness signal; CI warns at >180 days.
- **Capability matrix is per-(skill, tool, version) — a 3D space.** For v0.1 we collapse to a 2D snapshot at a fixed `as_of`. Adopters using older tool versions may see emit-time surprises if their tool predates the `as_of` baseline.

### What this newly permits

- Cursor + Claude Code + Copilot + Codex + Aider + Continue all consume the same canonical layer; emit outcomes differ per tier but discipline is shared.
- Adding a new tool is a one-time cost: write its emitter + add a `tool-capabilities.yaml` entry + tests. No canonical changes required if the tool fits the existing tier definitions.
- Tier moves: if Cursor lands hooks tomorrow, change its entry in `tool-capabilities.yaml` + bump `as_of`; emitters automatically use the upgraded capability.

### What this newly prevents

- **Pretending equivalence.** No skill emits to a tool as if the tool has a capability it lacks.
- **Per-tier skill rewriting.** Skill authors stay tool-agnostic.
- **Silent capability mismatch.** Every degradation surfaces in the emit report.

## What this ADR does *not* do

- **Does not enumerate every tool.** The 6 tools listed reflect 2026-05 reality. New tools get added to `tool-capabilities.yaml` without an ADR per tool.
- **Does not lock specific tools to specific tiers.** A tool's tier is determined by its capabilities at `as_of`; tier moves don't require an ADR.
- **Does not specify enforcement implementation.** The rules engine (S6.3) implements the commit-time gate; emitters specify hook wiring per tool. Both reference this ADR for vocabulary.
- **Does not claim the three tiers are exhaustive.** If a future tool offers a fundamentally new mechanism (e.g., LSP-integrated rules), a future ADR may add Tier 0 or extend the model. v1 covers the May 2026 landscape.

## Cross-reference

- ADR-0001 (scaffold charter — what ships)
- ADR-0002 (governance YAML shape)
- ADR-0003 (canonical spec format — the layer this tier model emits from)
- `canonical/tool-capabilities.yaml` (per-tool support data)
- `canonical/phases.md` (phase vocabulary + capability fallback definitions)
- `canonical/emitter-contract.md` (emitter behaviour for degradation)
- `docs/capability-matrix.md` (per-(skill, tool) outcome snapshot)
- Spine memory `wave4_option_delta_lock.md` (the option δ adoption that drove this tier model)
