---
validity: current
as_of: 2026-05-20
expires_after_days: 180
---

# The narrative-vs-reality gate gap

A meta-finding from the 2026-05-20 pre-flip deep-dive: the scaffold's governance engine ships 9 deterministic predicates, and **not one of them enforces "claims in narrative documents match runtime reality."** Every predicate checks a code-level property (test-first, secrets, scope, boundary imports, validity frontmatter, skill anatomy size, etc.). The discipline that prevents code-quality drift does not prevent documentation-vs-code drift.

This document names the gap, traces the failure modes it enabled, and records the v0.2 commitment to close it.

## The drift this gap permitted

The 2026-05-20 deep dive surfaced a tier of drifts that no existing gate would have caught:

| Drift | Where | What survived through how many gates |
|---|---|---|
| `engine 15/15` in ROADMAP (actual is 21/21 post-S6.4a) | [ROADMAP.md](../../ROADMAP.md) §S6.4b paragraph | Through ADR-0007 sprint, post-flip-readiness PR, drift-reconcile PR, SHA-reframe PR; never re-evaluated against actual vitest count |
| `6 predicates` in S6.3 design review (actual is 9 post-ADR-0007) | (removed pre-flip) | Through the design-review doc's entire lifetime; numbers were true at S6.3 and never refreshed |
| `skill_anatomy` (ADR-0007) vs `skill_anatomy_size` (actual rule id) | [ADR-0007](../decisions/0007-universal-rules-ship-enabled.md) §1 | Through implementation; the ADR was written before the rule was implemented and stamped at slightly different naming |
| Vault "published separately" claim (no public vault repo exists) | [README.md](../../README.md) §Three complementary surfaces | Through the locked S6.4b positioning + all subsequent reviews; no gate checks external-artifact publication state against claim |
| `Not a runtime. Nothing executes.` (the engine + emitters + wrapper all execute) | README + ARCHITECTURE + NOTICE + memory | Through S6.3a, S6.3b, S6.4a, ADR-0007 — three sprints during which TypeScript surfaces landed without anyone re-evaluating the language. See [ADR-0008](../decisions/0008-not-a-runtime-language-reconciliation.md) for the reconciliation. |
| `canonical/governance-rule.schema.md` missing the ADR-0007 fields (`universal`, `safety`, `ramp_to_error_on_team`, `warn_bytes`, etc.) | `canonical/governance-rule.schema.md` | The engine `types.ts` was updated in PR #7; the human-facing schema doc wasn't part of that diff |
| CHANGELOG `[Unreleased]` describes ADR-0007 work but is missing #8 through #13 | [CHANGELOG.md](../../CHANGELOG.md) | Through six merged PRs; no gate enforces "every merged PR appears in the changelog" |

Every drift in this table is the same conceptual failure: **a public-surface claim about runtime state was never re-evaluated against runtime state**. Per-PR review caught the diff; nobody compared the global state of the narrative against the global state of the code.

## Why existing gates did not catch these

The 9 deterministic predicates currently shipped:

- `tdd_test_first`, `source_file_has_co_located_test` — file co-location
- `no_secrets` — pattern scan
- `scope_containment` — path-pattern
- `doc_validity` — frontmatter existence
- `boundary_imports` — import-pattern
- `decision_keyword_without_adr` — commit-message pattern
- `prompt_size_warn` — file size
- `test_file_in_manifest_directory` — file path
- `roadmap_reference_in_commit_message` — commit-message pattern

None of these are *cross-document semantic-consistency* predicates. The supporting agents (`brand-architect` for em-dash + measured-claim language; `positioning-architect` for substantive positioning) review *per-PR diffs* against locked positioning, not *global state against runtime probes*. The ratchet enforces *warning-count regression*, not semantic-claim regression.

The em-dash gate is a single-string mechanical check. The phantom-path scan is a specific string grep we ran manually. The drift class that needs catching — "the number in the narrative does not equal the number in the codebase" — has no predicate.

## What would close the gap

Three additions:

1. **`narrative_claim_validity` predicate.** Extracts numeric and named claims from narrative documents (configured via a small DSL: *"in README.md, the phrase `N skills` must equal `find canonical/skills/*.md | wc -l`"*) and verifies against runtime probes. Same shape as the other engine predicates: deterministic, ratcheted, JSON / TOON output.

2. **`docs_completeness` predicate.** Verifies the Tier 1/2/3 surfaces defined in [`conventions/repo-documentation.md`](../../conventions/repo-documentation.md) exist with non-empty content matching the tier's minimum.

3. **`docs-architect` subagent.** Third pillar after `brand-architect` (mechanical) and `positioning-architect` (substantive); responsible for substantive cross-surface completeness + consistency review. Reads the global state, not the per-PR diff.

The three together close the gap mechanically (1, 2) and substantively (3).

## Manual workaround until v0.2

Until those ship, the discipline is procedural:

- Before any release / public-flip / structural change: run a **drift sweep** that grep-greps every claimed count + path across all primary public surfaces and verifies against runtime probes (`wc -l`, `gh api`, build output). The 2026-05-20 deep dive is the worked example.
- At PR review: when the diff touches `engine/src/`, `canonical/skills/`, `canonical/agents/`, or `governance.yaml.example`, the reviewer asks *"does any narrative doc cite a count that this PR changes?"* and updates accordingly.

The procedural discipline is the same shape as the mechanical predicate; the predicate is just the mechanised version.

## Commitment

ROADMAP v0.2 includes:

- `narrative_claim_validity` predicate
- `docs_completeness` predicate
- `docs-architect` subagent
- `conventions/repo-documentation.md` (the contract these enforce) — shipped in v0.1.x (this release) as the prescriptive specification ahead of the automation

This finding is open until the v0.2 implementation lands.

## Cross-reference

- [`conventions/repo-documentation.md`](../../conventions/repo-documentation.md) — the documentation contract this gap concerns
- [ADR-0008](../decisions/0008-not-a-runtime-language-reconciliation.md) — a worked example of the drift class this gap enables
- [`comparison-vs-flat-skill-models.md`](./comparison-vs-flat-skill-models.md) — context: the orchestrator-curation discipline that the hierarchical SDLC topology requires; this gate gap is its mechanical analog at the documentation layer
- [`conventions/verification.md`](../../conventions/verification.md) — the verification-by-evidence principle; this gap is its violation at the meta-layer (the kit teaches verification but does not verify its own narrative)
