# gate --json output

**Status:** Shipped
**Date:** 2026-06-07

## Problem
`reliability-engine gate` prints a human report but no machine-readable output, so CI cannot
branch on *which* checks failed without scraping text.

## Goal
A `--json` flag emits the GateReport as JSON (`{ blocked, checks: [{ name, ok, detail }] }`)
so CI can read the structured result. Exit-code behaviour is unchanged.

## Acceptance Criteria
- [ ] `renderGateReportJson(report)` returns a string that `JSON.parse`-es to `{blocked, checks}`.
- [ ] A blocked report serialises `blocked: true` and includes the red check by name.

## Dependencies
- ADR-0013 (the gate). This adds an output mode; it introduces no new check.

> Bootstrapped by `/sdlc` Step 0 on 2026-06-07 as the autonomy-capstone dry-run: the kit had
> no `dev/epics/`, so the orchestrator created it and read the next number as 001.
