# ADR-0012: Ship tool-neutral git-workflow and testing conventions; R22 already-covered, DB-safety guard as principle

**Status:** Accepted
**Date:** 2026-06-04
**Supersedes:** None

## Context

A git + testing triangulation across three of one engineer's repositories — a
TypeScript code-analyser (custom rule engine, squash-PR trunk), a Python data
pipeline (ff-only trunk, an incident-driven four-layer DB-wipe guard), and this
kit itself (squash-PR trunk, an 11-predicate rules engine) — read each repo's
git and testing conventions as six structured cells, then synthesised and
adversarially checked them. It surfaced two gaps in the kit's published
convention surface.

**Gap 1 — no git-workflow convention.** The kit ships `conventions/` covering
public-flip hygiene, repo documentation, test layers, verification, memory, and
session-harvest, but no git-workflow convention, even though all three repos
practise a recognisable common core: trunk-is-sacred; scoped branch names; a
linear trunk history (zero merge commits, by ff-only *or* squash); conventional
commit subjects with a why-body; worktree-per-stream with cleanup-on-land; atomic
code-plus-status landings; semantic-conflict reconciliation before landing
parallel work; a test gate guarding the trunk; append-only history (rewrite only
for harmful content); and a Co-Authored-By trailer on agent commits. The pipeline
repo's `git-workflow.md` is the most battle-tested instance (hard rules with
incident citations; zero merge commits across its full history) and also the most
stack-coupled — it names a specific deploy provider, a CI provider, an agent
tool, and that workspace's area map.

**Gap 2 — two source-repo testing artifacts with no kit decision.** The
analyser's R22 (a machine-readable `testing-manifest.json` must exist, be
complete, and every declared command must map to a runnable script; battle level
`daily_use`) and the pipeline's four-layer DB-wipe guard (battle level
`incident_driven`, one 2026-05-21 production-wipe). Both are real; neither had a
recorded port decision. The kit already ships Min-Invariant (`test_invariants` +
`min_invariant_per_task`, ADR-0010) and the manifest-placement predicate
(`test_file_in_manifest_directory`), so any decision must account for overlap.

Two constraints are non-negotiable. **ADR-0007** fixes that the kit *composes
with* a team's git / PR / sprint process and does not impose a commit, branch, or
wave workflow, and that a rule ships enabled only if it is consensus hygiene, not
one project's opinion. **ADR-0001** guards against shipping one project's rules as
if universal. Both bear on form: the git-workflow convention must be an adoptable
menu, not a mandate, and a candidate that encodes one stack's mechanism must not
ship as a predicate.

The adversarial check also caught a live over-claim worth recording: the kit's
test-file predicates were welded to the JS/TS `.test.<ext>` idiom, so the
manifest-placement and Min-Invariant predicates did **not** cover a pytest
adopter. That mechanization gap is fixed in its own engine decision, ADR-0013;
this ADR records the convention decisions and relies on ADR-0013 for the
recognition mechanism.

## Decision

**Ship `conventions/git-workflow.md` and `conventions/testing.md` as
tool-neutral, team-neutral conventions. Record R22 as already-covered (no new
artifact). Record the four-layer DB-wipe guard as convention-only — its principle
joins the testing convention; its mechanism does not ship as a predicate.**

The triangulation's pre-registered rule: a practice earns a section only if it is
observed in at least two of the three repos OR is clearly universal hygiene, and
it is stated without naming any tool, agent, CI/deploy provider, or one repo's
stack. Resolved against the readings:

1. **`conventions/git-workflow.md` ships** as a ten-section menu, each section
   carrying a one-phrase battle-tested provenance note (and the file states up
   front that it is a menu honouring the ADR-0007 composes-not-impose contract,
   and that git workflow is a convention layer the engine does not enforce beyond
   `scope_containment` and the opt-in commit-provenance shapes).

2. **`conventions/test-layers.md` becomes `conventions/testing.md`**, expanded
   into the kit's complete testing convention, stated entirely as
   framework-agnostic principles: manifest-driven recognition + placement (§1);
   the white-box / black-box / static taxonomy (§2); a concrete-invariant
   (Min-Invariant) requirement (§3); a destructive-test safety principle (§4); and
   surface→minimum-layer composition (§5). The vitest/TypeScript-specific examples
   and a dangling `ADR-0036` reference (a leaked analyser-repo number) are removed.

3. **R22 → already-covered, no new artifact.** The testing-manifest-as-contract
   pattern already ships as `conventions/testing-manifest.json.example` +
   `conventions/testing.md` + the `test_file_in_manifest_directory` predicate
   (which the engine's own fixture runs at error severity). R22's increment over
   the kit is a Node/npm-specific completeness audit the kit deliberately dropped.
   Its one genuinely portable slice — verifying every declared manifest command
   resolves to something runnable — is logged as a future enhancement, not built
   here. The predicate's recognition is made stack-neutral by ADR-0013, so
   "already-covered" now holds for a pytest adopter too, not only JS/TS.

4. **Four-layer DB-wipe guard → convention-only.** It is the most severe-outcome
   artifact in the readings but `incident_driven` (one repo, one incident) and the
   least tool-neutral (every layer is welded to a Postgres/psycopg stack), and it
   is runtime fixture behaviour an engine predicate cannot read from a diff. Its
   *principle* is portable and lands in `testing.md` §4 — physical isolation, a
   fail-fast refusal on production-pointed config, assert-the-target-before-the-
   destructive-op — with the mechanism left to the adopter. No predicate ships.

## Consequences

**For the next contributor:** the kit has a published git-workflow convention and
a complete, framework-neutral testing convention to cite instead of reinventing,
both honestly scoped — a team adopts the sections that earn their place and keeps
its own coordination process (ADR-0007). The testing convention carries a
safety-guard principle drawn from a real production incident, stated without
imposing a database stack.

**Prevents** the situation where these practices were documented only in one
private repo's rules file and nowhere in the kit: the kit now has a citable
convention. (It does **not** mechanically prevent the drift — git workflow stays a
convention layer per ADR-0007.) It also closes the two careless-port failure
modes: shipping R22's Node coupling, or shipping one project's incident response
as if it were consensus hygiene (the ADR-0001 guard, one level harder for the DB
guard).

**Permits (the cost):** a git-workflow convention that is not mechanically
enforced. The mitigation is deliberate — the narrow enforceable slices already
have homes (`scope_containment`, the opt-in commit-provenance shapes) — and the
convention takes on a maintenance duty: it tracks what is *practised*, so a
section is demoted if it stops being observed in two repos. The DB-safety
principle ships as prose an adopter could read and not implement; the kit accepts
that, because a predicate would be either stack-specific or unenforceable from a
diff.

## What this ADR does *not* do

- Does **not** add any git-workflow rule to the engine or to the Universal
  Default Set. Git workflow stays a convention; no new predicate ships.
- Does **not** ship a fifth testing predicate. The engine change that makes the
  existing test-file predicates multi-framework is recorded separately in
  ADR-0013, which modifies the existing three and adds none (the registry stays
  at eleven).
- Does **not** re-port R22 (already covered) or the DB-wipe guard mechanism.
- Does **not** mandate ff-only over squash, or vice versa. The convention fixes
  the *linear-history* invariant (zero merge commits) and names both routes; the
  choice is the adopter's.
- Does **not** prescribe a coverage number, a test runner, or a branch-area map.
- Does **not** touch the SDLC loop, the non-test engine predicates, the evals, or
  branding.

## Cross-reference

- ADR-0007 (composes-not-impose; the consensus-hygiene bar) — the governing
  constraint on form.
- ADR-0001 (charter anti-"renamed-project" guard) — why the DB guard ships as
  principle, not predicate.
- ADR-0010 (Min-Invariant re-bind) — the already-shipped testing predicates this
  ADR must not duplicate.
- ADR-0013 (manifest-driven testing predicates) — the engine change that makes
  the testing convention's framework-neutral claim true.
- `conventions/git-workflow.md`, `conventions/testing.md` (the conventions this
  ADR ships); `conventions/testing-manifest.json.example` (the manifest contract).
- `conventions/public-flip-hygiene.md` — the history-rewrite / scan discipline the
  git-workflow §9 references.
- Triangulation source readings: the pipeline repo's `.claude/rules/git-workflow.md`,
  the analyser repo's `.reponav/testing-manifest.json` + R22, and the pipeline
  repo's `jobs/tests/_env_guard.py` + `conftest.py` (the four-layer guard whose
  principle is lifted).
