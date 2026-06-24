---
spec_version: 1
status: active
name: sdlc
description: Full SDLC orchestrator.
purpose: |
  Most coding agents drift across phases. This skill keeps work on rails.
applicable_phases: [cross-phase]
requires:
  llm_inline_invocation:
    level: required
    degrades_to: glob_applied_rule
  filesystem_writes:
    level: required
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed
  session_lifecycle_hooks:
    level: preferred
    degrades_to: manual_invocation
reads: []
writes: []
invokes_skills: [plan-next, session-harvest]
invokes_agents: []
trigger_phrases:
  - "/sdlc"
---

# SDLC Orchestrator

Read the active epic's status and dispatch.

## Overview

Routes work to the right phase based on epic status. Test fixture — minimal body conforming to ADR-0020 anatomy.

## When to Use

- At session start to resume work
- /sdlc "feature" to start fresh

**When NOT to use:**
- For 1-step ad-hoc work
- When you know the exact phase to invoke

## Step 1

Read project state.

## Step 2

Find active epic.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "Too small for full workflow" | Small-but-wrong is the most expensive class of bug. |

## Red Flags

- Skipping ahead without phase gates.

## Verification

- [ ] All steps produced their artifacts.
