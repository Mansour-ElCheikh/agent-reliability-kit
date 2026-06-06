# Repository documentation: tiered guideline

This guideline names the documentation surfaces an agent-reliability-grade public repository tends to carry, and the minimum non-empty content each typically has. It is normative for this repository and offered as a reference for adopters who want the same documentation rigour. Enforcement is via the count-reconciliation gate (`scripts/check-counts.mjs`, ADR-0016) + the `doc_validity` predicate for dated docs, backed by manual review at PR time; deeper automation (a `docs_completeness` predicate, a docs-architect subagent) is uncommitted pending evidence of friction in flight.

## Three tiers

### Tier 1: universal public-repo hygiene (every serious OSS repo)

| File | Minimum content |
|---|---|
| `README.md` | Value-prop lede, concrete use case, one schema / config example, "what this is not" framing, links to ARCHITECTURE / ROADMAP / ONBOARDING |
| `LICENSE` | An OSI-approved licence file with a stable identifier (e.g. Apache-2.0) |
| `NOTICE` | Provenance + attribution for derived work (when applicable); third-party dependency surface; the exact runtime-scope claim |
| `CONTRIBUTING.md` | Status (maintainer-discretion vs open contributions); how to report issues; PR review criteria; dev setup link |
| `SECURITY.md` | Reporting channel; supported versions; SLA framing |
| `CHANGELOG.md` | [Keep a Changelog](https://keepachangelog.com/) format; one `[Unreleased]` section + dated past versions |

### Tier 2: engineering rigour (any repo with non-trivial design + a roadmap)

| File | Minimum content |
|---|---|
| `ARCHITECTURE.md` | Diagram(s) showing system shape + data flow; per-layer responsibilities; non-goals |
| `ROADMAP.md` | Forward-looking only; `validity` / `as_of` / `expires_after_days` frontmatter (enforced by `doc_validity`) |
| `ONBOARDING.md` | Verified 15-minute walkthrough from clone to a concrete observable outcome |
| `docs/decisions/NNNN-*.md` (ADRs) | One ADR per non-trivial design decision; immutable bodies; explicit supersession chain |
| `conventions/` | Normative practices that compose with skills; each names its principle once and the failure mode it prevents |

### Tier 3: agentic-coding-specific (any repo with agentic discipline)

| Surface | Minimum content |
|---|---|
| `canonical/skills/` + `canonical/agents/` | Tool-agnostic source-of-truth specs; one file per skill / subagent; frontmatter declares capability requirements + degradation paths |
| `governance/governance.yaml.example` | A rule contract example with the Universal Default Set + project-specific shape; profile model documented |
| Evidence repository / `evals/` breadcrumb | Pre-registrations + raw per-arm / per-cell data for every quantitative claim made on public surfaces |
| `docs/findings/` (public findings only) | Methodology writeups, measurement-trap accounts, open friction tracking; internal-process records (sprint design reviews, scoping audits) stay out of the public tree |
| `examples/` | At least one worked adopter customization with captured engine output |

## Cross-cutting rules

1. **No phantom paths.** Every cited path or link in any public surface should resolve to an actual file or URL.

2. **Numeric claims match runtime reality.** Every count claimed in narrative (e.g. "12 skills", "11 predicates") should equal what `ls | wc -l`, `grep -c`, or the equivalent runtime probe returns. Enforced for this repo's top-level public surfaces (README, ARCHITECTURE, ROADMAP) by the count-reconciliation gate (`scripts/check-counts.mjs`, ADR-0016); offered to adopters as a reference check.

3. **Validity frontmatter on dated docs.** Anything claiming "as of X" or "current" carries `validity` + `as_of` + `expires_after_days` (or `expires`) in frontmatter. The `doc_validity` predicate enforces this for planning / decision docs, and (ADR-0016) computes expiry from `as_of` + `expires_after_days` (or an explicit `expires`), emitting an advisory `warn` once a doc is past its window.

4. **No internal-process records on public surfaces.** Sprint design reviews, internal scoping audits, hand-traces, and execution-lock specs stay out of the public tree. Their substance, where worth preserving publicly, is extracted into a comparative analysis or methodology writeup before removal.

5. **Em-dash discipline on top-level public surfaces** (this repo's specific): `README.md` and `ARCHITECTURE.md` carry zero space-em-dash-space patterns. Other surfaces are not gated; the discipline is positional.

## Cross-reference

- [ADR-0001](../docs/decisions/0001-scaffold-charter.md): scaffold charter; sets the "what ships / what does not" boundary this guideline extends to the documentation surface
- [ADR-0007](../docs/decisions/0007-universal-rules-ship-enabled.md): Universal Default Set governance; this guideline is its documentation analog
- [`conventions/verification.md`](./verification.md): the verification-by-evidence principle this guideline operationalises at the doc layer
- [`conventions/public-flip-hygiene.md`](./public-flip-hygiene.md): the release-gate counterpart for the privacy / scrub axis
