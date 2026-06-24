# How the skills were validated before release (and the measurement traps)

This is the account of validating the 12 skills before release: what is
certified, what is not, and the measurement traps found and corrected
along the way.

## What we set out to measure

Two independent axes:

1. **Triggering** — does a skill's description fire it on the right
   requests, and *not* on a sibling skill's requests? (For an overlapping
   SDLC set, sibling-poaching is the dominant real risk.)
2. **Behavioral conformance** — when a skill *is* followed, does it
   actually enforce its discipline, or is the body decorative prose?

## The arc (each step corrected the previous conclusion)

1. **run_eval, bare sandbox.** Anthropic's skill-creator triggering eval:
   negatives 42/42 (zero sibling-poaching), positives **0/42, uniform**.
   Uniform-zero is a tell: a real description defect varies per skill; a
   flat floor is environmental.
2. **Seeded-repo control.** Hypothesis: the empty sandbox suppresses
   triggering. Re-ran inside a realistic repo with an approved epic
   fixture. **No recovery.** The easy "just the sandbox" story was
   *falsified* — pointing at the harness mechanism itself.
3. **Faithful harness.** Built one: the *real* skills installed and
   competing, real `claude -p`, deterministic detection. A smoke test
   proved the mechanism works (a strong-match query fired the real skill;
   an unrelated query did not).
4. **Full faithful run: 12/12 discrimination, 2/18 positives.** The 2/18
   looked catastrophic.
5. **Transcript inspection inverted it.** One transcript, verbatim: *"the
   `plan` skill is a non-functional stub in this repo ... so I ran
   planning manually."* The model had **consulted the skill** and routed
   around a deliberately gutted test stub. `bypassed` was not
   `did-not-trigger`. Both cheap harnesses (a command stub; a body-gutted
   sentinel) were measuring themselves, not the skills. You cannot measure
   "would it follow the real skill" by replacing the skill with a
   non-skill.

## Verdict (what a reviewer can rely on)

**What is certified:**

- **Discrimination** — descriptions do not mis-fire: run_eval 42/42 +
  faithful harness 12/12 + correct sibling-routing on negatives.
- **Behavioral conformance** — `build` (RED observed before GREEN),
  `spec` (the define→spec component-count branch resolves correctly),
  `plan` (ordered task table + the coverage cross-check runs *before*
  presenting): 3/3 spot-checked via independent subagents against
  objective assertions.
- **Consultation occurs** — a captured transcript shows the model reading
  a skill's `SKILL.md` unprompted.

**Explicitly not certified.** Three distinct gaps, none a demonstrated defect:

1. **The *rate* of spontaneous implicit triggering** of substantive skills (a
   tooling gap). Every cheap harness is self-defeating; a faithful rate-harness
   needs real skill bodies with a covert in-procedure marker, or skill-level
   telemetry (the platform exposes none). Tracked as a v0.2 item.
2. **`plan-next` routing behaviour — now pilot-measured.** Triggering was already
   certified (fires on the right requests, no sibling-poaching); routing efficacy
   is now measured in `docs/findings/eval-plan-next-routing-2026-06.md` (Eval C):
   **8/8 fixtures routed correctly, 6/6 edge cases**, citing the `phases.md` table
   each time. Honest qualifier: a strong general reviewer matched it on 5/6 edge
   cases, so the skill's *measured* marginal value is narrow (+1 — the `Built`≠done
   phase-state semantics). Not yet swept over real multi-epic histories.
3. **The `reviewer-agent`'s efficacy — now pilot-measured, not yet certified.**
   A dedicated eval (`docs/findings/eval-reviewer-agent-2026-06.md`, 2026-06-03)
   ran it blind against seeded-defect fixtures: **9/9 caught vs a 7/9 control
   (+22pp), 0 seeded-defect-class false positives**, and it surfaced + fixed a
   real over-flagging bug. So this is no longer an existence proof. What it is
   *not* yet: certified by an isolated, pre-registered sweep over **real merged
   diffs** (the eval is an in-session pilot on constructed fixtures, scored by
   the same session that built them). The Min-Invariant rule is likewise
   pilot-measured (`docs/findings/eval-min-invariant-ab-2026-06.md`: 100% → 0%
   false-green slip-through on the shape-preserving class), not yet swept over
   real diffs.

None of these gate the kit's certified value: explicit `/skill` invocation, the
`sdlc` orchestrator, and the governance hook/engine do not depend on the implicit
trigger rate, and positioning does not claim agents auto-adopt the discipline
without invocation. They do bound what "validated skills" means here:
**triggering and discrimination are measured; behavioural efficacy is
spot-checked for three skills (`build`/`spec`/`plan`) and otherwise reasoned.**
The reviewer-agent, the Min-Invariant rule, and plan-next routing are now all
**pilot-measured** (evals A/B/C, 2026-06). The remaining uncertified fronts are
the **implicit-trigger rate** (a v0.2 tooling gap, above) and the **git /
testing-workflow convention layer** (unexamined by the SDLC-loop triangulation;
a dedicated triangulation is the next pass). Every pilot is an in-session,
constructed-fixture tier below an isolated real-corpus sweep — labelled as such
in each eval doc.

## The transferable lesson

When an eval metric looks decisive, great or terrible, **read the
transcript before believing it.** A number is a pointer to evidence, not a
substitute for it; a harness that stubs out the thing under test measures
the stub. This is the discipline `conventions/verification.md` names.

## Reproduction

The eval scripts and fixtures were run against
`Mansour-ElCheikh/agent-reliability-scaffold` skills using Anthropic's
`skill-creator` (`run_eval.py`) plus a purpose-built faithful harness.
This file is the canonical narrative account of the method and what it
does and does not certify. The dedicated evals repository
(<https://github.com/Mansour-ElCheikh/evals>, see
[evals/README.md](../../evals/README.md)) carries this as the
`scaffold-skill-eval` sub-eval; per that repository's status it is
currently a faithful pointer back to this writeup, with the frozen
pre-registration, faithful-harness scripts, and per-query corpus tracked
there as a follow-up (the two RepoNav sub-evals are the fully
reproducible-from-pre-registration deliverables in the first publication).
