# Memory protocol

Memory is the layer that carries non-derivable context across sessions. The codebase, git history, and ADRs cover everything that can be re-derived. Memory holds what cannot: user preferences, project history that did not get an ADR, the calibration constants from past evals, the names and personalities of people the agent collaborates with.

## Where memory lives

Per repo, at the repo root:

```
memory/
├── MEMORY.md             # index — one line per entry
├── user_role.md          # who is the agent working with, what context
├── feedback_*.md         # behavioural feedback the user gave
├── project_*.md          # project-specific state
├── reference_*.md        # pointers to external systems
└── ...
```

`MEMORY.md` is always loaded into the agent's context — keep it concise (under ~200 lines, ideally under ~100). Each entry is one line:

```markdown
- [User is a senior PM moving to product engineering](user_role.md) — frame explanations against backend analogues
- [Lean launch philosophy](feedback_lean_launch.md) — defer contribution apparatus until external PR volume justifies
```

Individual memory files have YAML frontmatter:

```yaml
---
name: User role
description: User is a senior PM with 12y experience moving into product engineering
type: user
---

Body text. Lead with the rule/fact. Then **Why:** and **How to apply:** lines if useful.
```

`type` is one of: `user`, `feedback`, `project`, `reference`. Each type carries different lifetime expectations (user memory is durable; project memory decays as state changes; reference memory points outward; feedback memory is "rule + reason + how to apply").

## When to save

**User memory** when you learn anything about who the agent is collaborating with, their role, expertise, preferences.

**Feedback memory** when the user corrects an approach OR validates an unusual approach. Include the *why* so future sessions can judge edge cases.

**Project memory** when you learn who is doing what, why, or by when. Convert relative dates to absolute (Thursday → 2026-03-05) so the entry stays interpretable.

**Reference memory** when you learn about an external system and its purpose (e.g. "bugs are tracked in Linear project 'CORE'").

## When NOT to save

- Code patterns, conventions, architecture, file paths — derive from the current state.
- Git history, recent changes, who changed what — `git log` is authoritative.
- Debugging recipes — the fix is in the code; the commit message has the context.
- Anything already documented in `CLAUDE.md` files.
- Ephemeral task state — that belongs in `TODO` or plan documents, not memory.

## How memory composes with the scaffold

| Surface | Role |
|---|---|
| `CLAUDE.md` (or equivalent) | Static project README the agent reads on every session |
| `memory/MEMORY.md` | Always-loaded index of memory entries |
| `memory/*.md` | Topic-scoped entries loaded when relevant |
| `session-harvest` skill | Flushes durable knowledge into memory at session close |

The `session-harvest` skill scans the just-ended session for memory-worthy moments and writes them. See `session-harvest.md` (sibling doc) for the protocol.

## Verifying before acting

A memory entry naming a specific file path or function is a *claim that it existed when the memory was written*. Before acting on a recommendation that cites memory:

- If the memory names a file path: verify the file exists.
- If the memory names a function or flag: grep for it.
- If the recommendation will land changes (not just answer history questions): verify first.

"The memory says X exists" is not the same as "X exists now."

## Discipline

- One bullet per finding in `MEMORY.md`. Hooks attached to memory ("— one-line hook") help future-you decide if an entry is worth opening.
- Update or remove memories that turn out to be wrong. Stale memory is more harmful than missing memory.
- Do not duplicate. Check before writing.
- Organise by topic, not by date.
