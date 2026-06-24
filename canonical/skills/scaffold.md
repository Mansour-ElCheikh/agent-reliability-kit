---
spec_version: 1
status: active
name: scaffold
description: Bootstrap or adopt the agent-reliability-kit into a project. Detects mode + installed tools, runs every applicable emitter, seeds team-shared files, and offers to set the governance ratchet baseline. Use to install the kit for the first time or to re-emit after canonical/ changes.
purpose: |
  Adopters should not have to remember which emitter to run for which
  tool, in which mode, in what order. This skill wraps the whole install
  surface in one entry point: detect what the project already has,
  dispatch the right emitters, seed the team-shared files that no
  emitter owns, and prompt (never silently) before touching the
  ratchet baseline. It is the user-facing front door to the kit.
applicable_phases: [cross-phase]
requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: required
  bash_invocation:
    level: required
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed
  session_lifecycle_hooks:
    level: not_needed
reads:
  - the target project root (detect .claude/, .cursor/, .github/, AGENTS.md, etc.)
  - the kit's canonical/ specs
  - "~/vault/ or $VAULT_PATH (detection only; integration is S6.4)"
writes:
  - per-tool config via the dispatched emitters (.claude/, .cursor/, .github/)
  - team-shared seed files in bootstrap mode (governance.yaml, testing-manifest.json, etc.)
invokes_skills: []
invokes_agents: []
trigger_phrases:
  - "/scaffold"
  - "bootstrap the kit"
  - "install the reliability kit"
  - "adopt the kit"
  - "re-emit the configs"
---

# Scaffold

Install or refresh the agent-reliability-kit in a project with one command.

## Overview

A thin front door over the emitters + engine. It detects whether the project is a fresh install (Bootstrap) or already has scaffold content (Adopt), detects which AI coding tools are in use, runs every applicable emitter in sequence, seeds the team-shared files no emitter owns, and prompts before establishing the governance ratchet baseline. The orchestration lives in `scripts/scaffold.ts`; this skill is the LLM-invocable wrapper that runs it and explains the result.

## When to Use

- First-time install of the kit into a project
- Re-emitting per-tool configs after editing `canonical/`
- Onboarding a new tool (a teammate starts using Cursor on a Claude Code repo)
- Auditing what would change, via `--dry-run`, before committing

**When NOT to use:**
- To author or edit the SDLC discipline itself, that is `canonical/` editing, not scaffolding
- To run a one-off governance audit, call the engine directly (`reliability-engine audit`)
- On Tier 3 tools with no LLM-invocation surface, run `scripts/dist/scaffold.js` from the shell directly
- To integrate a per-user vault, `--integrate-vault` is deferred to S6.4 (the wrapper prints a notice if a vault is detected)

## Steps

### 1. Run the wrapper

```sh
node scripts/dist/scaffold.js --target <project-root> [--mode bootstrap|adopt] [--tools a,b] [--dry-run]
```

With no flags it auto-detects mode + tools against the target (defaults to the current directory). Mode detection: presence of `.scaffold/`, `canonical/`, `.governance-baseline.json`, or any `scaffold-managed:` marker means Adopt; otherwise Bootstrap. Tool detection: `.claude/` or `CLAUDE.md` to claude-code; `.cursor/` or `.cursorrules` to cursor; `.github/copilot-instructions.md` to copilot-agent.

### 2. Review the dispatch plan

The wrapper prints the detected mode, the detected tools, and the emitters it will run, before writing anything. On `--dry-run` it stops here.

### 3. Let the emitters run

Each emitter runs in sequence. A non-zero exit halts the run (non-atomic by design, see Red Flags). Bootstrap mode also copies the team-shared seed files (governance.yaml, testing-manifest.json, conventions/, docs/decisions/template.md).

### 4. Establish the ratchet baseline (prompted)

After emit, the wrapper reports current governance findings and asks whether to establish the initial ratchet baseline. It never writes `.governance-baseline.json` without explicit confirmation.

### 5. Commit

Commit the per-tool config files the emitters wrote plus any seed files. The wrapper prints the exact `git add` set.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll just copy the emitter output by hand" | The emitters encode mode + capability degradation + managed-section semantics. Hand-copying loses all of it. |
| "Adopt vs Bootstrap does not matter, I'll pick one" | Bootstrap fails loudly if files exist (prevents clobber); Adopt preserves adopter content. Picking wrong either errors or overwrites. |
| "Skip the dry run, just emit" | Dry-run is free and shows exactly what each emitter would touch. Skipping it is how surprise overwrites happen. |
| "Auto-set the ratchet baseline to save a step" | A too-permissive baseline frozen on day one defeats the ratchet. The one-keystroke confirmation is the safeguard. |

## Red Flags

- Running Bootstrap mode against a repo that already has scaffold-managed sections (use Adopt).
- Continuing after an emitter failed, the run is non-atomic; fix the cause and re-run with `--mode=adopt` (idempotent), do not hand-patch.
- Committing `.scaffold/` emit reports (they are gitignored per-run artifacts).
- Establishing a ratchet baseline before fixing known error-severity findings.

## Verification

After running this skill, confirm:

- [ ] The wrapper printed a dispatch plan and it matched the project's actual tools.
- [ ] Every dispatched emitter exited 0 (check the emit reports under `.scaffold/`).
- [ ] In Bootstrap mode, team-shared seed files landed (governance.yaml, testing-manifest.json).
- [ ] The ratchet baseline was set only after explicit confirmation, or deliberately deferred.
- [ ] The per-tool config files are staged for commit; `.scaffold/` is not.
