# ADR-0008: Reconcile "not a runtime" language with the working factory

**Status:** Accepted
**Date:** 2026-05-20
**Supersedes:** None (amends ADR-0001 in part)

## Context

[ADR-0001](./0001-scaffold-charter.md) framed the scaffold as *"Not a runtime. Nothing executes when you install it. Documents, conventions, and hook shell scripts."* That phrasing was strictly true in Wave 4 (the v0.1.0 cut), when the kit was indeed documents + shell scripts.

Since then, three TypeScript surfaces have landed:

- **S6.3a** — TypeScript Cursor + Copilot emitters (`emitters/cursor/dist/cli.js`, `emitters/copilot/dist/cli.js`).
- **S6.3b** — TypeScript governance engine (`engine/dist/cli.js` with `audit`, `hook`, `ratchet` modes) and the TypeScript scaffold wrapper (`scripts/dist/scaffold.js`) and Claude Code emitter (`emitters/claude-code/dist/cli.js`).
- **S6.4a (ADR-0007)** — engine predicates registry grew from 6 to 9; governance hook example `governance/hook.example.sh` actively gates Edit/Write calls when wired.

These are executable. `pnpm install && pnpm run build` produces JavaScript dist files. `node engine/dist/cli.js audit` reads a target tree and writes findings. `node scripts/dist/scaffold.js --target ... --mode bootstrap` writes files into the target. The hook intercepts agentic tool calls.

The strict-false claim *"Nothing executes when you install it"* survived three sprints unchallenged. The Q5 user review on 2026-05-20 surfaced the drift; the [comparison-vs-flat-skill-models](../findings/comparison-vs-flat-skill-models.md) finding documents the meta-gap that allowed it (no narrative-vs-reality predicate exists in the scaffold's discipline).

The original intent of "Not a runtime" was clear and worth preserving: the kit does not couple to adopters' production code, does not run as a background daemon, does not expose an `import`-able SDK, does not require a service. That intent is still true. The framing that captures it precisely is **"Not a service or SDK"**, not "Nothing executes."

## Decision

**Replace "Not a runtime. Nothing executes when you install it." with "Not a service or SDK. No background daemon, no network calls, no `import` statements you wire into your application code; the engine and emitters are local CLIs you invoke on demand."** on every public surface where the strict-false phrasing currently appears.

Specifically, update:

- `README.md` "What this is not" first bullet.
- `ARCHITECTURE.md` "Non-goals" first bullet.
- `NOTICE` Third-party-attribution section (the "documents and shell-script templates only" line, qualified for the actually-shipped TypeScript surfaces with their own npm dependencies).
- `memory/MEMORY.md` and `memory/scaffold_charter.md` (the "documents-not-runtime" hook + the "Documents + shell scripts, not a framework or runtime" line).
- ADR-0001 receives an amendment note in its header (parallel to the ADR-0007 amendment note for governance enabledness).

The amendment is in-scope of ADR-0001's intent (the scaffold is still not a production-coupled component); the change is to the language, not the design.

## Consequences

**For a public reader:** the kit's surfaces no longer make a strict-false claim. A reader who runs `pnpm install` sees TypeScript build output and understands they are installing local CLI tooling, not a network component. The honest framing aligns with what they will actually experience.

**For ADR-0001:** the "ships shapes, not contents" framing for *adopter artifacts* stands unchanged. An adopter who runs `/scaffold` against their repo still gets Markdown + YAML + shell into their tree, not JavaScript imports. The runtime concern is about the *scaffold itself*, not the adopter's emitted output. ADR-0001's exclusion bucket (proctor dashboard, RepoNav-specific subagents, etc.) is unaffected.

**For NOTICE:** the "no bundled dependencies" line is qualified: emitted adopter artifacts contain no bundled JavaScript dependencies; the scaffold's own engine/wrapper/emitters have their own (notably `commander`, `js-yaml`, and TypeScript dev dependencies).

**Prevents:** a reader experiencing the strict-false framing as a credibility hit at the moment of `pnpm install`. The discipline the kit teaches (evidence-not-vibes, narrative matches reality) cannot tolerate the kit itself making strict-false claims about its own runtime.

**Permits (the cost):** a small expansion of every "What this is not" surface to be precise. Mitigation: the new framing is shorter than the old when measured by reader-trust-cost.

## What this ADR does *not* do

- Does **not** change the scaffold's charter (ADR-0001's "what ships / what does not" bucket stands).
- Does **not** introduce new runtime surfaces. The TypeScript engine + emitters + wrapper were already shipped (since S6.3a/b); this ADR only reconciles language.
- Does **not** change how adopters consume the kit. They still get documents + YAML + shell into their repo when they run `/scaffold`.
- Does **not** add a new gate. Narrative-vs-reality drift is addressed via subagent review on PRs rather than a deterministic predicate; the predicate variant was considered and remains uncommitted pending evidence (see [ROADMAP.md](../../ROADMAP.md), "Considered but not committed").

## Cross-reference

- [ADR-0001](./0001-scaffold-charter.md) — scaffold charter (amended in part by this ADR for the runtime-language reconciliation, parallel to ADR-0007's amendment for governance enabledness)
- [ADR-0007](./0007-universal-rules-ship-enabled.md) — the prior amendment of ADR-0001
