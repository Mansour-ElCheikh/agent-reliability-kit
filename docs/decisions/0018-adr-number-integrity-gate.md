# ADR-0018: ADR numbers are enforced unique and title-consistent

**Status:** Accepted
**Date:** 2026-06-09
**Supersedes:** None

## Context

`docs/decisions/template.md` authoring rule #2 states "Never reuse numbers" — but nothing enforced it. On 2026-06-09 two branches in parallel each grabbed the next free number independently: `main` shipped `0012-one-shot-gated-orchestrator.md` while `feat/status-projection-authoring-side` carried `0012-authoring-side-status-projection.md`. Different slugs, so the merge produced **two ADR-0012s with no git conflict** — a silent collision caught by eye, not by the gate. The claim ledger guards worktrees and file globs, but not ADR-number allocation, and `scripts/check-anatomy.mjs` is the established precedent for a runnable structural gate.

## Decision

ADR-number integrity is a runnable gate, not prose. `scripts/check-adr-numbers.mjs` enforces, against `docs/decisions/`: (1) every `NNNN-*.md` filename number is unique, and (2) each ADR's `# ADR-NNNN:` title number matches its filename number (catching a half-finished renumber where the file is renamed but the title is not). It runs in CI (`.github/workflows/ci.yml`) and locally via `pnpm check:adr`, mirroring the anatomy gate. A non-tautological test (`scripts/check-adr-numbers.test.mjs`, `node --test`) proves it RED on the 0012 collision and GREEN on a clean tree.

## Consequences

For the next contributor: a reused or title-mismatched ADR number now fails CI instead of merging silently, and the template's rule #2 becomes load-bearing rather than advisory. Future ADRs inherit a hard uniqueness constraint.

Prevents: the silent duplicate-number merge (the 0012 case) and a half-done renumber (file renamed, title stale). Permits: it does **not** flag a *gap* in numbering (0001, 0002, 0004 is allowed — retired numbers stay retired per template rule #2), and it does not validate ADR-number references embedded in code or CI comments.

## What this ADR does *not* do

It checks only this repo's own `docs/decisions/` filenames and titles. It does not reconcile cross-project ADR references (some code/CI comments cite other projects' ADR namespaces, e.g. RepoNav's), and it does not enforce sequential or gapless numbering.

## Cross-reference

- Resolves the unenforced authoring rule #2 in `docs/decisions/template.md`.
- Precedent: the anatomy gate (`scripts/check-anatomy.mjs`).
- Affected: `scripts/check-adr-numbers.mjs`, `scripts/check-adr-numbers.test.mjs`, `.github/workflows/ci.yml`, root `package.json`.
- Evidence: the 2026-06-09 duplicate ADR-0012 reconciliation (the status-projection ADR renumbered to 0017).
