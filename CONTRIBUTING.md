# Contributing

## Status

This is a v0.1.x curated single-maintainer project. Issues are welcome. PRs are reviewed at maintainer discretion. There is **no support SLA**. This is honest framing, not gate-keeping: the kit is small enough that consistent design discipline matters more than throughput right now.

If you want to use the scaffold in your own project, the path is to adopt it (see [ONBOARDING.md](ONBOARDING.md)), not to contribute upstream. If you want to extend it, read on.

## Reporting issues

Open a GitHub issue with:

- What you ran (exact commands).
- What you expected.
- What happened, with the relevant output captured. Pasted error messages or audit reports are worth more than prose.
- Your environment: Node version, pnpm version, OS, which agentic tool you targeted (Claude Code, Cursor, Copilot agent mode).

For anything security-shaped, see [SECURITY.md](SECURITY.md) instead.

## Proposing changes

The bar a PR has to clear:

1. **CI green.** The workflow at `.github/workflows/ci.yml` is the floor. Every gate must pass: build, ADR structure, em-dash discipline (README + ARCHITECTURE = 0 em-dashes), canonical frontmatter parse, anatomy gate (every canonical skill under 16KB warn / 32KB hard cap), shellcheck, all three emitter self-tests, the rules engine vitest, the engine audit smoke, the scaffold wrapper smoke.

2. **No drift on public surfaces.** README, ARCHITECTURE, ROADMAP, ADRs, and the gate5 verdict doc are the public credibility evidence. A change that creates inconsistency between them (stale citations, deleted-path references, new phantom-path style claims) blocks merge.

3. **Anchored to an existing artifact.** New universal governance rules require an ADR demonstrating consensus (per ADR-0007). New skills follow the canonical spec format (per ADR-0003) and pass the anatomy gate. New conventions go in `conventions/` and are referenced from the relevant skill or rule.

4. **Evidence in the PR description.** See `conventions/verification.md` for the principle. For a code change: the relevant test output. For an emitter change: golden-output diff. For a docs change: the cross-surface consistency check.

5. **Em-dash discipline on README + ARCHITECTURE.** CI greps for ` — ` (space-emdash-space) and fails on any match. Use commas, colons, parentheses, or semicolons. Other surfaces are not gated.

6. **No introduction of unverifiable claims.** Quantitative claims need a backing artifact in the public [evals](https://github.com/Mansour-ElCheikh/evals) repository. Methodological claims need a public writeup. "Trust me" does not ship.

## Development setup

See [ONBOARDING.md](ONBOARDING.md). Quick recap: `corepack enable && pnpm install --frozen-lockfile && pnpm run build`, then `pnpm -F @reliability-scaffold/engine test` for the engine self-test, and `bash emitters/<name>/test/run-test.sh` for the per-emitter golden tests.

## Commit and PR style

- Title format: `<scope>: <imperative summary>`. Scopes are typically `docs`, `engine`, `emitters`, `governance`, `conventions`, `canonical`. Examples from recent history: `docs: drop stale "evals private / criterion 7 remaining" references`, `conventions: tighten public-flip-hygiene to universal scan-gates-flip core`.
- PR descriptions should name what changed, why, and the verification you ran. The recent PRs in `git log --oneline` are the working examples.
- For non-trivial changes, include a sentence on what stayed untouched on purpose (the "minimum-narrow scope" discipline) so a reviewer can confirm there is no drift outside the stated intent.

## Decision-class changes

If the change shifts a design decision (rule severity ramps, new universal rules, new emitter, new layer), open an ADR in `docs/decisions/` following the template, and link it in the PR. The ADR is the durable artifact; the PR is the mechanism.

## What does not need a PR

Small typo fixes in docs are welcome via issue or PR, your call. Don't agonize over scope; the reviewer will close, merge, or ask. Issues that are questions rather than bug reports are fine too.
