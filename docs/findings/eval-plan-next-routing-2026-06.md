# Eval C — plan-next routing efficacy

**Date:** 2026-06-03
**Status:** executed (pilot). Design pre-registered below before the run.
**Closes:** the "`plan-next` routing is the one named efficacy front with no eval at all" gap (`skill-eval-methodology-2026-05.md`).
**Persistent home:** design + headline here; fixtures + raw verdicts graduate to the eval repo. Working harness: `evals/plan-next-routing/`.

## The question

`plan-next` (and `sdlc`, which shares the table) routes by reading a context stub
and mapping each epic's `**Status:**` to a phase via the canonical Epic-status
routing table (`canonical/phases.md`, ADR-0011). The status→phase lookup is
trivial; the *efficacy* question is whether an agent following the skill gets the
**documented edge rules** right — the ones a naive reviewer would slip on:

- **Shipped-skip** — a `Shipped` epic is not re-suggested; routing advances to the next unstarted item.
- **Precedence** — `Epic status` outranks the roadmap's "Next unstarted items" when they conflict.
- **Governance gate** — error-severity findings are P0 regardless of roadmap priority.
- **Greenfield** — no epics → Define a new epic from the roadmap item.
- **Staleness** — a stub older than HEAD is not trusted blindly; fall back to a live read.
- **Multi-in-flight** — with several active epics, surface the choice with a rationale rather than grabbing one blindly.

**Hypothesis (H1):** an agent following `plan-next` routes correctly on these edge
cases at a materially higher rate than a naive "what should I work on next?"
reviewer without the skill + table.

## Method

Eight context-stub fixtures (`evals/plan-next-routing/fixtures/`, per
`canonical/plan-next-stub.schema.md`): 2 happy-path (sanity) + 6 edge. Ground
truth in `labels.json` (expected route + the rule under test), kept out of the
prompt (blind). Two arms, fresh-context subagents, sonnet both:

- **Arm R (plan-next):** reads the real `plan-next.md` + `phases.md` routing table + the stub, returns its recommendation.
- **Arm C (control):** reads only the stub + "recommend the next step", no skill, no table.

Scored: is the routing decision correct (right phase + right epic, edge rule
honored)? Transcripts read before the number is believed.

## Pre-registered acceptance bar

1. Arm R routes ≥ 7/8 correctly (including ≥ 4/6 edge cases), AND
2. Arm R beats Arm C by ≥ 2 fixtures on the edge cases (the skill's marginal value is the edge rules), AND
3. no Arm R happy-path miss (the trivial lookups must be solid).

## Results

Run 2026-06-03, sonnet both arms, blind fresh-context subagents (same in-session pilot tier as Eval A — see that doc's harness-honesty note). **VERDICT: H1 PARTIALLY supported.** Two of three pre-registered bars cleared; the marginal-value bar did not.

| Bar | Result |
|---|---|
| 1. Arm R ≥ 7/8 incl ≥ 4/6 edge | **PASS — 8/8, 6/6 edge** |
| 3. No Arm R happy-path miss | **PASS — R01, R02 both correct** |
| 2. Arm R beats Arm C by ≥ 2 on edge | **NOT MET — margin +1** (Arm R 6/6, Arm C 5/6 edge) |

**The primary result stands: `plan-next` routing is now measured, and it is correct (8/8).** The honest qualifier: a strong general reviewer (the control) also routed 5/6 edge cases correctly, so the skill's *measured* marginal value on these fixtures is small.

## Run log

| Fixture | Rule | Arm R (plan-next) | Arm C (control) |
|---|---|---|---|
| R01 | happy-Building | Build/resume 002 ✓ | (not run — sanity) |
| R02 | happy-Built | Review 001 ✓ | (not run — sanity) |
| R03 | Shipped-skip | Define 002-export, skip Shipped 001 ✓ | start 002-export ✓ |
| R04 | precedence | resume Build 003, reject 099 ✓ | finish 003 first, reject 099 ✓ |
| R05 | multi-in-flight | **Review 001 (Built blocks queue) + surfaced 002 ✓** | **start 003-export; read Built as "done" ✗** |
| R06 | greenfield | Define new 001-onboarding ✓ | create 001-onboarding epic ✓ |
| R07 | governance-gate | fix 2 errors first ✓ | fix 2 errors first ✓ |
| R08 | staleness | flag stale + regenerate before routing ✓ | flag stale + regenerate ✓ |

The single divergence (R05): Arm R recognized that `Built` means "needs Review," not "done," and routed to Review before opening new scope; Arm C treated `Built` as done and grabbed the next unstarted item, abandoning an in-flight epic. Every other edge rule (Shipped-skip, precedence-over-roadmap, governance-errors-first, staleness-refresh) the control got right by general engineering instinct.

## Interpretation

1. **plan-next routing is no longer unmeasured — and it routes correctly (8/8, 6/6 edge),** citing `phases.md` + the right rule each time. The named "no eval at all" gap from `skill-eval-methodology-2026-05.md` is closed: routing is now pilot-measured.
2. **The skill's measured marginal value over a strong baseline is narrow (+1 edge fixture).** This is the same honest pattern Eval A found: a capable model already does most of the job by reasoning; the structured skill's value is the *specific* convention it encodes that general reasoning conflates. Here that convention is the **phase-state semantics** — `Built` is a gate (route to Review), not a terminal "done." That is exactly where the control slipped (R05) and the skill held.
3. **The pre-registered ≥2 margin was set too high for a sonnet control** — routing rules like "finish in-flight before starting new" and "errors before features" are good-engineering instinct, not scaffold-unique. Reported as not-met rather than re-scored. The value of writing routing down is consistency across agents/sessions/weaker models, not out-reasoning a strong model on a single decision.

**Honest bounds:** same pilot tier as Eval A (in-session subagents, constructed fixtures, single run each, sonnet, same session authored+scored). A weaker control model would likely widen the margin (the routing rules would stop being "obvious"); that, plus real multi-epic histories, graduates to the eval repo.

**Net:** plan-next routing moves from *unmeasured* to *pilot-measured-correct*. It does **not** earn a strong "the skill beats a good engineer" claim on this tier — and the doc says so.

## Cross-reference

- `canonical/skills/plan-next.md`, `canonical/skills/sdlc.md`, `canonical/phases.md` (ADR-0011 routing table).
- `docs/findings/skill-eval-methodology-2026-05.md` — the gap this closes.
- `evals/plan-next-routing/` — fixtures, labels, raw verdicts (graduate to the eval repo).
