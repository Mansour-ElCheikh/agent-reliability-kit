# Git workflow: linear history, scoped branches, clean reconcile

This convention names the git practices that recur across the engineer's
repositories and that are stack-neutral enough to adopt anywhere. It is a
**menu of conventions, not a mandate.** Per ADR-0007 the kit composes with
a team's existing git / PR / sprint process and does **not** impose a
commit, branch, or wave workflow. Adopt the sections that earn their place;
each names the principle once, the failure mode it prevents, and one phrase
of battle-tested provenance so it can be cited rather than reinvented.

Nothing here is mechanically enforced by the engine. Git workflow is a
convention layer: the closest governed neighbours are `scope_containment`
(commits touching protected paths without an ADR) and the opt-in
`roadmap_first` / `adr_on_decision` shapes (checks
`roadmap_reference_in_commit_message` / `decision_keyword_without_adr`) in
`governance.yaml.example`. The discipline below is what an agent or a
reviewer applies; the predicates are the backstop for the narrow slices that
can be checked from a diff.

---

## 1. Trunk is sacred; feature work lives on a branch

**Never commit directly to the trunk (`main`) from any checkout or
worktree. Make a branch first.** A checkout that defaults to the trunk is
the easiest place to commit by reflex; that reflex is the failure. Every
change — including a one-line doc fix — starts on a named branch.

*Provenance:* practised in all three repos (a hard rule in the
incident-bearing pipeline repo; squash-PR-only into trunk in the other two).

## 2. Branch naming: `<type-or-area>/<topic-kebab>`

**Branch names carry a scope signal: a lowercase type or area prefix, a
slash, then a kebab-case topic.** The recurring prefix vocabulary is
`feat/`, `fix/`, `chore/`, `refactor/`, `docs/` (plus repo-local additions
such as an `audit/` or area prefix). The point is not the exact list but
that the prefix tells a reviewer, and a cleanup pass, what the branch is
*for*. Auto-generated session branches (e.g. an adjective-name a tool
assigns) carry no scope signal and must be **renamed to a meaningful
`<type>/<topic>` before they survive a cleanup pass or open for review**.

*Provenance:* a prefixed-branch pattern is practised in all three repos
(and locally gated by a pre-commit check in the pipeline repo); the
auto-session-branch rename is practised where an agent opens worktrees
automatically.

## 3. Linear history: no merge commits on the trunk

**The trunk keeps a linear history. Land work by squash-merge *or* by
fast-forward-only merge, never by a plain or `--no-ff` merge.** Both routes
keep `git log --first-parent` readable and `git bisect` honest; which one a
project picks is a local choice (a derived-public-artifact repo squashes
one commit per change; a solo internal repo fast-forwards). The shared
invariant is **zero merge commits on the trunk**.

The `--ff-only` flag is load-bearing on the fast-forward route: it *refuses*
when the feature branch is not a direct descendant of the trunk, so a stale
branch surfaces as a failure instead of a silent merge. If it refuses,
rebase the branch onto the trunk and retry — do not reach for `--no-ff`.

*Provenance:* the pipeline repo has zero merge commits across its full
history (ff-only practised, not aspirational); the other two land every
change as a single squash commit (also zero merge commits).

## 4. Conventional commit messages; the body explains *why*

**Commit subjects follow `<type>(<scope>): <subject>`** with an imperative,
period-less subject. The recurring type set is `feat, fix, docs, chore,
test, refactor`; scope is the area or module touched. The **body explains
why**, not what (the diff already says what). Optional trailing tags carry
a milestone or batch reference (e.g. a wave or milestone id) so
`git log --grep` can reconstruct a unit of work after the fact. Reference a
decision record as `ADR-NNNN` or a roadmap item explicitly when one drove
the change.

*Provenance:* conventional-commit conformance is near-total in all three
repos (one repo: 100% of the last 100; another: 164 of 165 commits).

## 5. Atomic landings: code and its status update ship together

**A change and the document state it invalidates land in the same commit,
or as adjacent commits in the same landing.** When a roadmap row, a status
table, or a changelog entry describes work that a commit completes, update
it in that commit. The failure this prevents is the silent drift where the
code shipped but the doc still reads "pending" — a contradiction a textual
merge will never catch (see §7).

*Provenance:* practised in two repos (a reviewer-agent rule lifted between
them; observed as paired `docs(...)` + `feat(...)` commits for the same
milestone).

## 6. Worktree-per-stream, and cleanup is part of landing

**Concurrent streams of work each get their own worktree; removing the
worktree and deleting the branch is part of landing, not a separate
chore.** A merged branch whose worktree lingers wastes space and obscures
what is actually in flight. Run a survey (`git worktree list` +
`git branch -vv`) at the start of a multi-session stretch; if stale
worktrees have accumulated, clear the merged ones before opening new work.

`git branch -d` (lowercase) refuses to delete unmerged work and is safe by
default; reserve `-D` for branches you have confirmed are genuinely
abandoned. `git worktree remove` refuses a worktree with uncommitted
changes; check `git -C <path> status` before forcing.

*Provenance:* the worktree-per-stream model is practised in all three
repos; the cleanup-on-land discipline is an explicit hard rule in two.

## 7. Reconcile *intent* before landing parallel work

**A clean fast-forward or squash proves textual non-conflict; it does not
prove semantic agreement.** Two branches can touch different lines — or
different files — and still leave the trunk self-contradictory: one tightens
a gate another loosened; two restate the same locked decision in different
words; a doc says "pending" while the code already shipped (§5). Before
landing a change to a **shared-intent surface** (a locked decision, a
project hard rule, a roadmap milestone, a load-bearing gate, or any file a
parallel session may be editing):

1. **Survey parallel work first.** Anything ahead of the trunk or with a
   dirty worktree is unmerged progress: reconcile it, never delete it.
2. **Read the other version and ask whether yours contradicts its intent.**
   If so, reconcile to one canonical version with a human before either
   side lands.
3. **After you land, a parallel session still holding an edit to the same
   surface rebases and *drops* the now-duplicate edit** rather than
   re-applying it.

*Provenance:* codified as an explicit rule in the pipeline repo after a
2026-06-02 case where a re-scope had already landed; the cherry-pick-only
reconcile discipline in the analyser repo is the same principle on the
parallel-stream axis (reconcile by explicit approved commits, never by a
broad merge).

## 8. A test gate guards the trunk

**No change merges to the trunk until its test command passes.** A new
module or a bug fix that lands without a corresponding test does not merge.
The authoritative gate is the local test run; an automated re-run of the
same gate outside the author's machine — continuous integration, a
pre-receive hook, or a reviewer's checkout — is the safety net for the case
where local was skipped or the local environment diverged. The exact runner
and command live in the project's testing manifest, not here (see
`conventions/testing.md` and `testing-manifest.json.example`); this
convention only fixes that *a* green gate is a precondition for landing.

*Provenance:* a blocking pre-merge test gate runs in all three repos
(coverage-checked unit run; full DB suite; engine self-test + audit smoke).

## 9. History is append-only; rewrites are for harmful content only

**Published history is not rewritten for aesthetics, to hide a mistake, or
to tidy a messy branch.** The one justification for a history rewrite is the
surgical removal of genuinely harmful content (a committed secret, PII)
discovered before or at a visibility change — and that path is
*excise-plus-rotate*, never *squash-to-hide*. A decision record is
superseded by a new record, not by editing the old one; the chronology
stays intact. Force-pushing is permitted only on a feature branch and only
with `--force-with-lease`, never to the trunk.

*Provenance:* the no-rewrite-except-harmful-content rule and the
pre-visibility-change full-history scan are written conventions in the kit
(`public-flip-hygiene.md`) and the analyser repo; record-immutability is a
governed write-time rule in the analyser repo and an authoring rule here.

## 10. Attribute agent-assisted commits

**Commits produced with agent assistance carry a `Co-Authored-By:` trailer
naming the assisting tool or model.** This attributes the assistance without
obscuring human responsibility for the change, and keeps the authorship
signal honest when a reviewer later reads the log. The kit prescribes the
*practice*, not which assistant — name whichever one you used.

*Provenance:* a consistent practice in all three repos (one carries the
trailer on every recent agent commit; the others on a large share of the
log).

---

## When you are tempted to skip it

| "..." | Reality |
|---|---|
| "It's a one-line fix, I'll just commit on the trunk" | One-line fixes on the trunk are how the trunk breaks. §1 has no size exemption; the branch costs five seconds. |
| "A merge commit is fine, the diff is clean" | A clean diff is textual; §3 is about a readable first-parent log and an honest bisect. Rebase and fast-forward, or squash. |
| "Both branches merged cleanly, so we're consistent" | Textual non-conflict is not semantic agreement (§7). Survey parallel intent on shared-intent surfaces before landing. |
| "I'll update the roadmap in a follow-up commit" | The window between the two commits is a trunk that contradicts itself (§5). Land them together. |
| "Found a secret in history — I'll squash it away" | Squashing is not removal and not rotation (§9). Excise the blob *and* rotate the secret at its source. |
| "The worktree is harmless, I'll clean it up later" | Stale worktrees obscure what is in flight (§6). Cleanup is part of landing, not a someday chore. |

## How this composes with the rest of the kit

- **`conventions/testing.md` + `testing-manifest.json.example`** — §8's
  test gate; the manifest declares the runner and command this convention
  deliberately leaves unspecified.
- **`conventions/public-flip-hygiene.md`** — §9's history discipline on the
  visibility-change axis (scan, excise-plus-rotate, never squash-to-hide).
- **`conventions/repo-documentation.md`** — record-immutability and the
  decision-record surface §9 references.
- **`governance/governance.yaml.example`** — the opt-in `roadmap_first` and
  `adr_on_decision` shapes (checks `roadmap_reference_in_commit_message` and
  `decision_keyword_without_adr`) are the mechanical backstop for the §4/§5
  provenance discipline, shipped disabled because they encode one project's
  convention (ADR-0001 guard).
- **ADR-0007** — the composes-not-impose contract this whole convention
  honours: teams keep their own coordination process; this is the adoptable
  shape, not a required workflow.

## When this file should change

- A practice here stops being observed in at least two repositories (drop or
  demote it — this convention tracks what is actually practised).
- A new stack-neutral git practice reaches two-repo adoption (add it with its
  provenance phrase).
- The kit decides to mechanically enforce a slice that is convention-only
  today (move that slice to `governance.yaml.example` and cite the rule id
  here).
