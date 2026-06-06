# ADR-0003: Canonical spec format for skills / agents / governance rules

**Status:** Accepted
**Date:** 2026-05-17
**Supersedes:** None

## Context

The scaffold extracted from RepoNav started as Claude-Code-shaped skills + agents (v0.1.0, shipped private 2026-05-17). Post-ship review surfaced two structural gaps:

1. **Positioning weakness.** The README led with structure ("here are the 5 layers") rather than value ("here's what your team gets"). Caught by user review; not by `brand-architect` (which is scoped to em-dashes + measured-claim consistency, not positional quality).
2. **Mechanism gap.** PreToolUse hooks and subagents are Claude-Code-specific. Cursor (`.cursor/rules/*.mdc`), Aider (`CONVENTIONS.md`), Continue (`.continuerc.json`) have no equivalents. The scaffold's strongest claim ("write-time governance gate blocks bad agent moves") is Tier 1-only; degraded forms must exist for Tier 2/3.

The fix requires separating SOURCE (what skill X does, what rule Y enforces) from FORMAT (how it's rendered for tool Z). RepoNav's ADR-0012 (governance-kit-extraction, status Proposed 2026-03-17) and vault's locked decision 2026-03-21 ("governance kit + vault, composable but independent") both designed this separation. Neither was built.

Wave 4 Branch A.ext implements both. This ADR specifies the canonical spec format that the separation requires.

## Decision

Adopt the canonical spec format documented in `canonical/`:

### Canonical skill spec (`canonical/skills/<name>.md`)

YAML frontmatter + markdown body. Frontmatter declares:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `spec_version` | integer | yes | Schema version (`1` for this ADR's format) |
| `status` | enum | no (default `active`) | `active` / `experimental` / `deprecated` |
| `name` | string | yes | Skill slug |
| `description` | string | yes | One sentence; emitter uses for tool's description field |
| `purpose` | string | yes | 2–3 sentences; what failure mode this prevents |
| `applicable_phases` | array | no | Slugs from `canonical/phases.md` (default `[cross-phase]`) |
| `requires.<capability>.level` | enum | per-capability | `required` / `preferred` / `not_needed` |
| `requires.<capability>.degrades_to` | enum | optional | Fallback from `canonical/phases.md` §Capability fallbacks |
| `reads` | array | no | Prose descriptions of artefacts read (v0.1; v0.2 may add structured refs) |
| `writes` | array | no | Prose descriptions of artefacts written |
| `invokes_skills` | array | no | Names of other canonical skills this invokes |
| `invokes_agents` | array | no | Names of canonical agents this invokes |
| `emit_to` | array | no | Tool slugs this skill emits to; default = all tools compatible per `requires.*` |
| `trigger_phrases` | array | no | LLM-invocation triggers (Tier 1); inline into description prose on Tier 2/3 |

Body is tool-agnostic playbook prose: Mindset/Why → Steps → Verification → Common Rationalizations → Red Flags.

### Canonical agent spec (`canonical/agents/<name>.md`)

Same frontmatter shape with these differences:
- `tools_used: [Read, Grep, Glob]` — abstract tool names; emitter maps to host's tool names
- `model_preference: small | medium | large` — abstract size hint; emitter maps to host's model selector
- `invoked_by` — list of skills/manual that trigger this agent

### Canonical governance rule schema (`canonical/governance-rule.schema.md`)

Already authored in S6.1; formalises ADR-0002 fields as a referenceable schema. Adds `spec_version`, optional `status`, and explicit severity / enforcement semantics.

### Tool-capability registry (`canonical/tool-capabilities.yaml`)

Per-tool entry with `tier`, `as_of`, and capability fields (`hook_intercept`, `subagent_invocation`, `session_lifecycle_hooks`, `llm_inline_invocation`, file-format conventions). The emitter reads this to determine whether a canonical spec can emit, must degrade, or must skip for a target tool.

### Phase vocabulary (`canonical/phases.md`)

Names the SDLC phase slugs (`define`, `plan`, `build`, `review`, `refactor`, `audit`, `session-close`, `cross-phase`) and the recognised capability-fallback values (`commit_time_gate`, `inline_review_in_skill_body`, `manual_invocation`, `glob_applied_rule`, etc.) so canonical specs and emitters share vocabulary.

### Emitter contract (`canonical/emitter-contract.md`)

Specifies what every emitter must do: inputs (canonical specs + tool-capabilities), invocation surface (`--tool`, `--output-root`, `--mode={bootstrap|adopt|overwrite}`), outputs (per-tool config files + generated-file header + emit report), idempotency + reproducibility, self-test requirement (each emitter ships golden-input/golden-output tests). Specifies what emitters DO NOT do: emitters write only per-tool config files; team-shared files (`governance.yaml`, `docs/decisions/`, `memory/MEMORY.md`) are NOT emitter outputs.

## Consequences

### Positive

- Skills + agents become **tool-agnostic at source; tool-specific at emit**. The "author once, emit everywhere" foundation lands.
- Adding a tool means: write its emitter (~150–250 LOC) + update `tool-capabilities.yaml` + add tests. Linear scaling.
- The three-tier enforcement model (Tier 1 / 2 / 3) becomes mechanical via `requires.*.degrades_to` semantics. Skills don't write per-tier logic.
- Mixed-tool teams (Cursor + Claude Code + Copilot together) can share one canonical layer + one set of governance rules. Different IDEs, same discipline.

### Negative

- **Short-term duplication.** Until S6.2 implements emitters that regenerate `skills/<name>/SKILL.md` from `canonical/skills/<name>.md`, both directories carry similar content. The Claude Code SKILL.md files are the de-facto Claude Code emitter output; they're hand-maintained alongside the canonical specs during this transition. F8 in `docs/findings/wave4-self-bootstrap.md` documents this.
- **Manual emitters at v0.1.** Per ADR-0012, emitters are templates, not automated codegen. Reliability depends on emitter authors' care. Mitigated by self-test requirement.
- **Frontmatter may need iteration.** The capability-requires + degrades_to vocabulary is new; S6.2's first real emit may surface a missing field. Bump `spec_version: 1` → `2` is documented as the path.

### What this newly permits

- Cursor, Copilot, Codex, Aider, Continue (and future tools) all consume the same canonical source.
- The rules engine (S6.3) reads `canonical/governance-rule.schema.md` for field semantics; no per-tool rule format.
- The `positioning-architect` subagent (S6.4) reviews canonical/ + emitter outputs for value/positioning quality.
- Team adoption: clone the scaffold, customise the canonical content, run `scaffold init --tools=<list>`, commit the emitted configs.

### What this newly prevents

- Re-authoring skills per tool (the failure mode that ADR-0012 named and that vault's manual `tool-config-template.md` pattern half-addresses).
- Skills drifting between Claude Code and Cursor as engineers update one and forget the other.
- Hard-coding tool-specific paths or tool names in skill bodies (the canonical body uses abstract language: "your analyser", "your governance audit").

## What this ADR does *not* do

- **Does not lock the canonical body language.** Current shape is English prose with structured sections. v0.2+ may experiment with structured-DSL alternatives if friction warrants.
- **Does not specify emitter implementation language.** Each emitter chooses (shell, Node, Python, Go). Cross-emitter uniformity is not a goal.
- **Does not commit to publishing all emitters in v0.1.** S6.1 ships canonical/ + the existing Claude Code-flavoured `skills/`. S6.2 ships Cursor + Copilot emitters. Codex / Aider / Continue land in v0.2+ as signal warrants.
- **Does not specify how adopters install emitters.** Cloning the scaffold + running `scaffold init` is the v0.1 path. Package distribution (npm / pip / brew) is a v0.2+ concern.
- **Does not version emitters internally beyond the contract version.** Per-emitter versioning is each emitter's concern; the contract version (`emitter-contract.md` says v1) ties the contract to the spec_version.

## Versioning

- This ADR introduces **Canonical Spec Format v1**.
- All canonical files (`canonical/skills/*.md`, `canonical/agents/*.md`, `canonical/governance-rule.schema.md`) declare `spec_version: 1` in frontmatter.
- Bumping `spec_version` requires a new ADR (e.g. ADR-NNNN supersedes this one). Existing emitters get a deprecation window of ≥2 releases before retirement.

## Cross-reference

- ADR-0001 (Scaffold charter — what ships, what does not)
- ADR-0002 (Governance YAML shape — formalised by `canonical/governance-rule.schema.md`)
- ADR-0012 of RepoNav (`docs/decisions/0012-governance-kit-extraction.md` in `Mansour-ElCheikh/Reponav`, status Proposed 2026-03-17): designed this multi-tool governance kit; this ADR implements it.
- vault decision 2026-03-21 ("governance kit and vault are composable but independent"): designed the composability pattern; honored by `scaffold init --integrate-vault` (S6.4).
- `canonical/emitter-contract.md`
- `canonical/governance-rule.schema.md`
- `canonical/tool-capabilities.yaml`
- `canonical/phases.md`
- `docs/findings/wave4-self-bootstrap.md` (F8 documents the canonical/ vs skills/ duplication during transition)
