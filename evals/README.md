---
validity: current
as_of: 2026-06-03
expires_after_days: 90
---

# evals (breadcrumb + in-tree flip harness)

This is a pointer, not evidence. The measurement evidence for every
public claim in this repository lives in a **dedicated public `evals`
repository**, which is the single source of truth for pre-registrations,
harnesses, and raw results across projects. The one exception is the
in-tree **flip-pilot harness** below, which lives here as working
infrastructure and graduates its persistent results to that repo.

**Status: published public (2026-05-19).** The dedicated `evals`
repository is live at <https://github.com/Mansour-ElCheikh/evals> with the
RepoNav L8/T6 pre-registration + per-arm/per-model results + harness +
fixtures and the `reponav-toon-promotion` sub-eval, each pinned to its
measured RepoNav commit SHA and recorded model snapshot. ROADMAP
"Public-flip gate" criterion 7 is therefore SATISFIED; quantitative claims
on this repo's public surfaces are audit-grade reproducible, within the
boundaries each sub-eval's own RESULTS.md "What is missing" section
discloses.

## Why a separate repo (not a branch, not inlined)

Decided 2026-05-19. A dedicated public repo, plus this thin in-tree
breadcrumb, was chosen over (a) an eval branch per project and (b) inlining
eval corpora into each product repo. Rationale:

- **Discoverability.** Linked from the exact claim sentence; always on the
  default branch. Eval *branches* are effectively invisible (reviewers and
  CI do not check them out) and rot.
- **Provenance integrity.** Each result is pinned to the measured repo's
  commit SHA + model snapshot + date. A separate repo makes that pin
  explicit; an un-rebased eval branch silently decouples from what it
  measured.
- **One methodology spine.** A shared harness, one pre-registration
  convention, and one results schema across projects is itself the
  artifact.
- **Boundary hygiene.** Keeps RepoNav's eval out of this scaffold's tree,
  preserving the scaffold / analyzer separation this repo is careful about.
- **One auditable sanitization pass** for transcripts and fixtures.

## What lives there

| Sub-eval | Measures | Backs the claim | Status |
|---|---|---|---|
| `reponav-l8-correctness` | Architectural-decision correctness with vs. without deterministic arch context (the lever sweep) | The 8% to 92% case-study number (README, ARCHITECTURE) | Published, pinned |
| `reponav-toon-promotion` | TOON vs. JSON context-compression (RepoNav ADR-0041) | The TOON-format compression figures (a separate axis; not the correctness lift) | Published, pinned |
| `scaffold-skill-eval` | Skill description discrimination + behavioral conformance, and the measurement-trap arc | `docs/findings/skill-eval-methodology-2026-05.md` | Pointer |
| `scaffold-min-invariant` | Min-Invariant A/B false-green slip-through + a real-repo predicate FP sweep | ADR-0010; `docs/findings/eval-min-invariant-ab-2026-06.md` | Pilot (2026-06, staged) |
| `scaffold-reviewer-agent` | Reviewer-agent seeded-defect catch-rate vs a generic reviewer | `docs/findings/eval-reviewer-agent-2026-06.md` | Pilot (2026-06, staged) |
| `scaffold-plan-next-routing` | plan-next routing on the documented edge rules | `docs/findings/eval-plan-next-routing-2026-06.md` | Pilot (2026-06, staged) |

Each published sub-eval directory carries `PREREGISTRATION.md`, `harness/`,
`fixtures/`, `RESULTS.md`, and `READING.md`; a top-level `METHODOLOGY.md` is
the cross-project spine.

## Integrity rule

A result is only cited once it is reproducible from a frozen
pre-registration against a pinned measured-repo SHA and a recorded model
snapshot. Unmeasured or unpinned claims do not ship on public surfaces
(`memory/provenance.md`). The flip pilots below are labelled `Pilot`, never
`Published`, exactly because they ran in-session rather than as isolated
pinned sweeps.

---

# In-tree flip harness (2026-06 pilots)

The working harness for the four efficacy evals from the 2026-06 scaffold
flip. The headline results + methodology live in `docs/findings/` (the
durable scaffold record); the persistent runs graduate to the `evals` repo
(the three `scaffold-*` pilot dirs are already staged there). Run outputs
(`results.json`, raw verdicts) are gitignored.

| Eval | Question | Design + results | Harness | Verdict (2026-06-03, pilot) |
|---|---|---|---|---|
| **B — Min-Invariant A/B** | Does a concrete Min-Invariant reduce false-green slip-through vs a shape-only assertion? | `docs/findings/eval-min-invariant-ab-2026-06.md` | `min-invariant-ab/` | PASS (100%→0%) |
| **B2 — predicate FP sweep** | Real-world false-positive of the two shipped predicates? | (same doc, §Eval B2) | `predicate-sweep/` | `tasks_min_invariant` 0 FP; `test_shape_assertions` ~25% FP → opt-in confirmed |
| **A — reviewer-agent catch-rate** | Does the reviewer-agent catch seeded defects, and beat a generic reviewer, at acceptable FP? | `docs/findings/eval-reviewer-agent-2026-06.md` | `reviewer-agent/` | PASS (9/9 vs 7/9, +22pp) |
| **C — plan-next routing** | Does `plan-next` route correctly on the documented edge rules? | `docs/findings/eval-plan-next-routing-2026-06.md` | `plan-next-routing/` | PARTIAL (8/8 correct; marginal value +1, not the ≥2 bar) |

All four are **in-session pilots** (constructed fixtures, single run each, sonnet) — a tier below an isolated real-corpus sweep; each doc says so. The git/testing-workflow convention layer is **not** covered here (a dedicated triangulation).

## Running the flip pilots

```bash
# Eval B (deterministic — real vitest; the min.arm suite is designed to fail = a catch)
pnpm exec vitest run --config evals/min-invariant-ab/vitest.config.mjs && node evals/min-invariant-ab/tally.mjs
# Eval B2 (predicates vs a real repo's tasks.md + test files)
node evals/predicate-sweep/sweep.mjs /path/to/a/real/repo
```

Evals A + C are agentic: each fixture is reviewed/routed in a blind fresh-context subagent reading the real `reviewer-agent.md` / `plan-next.md`; fixtures + labels are in `*/fixtures/`, per-run verdicts in the originating session transcript. Full method + scoring: the `docs/findings/eval-*` docs and the staged `scaffold-*` dirs in the eval repo.
