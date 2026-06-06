---
spec_version: 1
status: active
name: session-harvest
description: Synthesise knowledge from the current session and generate the highest-ROI durable artifacts. Use at the END of any session where meaningful things were learned, debugged, configured, or decided.
purpose: |
  Most sessions end with three kinds of value produced: (1) work product
  (already durable in commits), (2) tacit knowledge (bugs hit, root causes,
  patterns confirmed, tool configs that actually work — easily lost), and
  (3) workflow improvements (skill gaps, agent roles that emerged). This
  skill captures categories 2 and 3 so the next session inherits the lesson
  instead of re-learning it.

applicable_phases: [session-close]

requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: required
  session_lifecycle_hooks:
    level: preferred
    degrades_to: manual_invocation
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed

reads:
  - git log since last harvest (commits, file change surface)
  - current conversation context (what was asked, debugged, what failed first, what the fix was)
  - session-event log if the project emits one (schema: canonical/session-event-log.schema.md)
  - hook log (last entries; any BLOCKED events)
  - existing memory/ index + entries (to avoid duplicates)

writes:
  - memory/ entries with new findings (one file per topic; type frontmatter)
  - memory/MEMORY.md index updates
  - draft new skill / agent files (presented to user; not auto-committed)
  - draft ADR triggers (presented to user for /adr invocation)

invokes_skills: []
invokes_agents: []

trigger_phrases:
  - "/session-harvest"
  - "what did we learn today"
  - "harvest this session"
  - "document the learnings"
  - "what should we save"
  - "end of session"
  - "turn this into a memory"
---

# Session Harvest

Extract the highest-ROI knowledge from the current session, write it to durable storage, and recommend new skills/agents/external integrations to create.

## Overview

At session end, synthesize tacit knowledge (bug patterns, tool configs, workflow improvements) from the session and write it to durable storage. Drafts new skills/agents/ADR triggers for user review. Fires automatically at phase boundaries inside `/sdlc` so knowledge is captured before context decays.

## When to Use

- End of any meaningful session where something was learned, debugged, configured, or decided
- After `/sdlc` completes a phase (auto-fires inline)
- Before context resets, compaction, or session close
- When you hit a non-obvious bug + fixed it (the fix is in commit; the lesson lives nowhere yet)

**When NOT to use:**
- After purely mechanical sessions (rename file, fix typo, no insights to capture)
- Mid-session — timing matters; context decay starts after session end
- When findings would be ROI < 2 (reused <2 times AND wouldn't cause >30min confusion if forgotten)

## Why this skill exists

Every session produces three kinds of value:
1. **Work product** — commits, files changed (already durable)
2. **Tacit knowledge** — bugs hit, root causes, patterns confirmed, tool configs that actually work
3. **Workflow improvements** — new processes, skill gaps, agent roles that emerged from the work

Only the first survives automatically. This skill captures 2 and 3.

---

## Step 1 — Scan the session

Read the following (in order, stop when you have enough context):

```bash
# What changed this session
git log --oneline --since="8 hours ago"

# File-level change surface
git diff --stat HEAD~$(git log --oneline --since="8 hours ago" | wc -l | tr -d ' ')
```

Also review:
- The current conversation context (what was asked, what was debugged, what failed first, what the fix was). The conversation transcript is available in your host tool.
- Your session-event log if your project emits one (JSONL per `canonical/session-event-log.schema.md`; a worked-example writer to emit one ships at `governance/session-events.writer.example.mjs`) — which skills fired, their `outcome`, and `context_kb` cost. Absent log = fall back to git log + transcript; the log is an optimisation, never required.
- Your hook log — last 20 lines (any BLOCKED events)
- The project's roadmap vs reality: do its stated statuses + "next" items still match actual epic statuses (`dev/epics/*/epic.md`) and recent commits? Drift is a `roadmap-staleness` finding. This folds in what a separate `update-plan` skill would do, at the moment context is freshest (ADR-0011).

### Definition of Done for Step 1

Before proceeding to Step 2, verify you can answer ALL of these:
- [ ] How many commits were made this session?
- [ ] Which skills/phases fired (from your session-event log, if you maintain one)?
- [ ] Were any governance hooks BLOCKED? If so, which rule and file?
- [ ] What was the primary goal of the session?
- [ ] Did anything fail before it worked? (This is where tacit knowledge lives)

### Tool-surface coverage check

Check for silent failures across tool surfaces:

| Surface | What can fail silently | Check |
|---|---|---|
| Subagent invocation | Tier 2/3 tools may have no subagent; degraded inline review didn't trigger | Verify the inline review checklist ran |
| Analyser MCP/CLI | Server not running; CLI silently returned no output | Check if calls returned data or empty |
| Hook intercept | Tier 2/3 fallback to commit-time gate; you may have missed write-time signals | Check commit hooks fired |

Classify any silent failure as a `tool-config` finding.

---

## Step 2 — Classify findings

For each insight from the session, assign a category + destination:

| Category | What it is | Destination |
|---|---|---|
| `bug-pattern` | A specific failure mode + root cause + fix | `memory/feedback_<topic>.md` or `memory/preferences.md` |
| `tool-config` | A tool/API behavior that isn't obvious from docs | `memory/preferences.md` |
| `cross-project-pattern` | A workflow pattern reusable beyond this repo | A shared / cross-project store if the setup has one (a team-shared store or the agent's global memory); otherwise note it for promotion. Never silo it in this repo's per-project `memory/`. |
| `repo-pattern` | A codebase-specific pattern or convention | `memory/repo/<project>.md` |
| `new-skill` | A repeatable multi-step workflow that emerged | Draft as `canonical/skills/<name>.md` |
| `new-agent` | An adversarial reviewer or isolated build role | Draft as `canonical/agents/<name>.md` |
| `new-integration` | An external system whose integration would reduce manual steps | Note only — flag for user decision |
| `adr-trigger` | An architectural decision that was made but not recorded | Trigger ADR authoring |
| `context-growth` | A skill/pattern consuming too much context per invocation | Note + propose fix (stub file, targeted reads) |
| `roadmap-staleness` | The roadmap's stated status or "next" items drift from actual epic statuses / recent commits | Draft a one-line roadmap refresh; present for user approval (never auto-commit) |

**ROI heuristic:** ROI = (reuse frequency) × (pain if forgotten) / (writing effort). Only write findings with ROI > 2 (reused in 2+ future sessions, OR would cause >30min of confusion if forgotten).

---

## Step 3 — Write memory updates

For `bug-pattern` and `tool-config`: append to the relevant per-project memory file.
For `cross-project-pattern`: route to a shared / cross-project store if one exists, else flag it for promotion. Never the per-project `memory/` (a cross-project lesson siloed in one repo is invisible to the next).
For `repo-pattern`: update the relevant `memory/repo/` file.

Rules:
- One bullet per finding. Max 2 lines. No prose.
- Group under an existing heading if one fits. Add a new heading only if 3+ bullets need it.
- Never duplicate an existing bullet — check before writing.
- Prefer concrete over abstract: "VS Code ignores hook matchers — the tool-name guard inside the script IS the only filter" beats "hooks behave differently across tools".

---

## Step 4 — Draft new skills / agents

For each `new-skill` finding, produce a minimal canonical SKILL.md following the canonical SKILL spec format with:
- spec_version, status, name, description, purpose
- requires.* capability declarations
- 3–5 step procedure
- Verification checklist

For each `new-agent` finding, produce a minimal canonical agent file following the canonical agent spec.

Place drafts at the canonical paths. Do not commit — present them to the user for review first.

---

## Step 5 — Present the harvest

Output a compact report:

```
## Session Harvest — [date]

### Memory updates written
- [file] line N: [one-line summary of what was added]

### New skill drafts created
- [skill-name]: [one sentence on what it does and why it matters]

### New agent drafts created (if any)
- [agent-name]: [role]

### Integration candidates flagged (decision needed)
- [system]: [what problem it solves]

### ADR triggers
- [decision description]

### Roadmap refresh (if any)
- [item]: [stale line → corrected one-liner, for user approval]

### Skills/agents to retire or merge (if any)
- [skill-name]: [reason]

### Context-growth risks
- [skill-name]: [reading X KB/invocation — proposed fix]
```

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "Nothing interesting happened this session" | If you wrote code, something interesting happened. Run the scan; skip writing only if findings genuinely don't clear ROI > 2. |
| "I'll harvest later when I have time" | You won't. Tacit knowledge decays in hours. Harvest now or accept the loss. |
| "Adding this to memory feels like overhead" | The overhead is paid once; the saving is paid every future session. |

## Red Flags

- Writing findings that aren't backed by something concrete from this session.
- Inventing memories about things that didn't happen.
- Duplicating an existing memory entry rather than updating it.
- Skipping the ROI filter and writing every micro-observation.

## Verification

After running this skill, confirm:

- [ ] Every finding with ROI > 2 was written.
- [ ] `MEMORY.md` index has new lines for new files.
- [ ] No duplicate entries against existing memory.
- [ ] At least one finding cites user feedback if the user gave any.
- [ ] Context-growth risks flagged (any skill that read > 5 KB this session is a candidate for a smaller stub).
