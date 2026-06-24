---
validity: current
as_of: 2026-06-04
expires_after_days: 180
---

# Scaffold re-scored against the 11-axis software-factory rubric (2026-06)

This re-scores `agent-reliability-scaffold` against the same external 11-axis "software factory" rubric as [`sdlc-axes-scoring-2026-05.md`](sdlc-axes-scoring-2026-05.md), as of 2026-06-04, after three rounds of work the May snapshot predates: the 2026-06-03 flip (Min-Invariant predicates, four evals, the session-event writer, F15), the git+testing triangulation (ADR-0021/0013), and two deliberate axis-closers (ADR-0023 metrics reader, ADR-0024 blast-radius/sandbox).

The May finding is preserved unchanged as the 2026-05-20 snapshot (its numbers, 9 predicates / 9 ADRs / 21 tests, were accurate then; chronology is not rewritten). This document is the current snapshot. Same rubric, same method (`SOLID` / `PARTIAL` / `OUT OF SCOPE`, line-cited evidence, scored against what ships not what is promised). The source rubric is not named, per the no-external-names-in-public-docs convention.

## What changed since 2026-05

| Axis | May | Now | Why |
|---|---|---|---|
| 1 Blast-radius | PARTIAL | **SOLID** (caveat) | Four-layer model; kit owns 3 + contracts Layer 4 (ADR-0024, `conventions/sandbox.md`) |
| 11 Pipeline metrics | PARTIAL | **SOLID** (caveat) | Writer→log→**reader** loop closed (ADR-0023, `session-metrics.reader.example.mjs` + `METRICS.md`) |
| 6 Deterministic scripts | SOLID | SOLID (deeper) | 9→11 predicates, 21→57 tests, multi-framework deweld |
| 10 Codification | SOLID | SOLID (deeper) | 9→15 ADRs, 4 executed evals, this loop *is* a codification example |
| 8 Review personas | PARTIAL | **PARTIAL** (held) | One persona, now eval-validated; deliberately not force-expanded (see below) |

The other axes (2, 3, 4, 5, 7) were `SOLID` in May and are `SOLID` now, each with more evidence behind it (the per-axis notes say where). Axis 9 remains `OUT OF SCOPE` by positioning.

---

## Per-axis scoring (2026-06)

### Axis 1: Development environments that constrain blast radius — `SOLID` (caveat)

Blast radius is now a **four-layer composition** (ADR-0024). The kit owns three: write-time prevention (the `hook`, exit 2 on `error`), path-scope containment (`scope_containment` fencing protected paths), and destructive-op safety (`conventions/testing.md` §4: a destructive test cannot reach production). Layer 4, the sandbox runtime, stays adopter infrastructure, but `conventions/sandbox.md` is the composition contract for wiring the kit's layers into it (install the hook inside the sandbox, mount narrow, egress off, sandbox-as-outer-gate). **Caveat:** Layer 4 is a contract, not a bundled runtime, the same ADR-0001 boundary drawn around the analyser. Honest `SOLID`-by-positioning: every layer the kit can enforce from the repo + tool layer is enforced, and the one needing host infra has a clean contract.

**Evidence:** [`conventions/sandbox.md`](../../conventions/sandbox.md); [ADR-0024](../decisions/0015-blast-radius-and-sandboxing.md); [`governance/hook.example.sh`](../../governance/hook.example.sh); `scope_containment` in [`engine/src/predicates.ts`](../../engine/src/predicates.ts); [`conventions/testing.md`](../../conventions/testing.md) §4.

### Axis 2: Slim, maintained, used instructions — `SOLID`

12 skills + 1 subagent, anatomy-gated, eval-locked (May baseline). Now also two adopter-seeded conventions added this cycle (`git-workflow.md`, `testing.md`) plus `sandbox.md`, each terse and single-purpose.

**Evidence:** [`canonical/skills/`](../../canonical/skills/); [`scripts/check-anatomy.mjs`](../../scripts/check-anatomy.mjs); [`conventions/`](../../conventions/) (testing, git-workflow, sandbox, verification, memory-protocol, session-harvest).

### Axis 3: Rules, ADRs, docs loadable on demand — `SOLID`

11 deterministic predicates (was 9; +`tasks_min_invariant`, `test_shape_assertions`); **15 ADRs** (was 9; through ADR-0024); the `decision_keyword_without_adr` predicate forces an ADR on decision-language commits.

**Evidence:** [`governance/governance.yaml.example`](../../governance/governance.yaml.example); [`docs/decisions/`](../decisions/) (0001–0015); [`engine/src/predicates.ts`](../../engine/src/predicates.ts).

### Axis 4: Small independent slices — `SOLID`

`spec` task table + `build` slice-runner + `plan-next` (May baseline), now reinforced by `git-workflow.md` §3 (linear history) and §5 (atomic code-plus-status landings).

**Evidence:** [`canonical/skills/spec.md`](../../canonical/skills/spec.md), [`build.md`](../../canonical/skills/build.md); [`conventions/git-workflow.md`](../../conventions/git-workflow.md) §3, §5.

### Axis 5: Planning + review loops before implementation — `SOLID`

`plan` (read-only) + `review` + `sdlc` phase ordering + the adversarial `reviewer-agent` (May baseline), now with the persona **eval-validated**: 9/9 seeded-defect catch vs 7/9 control (+22pp), `docs/findings/eval-reviewer-agent-2026-06.md`.

**Evidence:** [`canonical/skills/plan.md`](../../canonical/skills/plan.md), [`review.md`](../../canonical/skills/review.md); [`canonical/agents/reviewer-agent.md`](../../canonical/agents/reviewer-agent.md); [`docs/findings/eval-reviewer-agent-2026-06.md`](eval-reviewer-agent-2026-06.md).

### Axis 6: Deterministic scripts — `SOLID`

The predicate path is pure TypeScript, zero LLM. Now **11 predicates** with **48 vitest + 9 `node --test` cases** (was 9 predicates / 21 tests), and the three test-file predicates are multi-framework (ADR-0022), still deterministic.

**Evidence:** [`engine/src/predicates.ts`](../../engine/src/predicates.ts); [`engine/test/`](../../engine/test/) (predicates, predicates-deweld, audit); [`governance/session-metrics.reader.test.mjs`](../../governance/session-metrics.reader.test.mjs).

### Axis 7: Blocking hooks, not suggestions — `SOLID`

`hook` exits 2 on `error`; `no_secrets` blocks every profile; profile ramp solo→team (May baseline). `sandbox.md` Layer 1 now frames the hook explicitly as the inner blast-radius gate.

**Evidence:** [`governance/hook.example.sh`](../../governance/hook.example.sh); [ADR-0007](../decisions/0007-universal-rules-ship-enabled.md); [`conventions/sandbox.md`](../../conventions/sandbox.md) §1.

### Axis 8: Focused review personas — `PARTIAL` (deliberately held)

One persona (`reviewer-agent`), now eval-validated (Axis 5). The rubric asks for many (security, architecture, performance, accessibility). **We deliberately do not force this to `SOLID`:** shipping unvalidated personas to game the axis would be the exact over-claim this kit exists to prevent, each would need its own catch-rate eval to be battle-tested. The kit instead ships one validated persona plus the demonstrated persona-creation pattern (the git+testing triangulation spun a focused tool-neutrality/over-claim reviewer on demand). Expansion stays adopter-friction-driven (F3).

**Evidence:** [`canonical/agents/reviewer-agent.md`](../../canonical/agents/reviewer-agent.md); [`docs/findings/wave4-self-bootstrap.md`](wave4-self-bootstrap.md) §F3; ROADMAP "Considered but not committed".

### Axis 9: Browser-driven QA — `OUT OF SCOPE`

Unchanged. The kit is build-time discipline, not runtime QA; a complementary surface it composes with, never provides (README "What it is not").

**Evidence:** [`README.md`](../../README.md) "What it is not"; [`canonical/skills/review.md`](../../canonical/skills/review.md).

### Axis 10: Codification (lessons → rules/hooks/ADRs/evals) — `SOLID`

The core value prop, deeper now: **15 ADRs**, **four executed evals** (`docs/findings/eval-*-2026-06.md`), `session-harvest` flushing to memory. This very cycle is a worked codification example: a lesson (test predicates were JS/TS-welded) became an ADR (0013), a regression test, and a convention, end to end.

**Evidence:** [`canonical/skills/session-harvest.md`](../../canonical/skills/session-harvest.md); [`docs/decisions/`](../decisions/) (0001–0015); [`docs/findings/`](.) (the four 2026-06 evals); [ADR-0022](../decisions/0013-testing-predicates-manifest-driven.md).

### Axis 11: Pipeline-improvement metrics — `SOLID` (caveat)

The May gap was the read side. It is closed (ADR-0023): the **session-metrics reader** computes cycle-time, review-latency, rejection-rate, block/degraded rate, a governance-warning trend, and context-growth flags over the session-event log the writer emits, and `METRICS.md` documents the two surfaces (this reader + the cross-commit ratchet). Writer→log→reader is now a complete loop. **Caveat:** it is a worked-example reader, not a hosted dashboard (ADR-0001), and the richest metrics need the adopter to populate optional log fields (`duration_ms`, `governance`, `context_kb`); absent, those read `null`, not a fabricated zero.

**Evidence:** [`governance/session-metrics.reader.example.mjs`](../../governance/session-metrics.reader.example.mjs) + [`.test.mjs`](../../governance/session-metrics.reader.test.mjs); [`governance/METRICS.md`](../../governance/METRICS.md); [ADR-0023](../decisions/0014-session-metrics-reader.md); [`governance/RATCHET.md`](../../governance/RATCHET.md).

---

## Summary

| Axis | May | Now |
|---|---|---|
| 1: Blast-radius constraint | PARTIAL | **SOLID** (Layer 4 contract, not bundled) |
| 2: Slim maintained instructions | SOLID | SOLID |
| 3: Rules + ADRs + docs loadable | SOLID | SOLID |
| 4: Small independent slices | SOLID | SOLID |
| 5: Planning + review loops | SOLID | SOLID (persona eval-validated) |
| 6: Deterministic scripts | SOLID | SOLID (11 predicates, 57 tests) |
| 7: Blocking hooks | SOLID | SOLID |
| 8: Focused review personas | PARTIAL | **PARTIAL** (held, not forced) |
| 9: Browser-driven QA | OUT OF SCOPE | OUT OF SCOPE |
| 10: Codification step | SOLID | SOLID (15 ADRs, 4 evals) |
| 11: Pipeline metrics | PARTIAL | **SOLID** (reader, not hosted dashboard) |

**Net: 9 SOLID, 1 PARTIAL (held by choice), 1 OUT OF SCOPE by positioning** (was 7 / 3 / 1). Every axis the kit claims to own is now `SOLID`; the two that are not are an honest, evidenced deferral (Axis 8) and a deliberate positioning boundary (Axis 9).

## What this scoring claims, and does not

- **Does not claim 11/11 SOLID.** Axis 8 is held at `PARTIAL` on purpose, forcing it would mean shipping unvalidated personas, the over-claim the kit guards against. Axis 9 is out of scope by positioning. A kit in this space that claimed 11/11 would be gaming the rubric.
- **The two newly-`SOLID` axes carry explicit caveats.** Axis 1's Layer 4 is a composition contract, not a bundled sandbox; Axis 11's reader is a worked example, not a hosted dashboard. Both are honest `SOLID`-by-positioning, not "we shipped a service".
- **Battle-tested where claimed.** The deterministic core (Axis 6) is 57 tests; the persona (Axis 5) is a measured catch-rate; the metrics (Axis 11) and blast-radius layers (Axis 1) are dogfooded and TDD-pinned. The shipped state, not promises.

## Cross-reference

- [`sdlc-axes-scoring-2026-05.md`](sdlc-axes-scoring-2026-05.md) — the prior (dated) snapshot this re-scores.
- [ADR-0021](../decisions/0012-git-and-testing-conventions.md), [ADR-0022](../decisions/0013-testing-predicates-manifest-driven.md), [ADR-0023](../decisions/0014-session-metrics-reader.md), [ADR-0024](../decisions/0015-blast-radius-and-sandboxing.md) — the decisions behind the score changes.
- [`README.md`](../../README.md), [`ROADMAP.md`](../../ROADMAP.md) — the positioning and forward work this validates.
