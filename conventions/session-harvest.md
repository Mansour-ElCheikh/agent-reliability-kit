# Session harvest

The end-of-session ritual that turns one session's tacit knowledge into the next session's standing context.

## Why

Every session ends with knowledge the agent built up and the human reviewed. Most of it can be re-derived from the codebase. A meaningful slice cannot: bug patterns and their fixes, tool quirks not in the docs, user feedback that should change future behaviour. That slice is what the harvest captures.

Without a harvest, the next session re-learns the same lessons. Three sessions in, the cost compounds.

## When

- At session close (the user signals "we're done" or invokes `/session-harvest` directly).
- At wave close in a multi-wave plan (the orchestrator triggers it inline).
- At phase transitions inside an SDLC run (auto-fired by the `sdlc` skill at the end of Define / Build / Review).

A `SessionEnd` hook with `prompt_input_exit` and `other` matchers is the recommended automation. The skill body is the redundant backup for cross-boundary sessions.

## The five-step protocol

The `skills/session-harvest/SKILL.md` file is the canonical procedure. Summary here:

1. **Read the session.** Pull commits, conversation context, governance hook log, session-event log if your project keeps one. Establish what happened.
2. **Classify findings.** Each insight goes into a category: `bug-pattern`, `tool-config`, `cross-project-pattern`, `repo-pattern`, `new-skill`, `new-agent`, `new-mcp`, `adr-trigger`, `context-growth`.
3. **Apply the ROI filter.** `ROI = (reuse frequency) × (pain if forgotten) / (writing effort)`. Only findings with `ROI > 2` get written to memory.
4. **Write memory updates.** Per the memory protocol. One bullet per finding. Update `MEMORY.md` index.
5. **Present the harvest report.** Short structured output: memory updates written, ADR triggers, new skills proposed, context-growth risks.

## What to harvest aggressively

- Bug patterns where the fix was non-obvious. The fix is in the code; the *why* of the fix often is not.
- Tool quirks. "VS Code ignores hook matchers — the tool-name guard inside the script IS the only filter" is the kind of fact that costs hours if re-discovered.
- User feedback. Both corrections ("don't do X") and confirmations ("yes that approach was right").
- Calibration constants from evals. Pre-registered thresholds, decision rules that resolved.
- External-system pointers. Where bugs are tracked, where dashboards live, who owns what.

## What NOT to harvest

- Anything the codebase or git log encodes. The harvest is a wedge against re-derivation cost; if re-derivation is cheap, the harvest entry is noise.
- Ephemeral session state. "I just commited X" is not memory; it is the git log.
- Vague conclusions. "Performance was fine" is not a harvest; "P50 was 14 ms on N=100 fixtures" is.
- Aspirational targets. The harvest records what happened, not what should happen next.

## Bundling with the SDLC

Inside an SDLC run, the harvest fires at every phase transition (Define approved, Build committed, Review shipped). The rationale: Build phases produce the most tacit knowledge — bug patterns, tool quirks — and waiting until Review risks losing context if the session ends mid-build.

Every-phase harvest produces a stream of small findings rather than a single end-of-epic dump. Easier to filter, easier to review.

## Verification

After a harvest run, confirm:

- [ ] Every finding with ROI > 2 was written.
- [ ] `MEMORY.md` index has new lines for new files.
- [ ] No duplicate entries against existing memory.
- [ ] At least one finding cites the user feedback channel if the user gave any.
- [ ] Context-growth risks flagged (any skill that read > 5 KB this session is a candidate for a smaller stub).
