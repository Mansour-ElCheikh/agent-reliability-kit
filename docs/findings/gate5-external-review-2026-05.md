---
validity: current
as_of: 2026-05-19
expires_after_days: 90
---

# Gate 5: external review + remediation (2026-05-19)

This is the verdict artifact for ROADMAP "Public-flip gate" criterion 5
(at least one external review outside the regular review chain). It records
what the external review found, how each finding was remediated, the
dual-review outcome, the locked-criteria score, and the single remaining
blocker before the repository may flip public.

**This document does not flip the repository public.** The flip remains
gated on criterion 7 (a published public `evals` repository) and explicit
user authorization, per the user decision of 2026-05-19.

## Method

External read of README.md, ARCHITECTURE.md,
docs/findings/skill-eval-methodology-2026-05.md,
governance/governance.yaml.example, docs/decisions/0007-universal-rules-ship-enabled.md,
plus ground-truth verification against the repository tree and the public
`Mansour-ElCheikh/Reponav` repository. Remediation applied surgically
(docs-only, no engine/TS, no ARCHITECTURE.md change), then a full
CI-equivalent regression suite and the locked dual review
(brand-architect mechanical + positioning-architect substantive).

## Findings and remediation

| # | Finding | Severity | Remediation | Evidence |
|---|---|---|---|---|
| 1 | Headline "8% to 92%" cited `eval__harness/...lever-results.md`, a path present in NO public repo (verified absent from public Reponav tree); evidence not inspectable from the repo whose purpose is inspectable evidence | Blocker | Phantom path removed from all 5 tracked surfaces (README, NOTICE, provenance, scaffold_charter, wave4-self-bootstrap); replaced with truthful "RepoNav eval harness, sweep id, publishing to a dedicated public evals repo" | `git grep eval__harness\|eval-harness` = 0 occurrences |
| 2 | README led with the borrowed, unverifiable RepoNav number; scaffold's own certified result buried | Major | Lede reworked: the scaffold's own certified result (discrimination 42/42 + faithful harness 12/12; conformance 3/3) leads the evidence; RepoNav reframed as the case study | README "What this is" lede |
| 3 | Headline number conflated arm rate vs lift; no n; "pre-registered" unviewable | Major | Lede now "8% (1/12) baseline to 92-100% with deterministic context (three arms, n=12 each)", honest to the arm table; per-cell n + directional-not-powered caveat added to the case-study section | README case-study section |
| 4 | skill-eval writeup defensiveness (sermon open, "the traps are the interesting part", sales close); "recorded in session memory; this file is the public summary" advertised hidden evidence | Major | Three defensive tells removed; Reproduction section now forward-references the public evals repo instead of "session memory" | docs/findings/skill-eval-methodology-2026-05.md |
| 5 | ROADMAP criterion 1 + S6.4b status stale (said "NOT yet on main / awaits authorization"; in fact merged via #6-#8) | Major | ROADMAP staleness corrected; validity frontmatter added (the kit now dogfoods its own doc_validity rule); criteria annotated truthfully | ROADMAP.md |
| 6 | ADR-0007 cited a session-memory harvest not in the public tree | Minor | Cross-reference made honest about artifact location + pointed to the public account; ADR body left immutable (ADR convention) | docs/decisions/0007 cross-reference |
| 7 | Repo never named "agent-reliability engineering" though that is the hiring frame | Minor | One earned connective sentence added to "Why this exists" (positioned after the substantiating mechanics, not as an opening claim) | README "Why this exists" |
| 8 | ADR-0007 vs tree: "scaffold runs profile:team/strict on itself" but no committed governance.yaml | Re-scoped | Not a contradiction requiring a forced governance.yaml (which would risk real regression). The self-dogfood gap is already openly tracked as F1 OPEN in ROADMAP. Honest fix = the cross-ref correction in finding 6; F1 disclosure stands | ROADMAP F1 row |

The eval-evidence home was decided 2026-05-19: a dedicated public `evals`
repository (RepoNav L8 / scaffold skill-eval / TOON-promotion as
sub-evals, shared methodology spine) plus a thin in-tree breadcrumb at
`evals/README.md`. Per-repo eval branches were rejected (zero
discoverability, rot risk, no shared methodology spine). The flip waits
until that repo is published (criterion 7).

## Dual review (locked S6.4 pattern, re-run post-remediation)

- **brand-architect (mechanical/editorial): PASS.** Em-dash gate 0/0 on
  README + ARCHITECTURE; no phantom path survives; the three targeted
  defensive tells absent; locked tagline + elevator pitch intact; numbers
  internally consistent across all changed files.
- **positioning-architect (substantive): FAIL on first pass, then
  remediated.** Caught (a) a newly-introduced phantom citation in the gate
  block itself (this file, forward-referenced before creation) and (b) the
  lede number implying single-cell precision the arm table contradicts.
  Both fixed in this pass; re-gate recorded in the session.

## Locked-criteria score (post-remediation)

| # | Criterion | State |
|---|---|---|
| 1 | S6.3a/b + S6.4a/b merged to main | SATISFIED (#3-#8) |
| 2 | S6.4b dual review PASS on positioning | SATISFIED 2026-05-18 |
| 3 | License Apache-2.0 retained | SATISFIED |
| 4 | README + ARCHITECTURE clean vs brand-architect standing gates | SATISFIED (re-verified 2026-05-19; em-dash 0; dual review re-run) |
| 5 | At least one external review outside the regular chain | SATISFIED 2026-05-19 (this document) |
| 6 | CI green; no Mansour-specific paths; no RepoNav internal-only refs outside case-study | SATISFIED (full CI-equivalent suite green pre- and post-remediation; phantom path eliminated) |
| 7 | Dedicated public `evals` repository published (RepoNav L8 pre-registration + raw per-arm data independently reproducible) | **SATISFIED 2026-05-19**: `github.com/Mansour-ElCheikh/evals` flipped public; anonymous deep-link verification returned HTTP 200 on every surface the scaffold cites |

## Regression evidence

Baseline and post-remediation, identical: build 6/6; ADR structure 7/7;
em-dash README+ARCHITECTURE 0; RepoNav-product-ref scan clean; YAML/JSON
parse clean; anatomy 13/13; cursor/copilot/claude-code self-tests PASS;
engine vitest 21/21; engine audit smoke exit 1 (expected); scaffold
wrapper smoke PASS; all internal links resolve; ROADMAP now satisfies the
doc_validity predicate. Only the intended documentation files plus the new
`evals/` breadcrumb were modified.

## What unblocks the flip

Criterion 7 is **SATISFIED 2026-05-19**: `github.com/Mansour-ElCheikh/evals`
was flipped public, and anonymous deep-link probes returned HTTP 200 on
every surface the scaffold cites (repo root, `reponav-l8-correctness/`,
`RESULTS.md`, `fixtures/t6/RECONSTRUCTION.md`, `reponav-toon-promotion/`,
`METHODOLOGY.md`). The L8 pre-registration + per-arm/per-model results
(pinned to RepoNav `151eba50afcf7cb1fe517677415d51b26a94e6af` and model
snapshot `claude-haiku-4-5-20251001 / claude-sonnet-4-6 / claude-opus-4-7`)
and the `reponav-toon-promotion` sub-eval (pinned to its own distinct run
record) are independently reproducible.

What remains before the scaffold flip is **criterion 8 only** (added
2026-05-19): the scaffold's own full-history secret/PII/absolute-path scan
per [`conventions/public-flip-hygiene.md`](../../conventions/public-flip-hygiene.md).
Once that returns clean (or exposed material is surgically removed and
rotated), the scaffold flip is the user-authorized command:

```
gh repo edit Mansour-ElCheikh/agent-reliability-scaffold --visibility public
```

CI continues running on public PRs after the flip.
