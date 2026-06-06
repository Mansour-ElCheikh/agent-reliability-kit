---
validity: current
as_of: 2026-05-20
expires_after_days: 180
---

# Hierarchical SDLC topology vs flat skill models: a comparison

Agentic coding scaffolds tend to settle on one of two skill-topology models: **flat** (many small single-purpose skills, no orchestrator, composition is implicit through skill-description matching) or **hierarchical** (an orchestrator routes by epic state, with phase skills underneath). The trade-offs are real and shape the rest of the discipline. This is a comparative analysis, anchored against `addyosmani/agent-skills` as the canonical flat reference.

## The two models, side by side

| | **Flat (`addyosmani/agent-skills`)** | **Hierarchical (this scaffold)** |
|---|---|---|
| Count | 23 skills | 12 skills + 1 subagent |
| Topology | Single-purpose skills, no orchestrator; composition is implicit (the agent description-matches the right skill) | `sdlc` orchestrates `define → plan → build → review` by epic status; phase skills sit below it |
| "Spec" surface | One skill (`spec-driven-development`) is itself a 4-phase gated workflow SPECIFY → PLAN → TASKS → IMPLEMENT | One skill (`spec`) with an internal component-count branch: 1-2 components → inline task table; 3+ → per-component spec files (ADR-0006 merged the prior `define`/`spec` fork) |
| "Review" surface | One skill (`code-review-and-quality`, "before merging any change"); periodic health lives in CI/governance, not a skill | Two skills: `review` (diff-scoped, pre-ship gate) + `audit` (repo-wide, periodic, narrates the engine output and hook diagnostics — not a second review) |
| Build discipline | First-class skills: `test-driven-development`, `incremental-implementation`, `debugging-and-error-recovery`, `performance-optimization`, `security-and-hardening`, `code-simplification` | `build` (instructional TDD runner) + `debugging-and-error-recovery` + `performance-optimization`, plus the governance hook's `tdd_test_first` rule (R2/R2b two-layer) — project-specific build details still adopter-provided |
| Orchestration | None (by design) | `sdlc` for phase dispatch by epic status + `plan-next` for cross-feature selection / triage |
| Selection layer | None — selection is punted to the human | `plan-next` (recent commits + governance findings + project state → "work on this next") |

## What each model buys, where each is fragile

**Flat (more, smaller skills):**

- *Buys:* low coupling between skills; new skills are additive (no orchestrator to update); composition emerges from skill-description matching; easier to reason about each skill in isolation.
- *Fragile at:* selection (no skill for "what should I work on next?" — the human has to choose); cross-skill consistency (each skill is independent, so two skills addressing the same phase can drift in style/expectation); discoverability past 20+ skills (the agent must match through more descriptions).

**Hierarchical (fewer skills + orchestrator):**

- *Buys:* deterministic routing by epic status (`sdlc` knows where you are and dispatches to the right phase skill); a selection layer (`plan-next` can read state and triage); fewer user-facing forks (a branch inside `spec` is preferable to a `define` vs `spec` user-facing choice); a clear "where am I in the lifecycle?" signal.
- *Fragile at:* the orchestrator becomes load-bearing (a routing-table bug affects every flow); user-facing forks are a temptation that has to be resisted (the ADR-0006 lesson: when a fork doesn't add rigor, it adds premature optionality); the orchestrator and selection layer can develop overlap if not actively curated (this scaffold's [F15](wave4-self-bootstrap.md) tracks the `plan-next` / `sdlc` routing-table overlap as a known v0.2 cleanup).

## When to use which

**Flat is a better fit when:**
- The scope is broad and exploratory (many distinct concerns, weak workflow shape).
- The team prefers explicit human selection (no orchestrator deciding for them).
- The scaffold author cannot guarantee the orchestrator stays clean as skills accrete.

**Hierarchical is a better fit when:**
- The workflow has a recognizable lifecycle (define → plan → build → review) and you want determinism inside it.
- The team values "always know where you are" over "always show all options."
- The scaffold author accepts the orchestrator-curation discipline as a recurring cost.

Neither model is "better" in the abstract. The differentiator is what kind of failure mode the team prefers: orchestrator-curation overhead (hierarchical) or selection-burden + cross-skill consistency drift (flat).

## This scaffold's choice

Hierarchical, with the orchestrator-curation discipline encoded as an active concern (F15 tracks the known overlap; the `define`/`spec` merge ([ADR-0006](../decisions/0006-merge-define-into-spec.md)) is a worked example of resisting the user-facing-fork temptation). The two skills the user explicitly named in early audits as suspect (`define` vs `spec`, `review` vs `audit`) were each resolved differently: one merged (premature optionality), one kept-but-reframed (legitimate altitude difference). That kind of per-pair analysis is the orchestrator-curation discipline in action.

The build phase, originally empty in the v0.1.0 cut, was populated in S6.4a with `build` (the TDD runner), `debugging-and-error-recovery`, and `performance-optimization` — closing the under-population gap the flat-model comparison surfaced. The scaffold still does not ship `incremental-implementation`, `security-and-hardening`, or `code-simplification` as first-class skills; those are project-specific enough that the kit defers them.

## Cross-reference

- [`canonical/skills/`](../../canonical/skills/) — the 12 audited skills
- [ADR-0006](../decisions/0006-merge-define-into-spec.md) — the `define`/`spec` merge decision
- [`wave4-self-bootstrap.md`](wave4-self-bootstrap.md) §F15 — the `plan-next` / `sdlc` overlap tracked for v0.2
- `addyosmani/agent-skills` — the flat reference (public; not in this tree)
