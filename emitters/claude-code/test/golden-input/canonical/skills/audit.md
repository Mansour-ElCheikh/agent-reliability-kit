---
spec_version: 1
status: active
name: audit
description: Run a governance health check on the repository.
purpose: |
  Periodic audits surface drift that incremental review misses.
applicable_phases: [audit]
requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: not_needed
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed
  session_lifecycle_hooks:
    level: not_needed
reads:
  - governance.yaml
writes: []
invokes_skills: []
invokes_agents: []
trigger_phrases:
  - "/audit"
---

# Repo Governance Audit

Run a read-only governance audit and present findings clearly.

## Overview

Periodic, read-only governance health check. Test fixture for the cursor emitter — minimal body that conforms to ADR-0020 anatomy.

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
