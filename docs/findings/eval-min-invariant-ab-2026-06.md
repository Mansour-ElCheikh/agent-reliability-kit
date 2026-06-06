# Eval B — Min-Invariant efficacy (A/B false-green slip-through)

**Date:** 2026-06-03
**Status:** executed (pilot). Design pre-registered below before the run; results filled after.
**Upgrades:** the "reasoned, unproven by sweep" label on `min_invariant_per_task` / `test_invariants` (ADR-0010, `governance/governance.yaml.example`).
**Persistent home:** the design + headline live here; the harness, fixtures, and raw runs graduate to the separate eval repo (per the evals-evidence convention). The working harness is `evals/min-invariant-ab/`.

## The question

The scaffold's `plan` / `build` / `review` skills demand a **Min-Invariant**: every
task's test must assert a concrete domain fact (a count, value, named field,
match) rather than a shape (`array`, `defined`, `toHaveProperty`). The claim is
that this prevents *false greens* — a test that passes while the implementation
is broken. That claim was **reasoned, not measured**. This eval measures it.

**Hypothesis (H1):** for a *shape-preserving* broken implementation (one that
returns a value of the right shape but the wrong content — the dangerous,
common failure mode), a shape-only assertion passes (the bug ships green) while a
concrete Min-Invariant assertion fails (the bug is caught).

**Null (H0):** assertion style does not change slip-through; both arms catch or
miss the broken implementation at the same rate.

## Method

A/B over one task set, two arms, two implementations per task:

- **Arm S (shape-only):** the test asserts only shape — `Array.isArray`,
  `toBeDefined`, `typeof`, `toHaveProperty(key)` (key presence, not value).
- **Arm M (Min-Invariant):** the test asserts a concrete domain fact —
  `toBe(value)`, `toEqual(...)`, `toContain(...)`, `toBeGreaterThan(n)`,
  `toHaveLength(n)`, `toMatch(/.../)`, or a discriminating case.

Each task ships a **correct** impl and a **broken** impl. Both arms run against
both impls, in real `vitest`. A test that **passes** against the *broken* impl is
a **false-green slip-through** (the bug shipped). A test that **fails** against
the broken impl is a **catch**.

The task set is built to span the failure classes, not stacked toward the
hypothesis:

- **shape-preserving** (the class Min-Invariant targets): broken impl returns the
  right shape, wrong content (empty array, zero count, empty string, default
  object, unsorted list, always-true validator). This is where real false greens
  live. RepoNav's own R21/R20 fixtures are this class (a broken analyzer returning
  `[]`; `coverage >= 0.8` / `score > 40` shape-risk assertions; the dead-code
  count strengthened to `toBeGreaterThan(0)`).
- **shape-changing** (control): broken impl returns `undefined` / wrong type. Here
  a shape-only assertion *already* catches it — included to show Min-Invariant's
  advantage is specific to the shape-preserving class, not universal, and that
  shape-only assertions are not worthless.

**Sanity control:** both arms must **pass** against the *correct* impl. If Arm M
fails on the correct impl, it is a broken test, not a catch — that scenario is
disqualified.

## Pre-registered acceptance bar

H1 is supported iff, over the shape-preserving subclass:

1. Arm S slip-through rate ≥ 80% (shape-only ships these bugs green), AND
2. Arm M slip-through rate ≤ 20% (Min-Invariant catches them), AND
3. reduction (S minus M) ≥ 60pp, AND
4. sanity control holds: both arms green on every correct impl.

On the shape-changing control, both arms are expected to catch (slip-through ≈ 0
in both) — that subclass does not count toward H1 (it is the negative control).

## What would falsify / weaken it

- Arm M slipping on shape-preserving breaks (a concrete assertion that still
  passes a wrong value) would weaken H1.
- Arm S catching shape-preserving breaks (a shape assertion that happens to fail
  on wrong content) would weaken H1.
- Arm M failing on correct impls (over-strict tests) would mean the "catch" is an
  artefact, not discrimination.

## Results

Run 2026-06-03, real `vitest` 1.6.1, harness `evals/min-invariant-ab/` (10
scenarios). **VERDICT: PASS — H1 supported.** All four pre-registered bars cleared.

| Metric (shape-preserving class, n=9) | Result |
|---|---|
| Arm S (shape-only) false-green slip-through | **9/9 = 100%** |
| Arm M (Min-Invariant) false-green slip-through | **0/9 = 0%** |
| Reduction (S minus M) | **100pp** |
| Sanity control (both arms vs correct, 20 tests) | 20/20 pass (0 failures) |
| Shape-changing control (n=1) | both arms catch (0/1 slip each) |

Every shape-preserving broken implementation shipped green under a shape-only
assertion and was caught under the concrete Min-Invariant. The negative control
(broken returns `undefined`) was caught by *both* arms, confirming the advantage
is specific to the shape-preserving class, not a universal one.

## Run log

Per-scenario, assertion run against the BROKEN impl (`SLIP` = passed green;
`caught` = failed):

| Scenario | Class | Arm S | Arm M |
|---|---|---|---|
| deadcode-count | shape-preserving | SLIP | caught |
| exact-sum | shape-preserving | SLIP | caught |
| status-contains | shape-preserving | SLIP | caught |
| named-field-value | shape-preserving | SLIP | caught |
| discriminating-validator | shape-preserving | SLIP | caught |
| sorted-order | shape-preserving | SLIP | caught |
| nonempty-map | shape-preserving | SLIP | caught |
| coverage-threshold | shape-preserving | SLIP | caught |
| id-format | shape-preserving | SLIP | caught |
| shape-changing-control | shape-changing | caught | caught |

Sanity control (both arms vs CORRECT impl): 20/20 pass — the Min-Invariant tests
discriminate (pass correct, fail broken), they are not merely over-strict.

## Interpretation

On the shape-preserving false-green class — a broken implementation that returns
the right shape with the wrong content, which is how incomplete or regressed code
actually fails — assertion style is decisive: shape-only ships 100% of these
bugs green; the concrete Min-Invariant catches 100% of them. That is the
mechanism the `plan` / `build` / `review` skills' Min-Invariant rule is built on,
now measured rather than asserted.

**Honest bounds (this is a pilot, not a closed case):**

- **Constructed fixtures.** The 10 scenarios model the shape-preserving class and
  are grounded in real RepoNav patterns (the dead-code count, the `coverage >=
  0.8` / `score > 40` shape-risk assertions, the empty context-stub), but they
  are authored, not sampled from a corpus of real merged diffs. The result proves
  the *mechanism* crisply; it does not estimate the *base rate* of shape-only
  assertions or shape-preserving breaks in a real codebase.
- **Scoped to the class it targets.** The shape-changing control shows shape-only
  assertions are not worthless — they catch type/existence breaks. Min-Invariant's
  measured win is on the shape-preserving class specifically.
- **The matchers are the standard vitest matchers** the `build`/`review` skills
  already name; the result is a property of assertion semantics, not of this
  harness.
- **Deterministic harness.** This ran in-session via real `vitest`, but the
  outcome is a fixed property of the matchers, identical in-session or in a
  sandbox. So unlike Eval A (whose subagent runs carry a sandbox/independence
  caveat), Eval B has no isolation-tier caveat; the only pilot bound is that the
  fixtures are constructed rather than sampled from real diffs.

**What this changes:** the `min_invariant_per_task` / `test_invariants` label
moves from "reasoned, unproven by sweep" to "mechanism measured on a 10-scenario
pilot (100% to 0% slip-through on the shape-preserving class); base-rate sweep
over real merged diffs graduates to the eval repo." The governed rule (ADR-0010)
is no longer a floating convention *and* no longer an unmeasured one.

**Next (graduates to the eval repo):** sample real merged diffs to estimate (a)
how often shipped tests are shape-only and (b) how often a regression is
shape-preserving — turning this mechanism proof into a population estimate of
bugs-prevented.

## Eval B2 — the predicates run against REAL artefacts (2026-06-03)

Eval B proved the *mechanism* on synthetic fixtures. B2 ran the two shipped
predicates against real RepoNav artefacts (`evals/predicate-sweep/sweep.mjs`) to
measure real-world findings + false positives.

**`tasks_min_invariant` vs 15 real RepoNav `dev/epics/*/tasks.md`: 0 findings.**
Not because the columns are clean — because **RepoNav's own tasks.md carry no
Min-Invariant column** (0/15; their format is `| # | Task | TDD Behavior | Status |`).
The triangulation already noted "RepoNav's own epics never carry the Min-Invariant
column"; B2 confirms it mechanically. So: real-world **false-positive rate = 0**
(the predicate correctly no-ops on tables without the column), and **recall is
unmeasurable on RepoNav** (no positives to catch). This reinforces that the rule
is correctly shipped **opt-in** (ADR-0010): even its originator never retrofitted
the column. A recall measurement needs an adopting corpus (jobs' Min-Invariant
epic, "the best-executed instance across all three repos") — a graduation item.

**`test_shape_assertions` vs 115 real RepoNav `src/**/*.test.ts`: 25 findings.**
Spot-classified 4 (read the assertions, the methodology discipline):

| Flagged test | Verdict |
|---|---|
| `cli.integration` "outputs valid JSON and has expected structure" | **TP** — textbook R20 (asserts shape, not domain values) |
| `types.test.ts` "has id, entryPoint, steps, and anomalies fields" | **TP** — shape-only "has fields" |
| `layerDag` "collapses a cycle into a single SCC" → `expect(twoNodeComp).toBeDefined()` | **TP** — domain logic is in `.find()`, the assertion is shape-only |
| `tourResponseParser` "returns only steps — no graph field" → `expect(result).not.toHaveProperty('graph')` | **FP** — a meaningful *absence* assertion misread as shape-only |

~3 TP / 1 FP in the sample → a real, non-trivial false-positive rate on live code.
The FP source is identified: **negated matchers** (`.not.toHaveProperty`,
`.not.toBeNull`) and absence/other assertions (`toBeUndefined`, `not.toThrow`,
`toHaveLength(<var>)`) that are meaningful domain facts the regex does not
recognise.

**What this confirms + the tuning it earns:** shipping `test_shape_assertions`
**opt-in, advisory, adopter-scoped** (ADR-0010) was the right call — a
universal-enabled version would be noisy on real test suites. The ADR's "regex
heuristic that can mis-read" disclosure is now *measured*, not just stated.
Concrete v0.2 tuning (graduates to the eval repo with a full 25/25 classification
+ a TDD test): treat negated matchers as domain assertions, and add
`toBeUndefined` / `not.toThrow` / `toHaveLength(<var>)` to the domain-invariant
set. (Not hot-patched here: a predicate change needs a red test first, per the
kit's own TDD discipline.) `tasks_min_invariant` needs no tuning (0 FP).

## Cross-reference

- ADR-0010 — the Min-Invariant governed-rule binding this eval's label feeds.
- `engine/src/predicates.ts` — `tasks_min_invariant`, `test_shape_assertions`.
- `docs/findings/skill-eval-methodology-2026-05.md` — the "read the transcript /
  per-case detail before believing the number" discipline reused here.
- `evals/min-invariant-ab/` — the working harness (graduates to the eval repo).
