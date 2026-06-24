# Tasks — gate --json output

**Status:** Approved

## Component 001 — gate JSON output

**What:** a pure `renderGateReportJson(report)` serialiser plus a `--json` flag on
`reliability-engine gate` that prints it. The serialiser is unit-tested; the flag is thin wiring.

**Acceptance Criteria:**
- [ ] `renderGateReportJson` round-trips the report through JSON.
- [ ] A blocked report serialises with `blocked: true` and the red check present.

**Out of scope:** changing what the gate checks (ADR-0013); only an output mode is added.

| # | Spec | Task | TDD Behavior | Min-Invariant | Status |
|---|---|---|---|---|---|
| 1 | 001 | renderGateReportJson serialises the report | given a blocked report whose red check is `test:unit` when renderGateReportJson is called then the parsed JSON reports the block and that red check | `JSON.parse(out).blocked === true && JSON.parse(out).checks.find(c=>!c.ok).name === 'test:unit'` | Done |
