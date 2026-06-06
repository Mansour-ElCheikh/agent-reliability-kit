<!--
GENERATED FROM: canonical/skills/audit.md
EMITTER: emitters/copilot (v1)
GENERATED AT: NORMALISED
DO NOT EDIT - changes will be overwritten on next emit.
To customise: copy this file to a different name and break the canonical link.
-->

# Repo Governance Audit

> **Trigger:** `/audit`

Run a read-only governance audit and present findings clearly.

## Overview

Periodic, read-only governance health check. Test fixture for the cursor emitter — minimal body that conforms to ADR-0036 anatomy.

## When to Use

- On a cadence to catch drift
- Before a release

**When NOT to use:**
- For per-file feedback (use review instead)

## Steps

### 1. Run the engine

Invoke the project's governance audit. Surface errors first, then warnings.

### 2. Suggest fixes for errors.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I just audited" | Audits are cheap; skipping accumulates drift. |

## Red Flags

- Auditing before tests are green.

## Verification

- [ ] Audit completed; findings recorded.
