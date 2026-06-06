<!-- BEGIN scaffold-managed: emitters/claude-code -->
<!--
GENERATED FROM: canonical/
EMITTER: emitters/claude-code (v1)
GENERATED AT: NORMALISED
DO NOT EDIT - changes will be overwritten on next emit.
To customise: copy this file to a different name and break the canonical link.
-->

## SDLC discipline (from agent-reliability-scaffold)

This project uses canonical SDLC specs. Claude Code reads per-skill
instructions from `.claude/skills/<name>/SKILL.md` and subagents from
`.claude/agents/<name>.md`. Invoke a skill by its slash form or trigger phrase.

Active skills:

- `/audit` — see `.claude/skills/audit/SKILL.md`
- `/sdlc` — see `.claude/skills/sdlc/SKILL.md`

Subagents:

- `reviewer-agent` — see `.claude/agents/reviewer-agent.md`

To regenerate after canonical/ changes:
  node emitters/claude-code/dist/cli.js --output-root . --mode=adopt
<!-- END scaffold-managed: emitters/claude-code -->
