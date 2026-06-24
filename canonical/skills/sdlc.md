---
spec_version: 1
status: active
name: sdlc
description: Full SDLC orchestrator. Reads the active epic's status and dispatches to the correct phase automatically. Use to resume from wherever the last session left off, or to start a new feature end-to-end.
purpose: |
  Most coding agents drift across phases — a session that should be "review the diff"
  ends up half-writing new tests. This skill keeps the work on rails: it inspects
  project state, identifies the active phase, and routes to the correct skill. It
  also captures tacit knowledge cheaply at each phase boundary and runs the full
  session-harvest once at session close, so a Build phase's lessons aren't lost
  without paying the full classify/write cost at every phase.

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

reads:
  - the project's plan-next context artefact (small status file describing current milestone, priorities, governance summary)
  - the project's last-session compact artefact (if present)
  - dev/epics/ directories (highest-numbered = active epic)
  - the active epic's epic.md (specifically the `**Status:**` line)

writes:
  - on one-shot bootstrap (`/sdlc "<prompt>"`): a new dev/epics/<NNN>-<slug>/ scaffold (epic.md, tasks.md, approaches.md), read-numbered from the target repo
  - updates to the active epic's epic.md Status line at phase transitions
  - phase-specific files via the skill it dispatches to (defer to that skill)
  - runs (does not write): the concurrency claim before an autonomous spawn, and `reliability-engine gate` at the ship boundary

invokes_skills: [plan-next, session-harvest]
invokes_agents: []

trigger_phrases:
  - "/sdlc"
  - "build this feature"
  - "start the SDLC"
  - "lets spec and build"
  - "resume the epic"
  - "continue where we left off"
---

# SDLC Orchestrator

Read the active epic's current status and dispatch to the correct phase automatically.
Three-phase flow: **Define → Build → Review**. Each phase stops at a user gate.

## Overview

Reads project state + the active epic's status and routes to the correct phase automatically. Each phase ends at a user gate; on continue, re-routes to the next phase. Captures tacit knowledge cheaply at each phase boundary and runs the full session-harvest once at session close (ADR-0006 capture/distill split) — knowledge is anchored before context decays without over-firing the full routine.

## When to Use

- At session start to resume in-flight work (`/sdlc` with no argument)
- To start a new feature end-to-end (`/sdlc "feature description"`)
- To target a specific epic by name (`/sdlc 001-streaming`)
- When you're unsure which phase the project is in — `sdlc` figures it out

**When NOT to use:**
- For 1-step ad-hoc work that doesn't need phases (just do it)
- When you know exactly which phase to run — invoke that phase's skill directly
- For exploratory spikes that may not ship — phase discipline is for committed work
- When governance has error-severity findings — fix those first; `sdlc` will surface the gate

## Invocation forms

```
/sdlc                            → resume active epic from current status
/sdlc "feature description"      → start a new epic from scratch
/sdlc 001-streaming              → target a specific epic by name
```

## Step 0 — Claim the run, then one-shot bootstrap a new task

**Claim the run (concurrency interlock).** Only when you are about to spawn an *autonomous* build-run (a new worktree or a second session): claim it against your project's concurrency interlock first and refuse to spawn on a breach. The kit ships the interlock *contract*, not a ledger — adopters wire their own (ADR-0012). The claim takes the task scope and exits non-zero on a breach —

    <your concurrency-claim command> --hard \
      --globs "<paths this task will touch>" --critical-path "<task name>"

A non-zero exit is a WIP-cap breach or a file-glob collision with a live session: do NOT spawn — surface the breach (Section 0: a machine spawn is hard-gated, unlike a human's). An ordinary interactive `/sdlc` is already claimed by the SessionStart hook, so skip this unless you are spawning. The claim releases automatically on harvest (the Stop hook).

**One-shot bootstrap (`/sdlc "<prompt>"` with no in-flight epic).** Scaffold the task by *reading the target repo* — never assume one project's layout:

1. List `dev/epics/` in the target repo; create it if absent (the repo is new to the SDLC convention).
2. `<NNN>` = highest existing epic number + 1 (3-digit); `<slug>` = a short kebab name from the prompt.
3. Read the repo's conventions / `governance.yaml` so the kit matches local shape.
4. Create, matching the shapes the `spec` skill uses:
   - `dev/epics/<NNN>-<slug>/epic.md` — `**Status:** Defining`, Problem + Goal from the prompt, an empty Acceptance Criteria list.
   - `dev/epics/<NNN>-<slug>/tasks.md` — the canonical header `| # | Spec | Task | TDD Behavior | Min-Invariant | Status |` (the Min-Invariant column is governed by `min_invariant_per_task`: a concrete fact, never a shape word like `array`/`defined`).
   - `dev/epics/<NNN>-<slug>/approaches.md` — empty; build-time pivots append here.

Then fall through to Steps 1–2; the new epic is `Defining`, so the routing table (ADR-0011) sends it to Define. This is the de-hardcoding: numbers and conventions come from the target repo, not a fixed spine.

## Step 1 — Read project state

Read the project's status artefacts (small enough to read every time):

1. The project's plan-next context artefact — current milestone, next priorities, governance summary (contract: `canonical/plan-next-stub.schema.md`; regenerated by `governance/plan-next-stub.refresher.example.mjs` or your own refresher)
2. The last-session compact artefact if maintained — sessionMeta.branch, knownConstraints, governanceFindings.errors

**Governance gate**: if `governanceFindings.errors > 0`, surface to user before starting:
`"{n} governance errors are active. Fix these first or confirm you want to proceed."`

**Plan-next gate**: if `/sdlc` was invoked with no argument AND no active in-flight epic is found in Step 2:
- Invoke the `plan-next` skill first to surface the recommended next feature
- Present recommendation and ask: "Proceed with this? Or specify a different feature."
- On confirmation, continue with `/sdlc "{confirmed feature description}"`
- Skip this gate if a feature description was provided directly or an active epic exists

## Step 2 — Find active epic

```
List dev/epics/ directories.
Find highest-numbered directory.
Read its epic.md → check **Status:** line.
```

**Route per the canonical Epic-status routing table** (`canonical/phases.md` §"Epic-status routing") — the single source of truth that `plan-next` also consumes (ADR-0011, closes F15). Read it, match the epic's `**Status:**` line, and run the phase it names. On `Shipped`, surface: "Epic {NNN} is shipped. Start next: `/sdlc 'feature description'`".

**Override rules (sdlc-specific; layered on top of the table, not a duplicate of it):**
- `/sdlc "description"` → run Step 0's one-shot bootstrap (new epic, number read from the target repo), which lands at `Defining` and routes to Define
- `/sdlc {epic-name}` → read that specific epic's status and route accordingly

## Step 3 — Load and execute the phase

Read the skill file for the determined phase, then execute its Steps:

| Phase | Skill |
|---|---|
| Define | `spec` skill (scales internally: 1-2 components → inline tasks.md; 3+ → per-component specs/. `define` was merged into `spec` per ADR-0006) |
| Build | `build` skill (RED→GREEN→REFACTOR runner; consumes the epic's task table. Project-specific build steps extend it; `refactor` handles controlled restructuring) |
| Review | `review` skill |

Use the host tool's read mechanism to load the skill file, then follow its Steps section against the active epic path.

## Step 4 — Gate and advance

Each phase ends with a user gate:
- **Define**: user approves epic + tasks → phase commits, SDLC waits
- **Build**: per-component commits happen automatically. Before the Build→Built transition, run the **ship gate** — `reliability-engine gate` (ADR-0013, `conventions/ship-gate.md`) — and do NOT advance on a non-zero exit. The gate runs the target repo's own tests + governance audit and blocks on red; this replaces self-verifying test output with a deterministic check.
- **Review**: run `reliability-engine gate` once more at the Built→Shipped boundary and ship only on a green gate. User approves ship → phase commits, then the **full** session-harvest fires once (Steps 1–5 — the batched distill, not a per-phase run) and releases the concurrency claim via the Stop hook.

On "continue", "next", or "proceed" after a phase completes:
Re-read the updated `epic.md` **Status:** and route to the next phase automatically.

## Harvest: cheap capture per phase, full distill once

The full `session-harvest` (classify → ROI-filter → write memory → refresh index → consolidate) is **too expensive to run at every phase** — at 3+ phases per epic it adds real latency and token cost on each gate (battle-test finding G3; ADR-0006 names the same "foreground friction"). Split it along ADR-0006's capture/distill seam:

- **Each intermediate phase (Define approved, Build committed) — CHEAP CAPTURE.** Jot 1–3 terse raw findings (a bug + its root cause, a tool config that worked, a surprise) as bullets in the phase-completion message, while context is hot. Do NOT classify, ROI-filter, write to `memory/`, or consolidate. Sub-minute; it just anchors what would otherwise decay.
- **At the Review→Shipped boundary (or session close) — FULL HARVEST, ONCE.** Run the `session-harvest` skill (Steps 1–5) over the whole session plus the jotted findings: classify, apply ROI > 2, write Layer-1/Layer-2 memory, refresh `MEMORY.md`.

**If the full harvest produces zero findings with ROI > 2:** skip silently — do not present an empty harvest.

> The fully-mechanised form of this split — a slim Stop-hook capture **anchor** writing to a queue + a scheduled off-hours **distill** — is ADR-0006, implementation deferred (gap 5). Until it lands, do the cheap capture inline (above); do not cite a queue file that does not yet exist.

## Agent routing

| Work | Runs in |
|---|---|
| Spec / Plan / Build / Review | Main session (always) |
| Codebase exploration mid-plan | Project-specific exploration capability, on demand |
| Adversarial review pre-merge | `reviewer-agent` (Tier 1 only; degrades to inline review checklist on Tier 2/3) |

## Governance integration

At every phase transition, if the project's governance audit shows new errors introduced by the current epic's work: pause and surface before advancing. Advisory warnings (e.g. seam hotspots) are informational — note them when the epic touches a flagged file, but they do not block SDLC.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "This is too small to need the full workflow" | If it touches a contract or public surface, run the workflow. Small-but-wrong is the most expensive class of bug. |
| "I'll gather context first, then run the skill" | The skill is context-gathering. Inverting the order skips the steps that would have told you what to gather. |
| "I know what to do — I'll skip the structured steps" | The structure exists because un-structured agents drift. Trust the rubric over recall. |
| "Verification is overkill for this change" | Verification is the cheapest layer. Skipping it is how regressions land. |

## Red Flags

- Skipping ahead to implementation without completing earlier phases.
- Marking a step "done" without producing the evidence the skill specifies.
- Treating workflow phases as optional based on perceived task size.
- Modifying acceptance criteria mid-flight to make the current state pass.
- Reaching for a free-form approach when the skill's structured workflow applies.

## Verification

After running this skill, confirm:

- [ ] Every step in the workflow produced the artifact or output the skill specifies.
- [ ] Acceptance criteria for the current phase are demonstrably met with evidence cited.
- [ ] Governance hooks fired without blocking, or blocks were root-cause-resolved.
- [ ] Downstream skills that consume this skill's output have what they need.
