# Emitter contract v1

An **emitter** is a small program that reads canonical specs (`canonical/skills/`, `canonical/agents/`, `governance.yaml`) and produces tool-specific configuration files (`.claude/skills/`, `.cursor/rules/`, `.github/copilot-instructions.md`, etc.).

This document is the contract every emitter must satisfy. Each emitter is free to choose its implementation language (shell, Node, Python, Go) but must conform to the inputs, outputs, invocation surface, and report shape specified here.

---

## 1. Inputs

Every emitter reads:

| Input | Path (relative to scaffold or adopter repo) | Purpose |
|---|---|---|
| Canonical skills | `canonical/skills/<name>.md` | Source-of-truth playbook content + frontmatter |
| Canonical agents | `canonical/agents/<name>.md` | Source-of-truth agent definitions |
| Canonical governance rule schema | `canonical/governance-rule.schema.md` | Field contract for `governance.yaml` |
| Phase vocabulary | `canonical/phases.md` | Definitions referenced by `applicable_phases:` |
| Tool-capabilities registry | `canonical/tool-capabilities.yaml` | What each target tool supports |
| Target tool identifier | CLI flag `--tool=<name>` | Which entry in the registry to read |

Emitters are **pure functions** of these inputs. Same inputs → byte-identical outputs.

---

## 2. Invocation surface

Every emitter exposes the same CLI shape (whatever language wraps it):

```sh
<emitter> --tool=<name> --output-root=<path> --mode=<bootstrap|adopt|overwrite> [--dry-run]
```

| Flag | Required | Description |
|---|---|---|
| `--tool` | yes | Tool slug from `tool-capabilities.yaml` (e.g. `claude-code`, `cursor`, `copilot-agent`) |
| `--output-root` | yes | Directory to emit into. Two common shapes: an adopter's project repo root, or the scaffold's own root (for self-regenerate). |
| `--mode` | yes | `bootstrap` (fail if any target file exists) / `adopt` (merge non-destructively; never overwrite) / `overwrite` (replace existing files; emit generated-header on each) |
| `--dry-run` | no | Print what would be emitted; write nothing. Default: false. |

**Exit codes:**
- `0` — emit succeeded; report written
- `1` — invocation error (bad flags, missing tool)
- `2` — input error (canonical specs missing or malformed)
- `3` — mode conflict (e.g. bootstrap mode but target files exist)
- `4` — emitter author bug (unhandled case)

---

## 3. Output

Each emitter writes:

### 3.1 Per-tool config files

Whatever shape the target tool reads. Path conventions per tool live in `tool-capabilities.yaml` under the tool's `skill_format` / `agent_format` / `rule_format` fields.

**Scope discipline:** emitters write **only per-tool configuration files**. Examples of what an emitter DOES write:
- `.claude/skills/<name>/SKILL.md`
- `.cursor/rules/<name>.mdc`
- `.github/copilot-instructions.md` + `.github/instructions/<name>.md`
- `AGENTS.md` (Codex)
- `CONVENTIONS.md` (Aider)
- `.continuerc.json` (Continue)
- The target tool's hook wiring (e.g., `.claude/settings.json` PreToolUse entries)

Examples of what an emitter DOES NOT write (these are team-shared, tool-agnostic, owned by the repo regardless of tool):
- `governance.yaml`
- `docs/decisions/`
- `memory/MEMORY.md`
- `testing-manifest.json`
- `CHANGELOG.md`
- `LICENSE`

Team-shared files are part of the scaffold's seed content (copied at `init` time), not regenerated per tool.

### 3.2 Generated-file header

Every file an emitter writes contains a header in the file's comment syntax. Adopters editing emitted files lose their changes on next emit; the header warns them.

**Placement rule (markdown files with YAML frontmatter):** the header goes AFTER the closing `---` of the frontmatter, BEFORE the body's H1 heading. Frontmatter parsers expect `---` on line 1; putting the header above would break parsing on every tool that reads SKILL.md / .mdc as YAML-frontmatter markdown.

```markdown
---
name: sdlc
description: ...
---

<!--
GENERATED FROM: canonical/skills/sdlc.md
EMITTER: emitters/claude-code (v1)
GENERATED AT: 2026-05-17T19:42:00Z
DO NOT EDIT - changes will be overwritten on next emit.
To customise: copy this file to a different name and break the canonical link.
-->

# Skill body H1 here
```

For markdown files without frontmatter (e.g. `.github/copilot-instructions.md` sections), the header goes at the top of the managed section (between the markers; see §3.4).

For a YAML / JSON / shell file, comment syntax is `#` (or `//` for JSON5). For files that don't support comments (strict JSON), the emitter SHOULD pick an adjacent docstring-like field if available, or document the generated nature in a sibling `<name>.GENERATED.md` file.

### 3.4 Steering files (managed-section pattern)

Some tools use a single steering file at a fixed path (`.cursorrules` for Cursor; `.github/copilot-instructions.md` for Copilot; `AGENTS.md` for Codex; `CONVENTIONS.md` for Aider). The emitter writes scaffold-managed content into a delimited section, leaving any adopter content outside the markers untouched.

**Marker syntax (markdown comment):**

```markdown
<!-- BEGIN scaffold-managed: emitters/<tool> -->
<header per §3.2>

<scaffold-managed content here — per-skill summaries, references to <name>.mdc files, etc.>
<!-- END scaffold-managed: emitters/<tool> -->
```

**Mode behaviour:**

| Mode | Steering file does not exist | Steering file exists, no markers | Steering file exists, markers present |
|---|---|---|---|
| `bootstrap` | Create file with markers + content | Exit 3 (mode conflict; adopter content not seen) | Exit 3 (markers indicate prior emit; use adopt mode) |
| `adopt` | Create file with markers + content | Append markers + content at file end (preserve existing adopter content) | Replace content BETWEEN markers; preserve everything outside |
| `overwrite` | Create file | Replace entire file with markers + content | Replace entire file |

**Adopter customisation outside the markers is never touched.** Adopter customisation INSIDE the markers is lost on next emit; the §3.2 header warns of this.

**Edge case (E14):** an emitter encountering nested or malformed markers (multiple BEGIN without matching END, or END before BEGIN) MUST exit with code 4 and a clear error message naming the file + offending line numbers. Do not attempt to recover; let the adopter clean up manually.

### 3.3 Emit report

Every emitter writes a markdown report to `<output-root>/.scaffold/emit-report.<tool>.<timestamp>.md`:

```markdown
# Emit report
**Tool:** <name> (tier <N>)
**Mode:** <bootstrap | adopt | overwrite>
**Output root:** <path>
**Emitter:** <emitter-path> v<n>
**Run at:** <ISO 8601 UTC>

## Emitted (<count>)
- `<output-path>` ← `canonical/skills/<name>.md`
- ...

## Skipped (<count>)
- `<canonical-path>` — reason: `<one-line>`

## Degraded (<count>)
- `<canonical-path>` → `<output-path>` — degradation: `<what fell back to what>`

## Errors (<count>)
- `<canonical-path>` — error: `<details>`
```

The emit report is itself **per-tool, per-run**. Adopters in adopt-mode workflows commit only files in §3.1 + §3.2; the report stays in `.scaffold/` and is `.gitignore`'d by default.

---

## 4. Capability mapping

Each canonical skill / agent declares capability requirements in frontmatter (`requires.*`). The emitter resolves these against `tool-capabilities.yaml`:

| Requirement value | Emitter behaviour when target tool supports it | Emitter behaviour when target tool lacks it |
|---|---|---|
| `level: required` (no `degrades_to`) | Emit normally | Skip; record in report §"Skipped" with reason |
| `level: required` + `degrades_to: <fallback>` | Emit normally | Emit the degraded form; record in report §"Degraded" |
| `level: preferred` (no `degrades_to`) | Emit normally | Emit a minimum version; record in §"Degraded" |
| `level: preferred` + `degrades_to: <fallback>` | Emit normally | Emit the degraded form; record in §"Degraded" |
| `level: not_needed` | Emit normally | Emit normally (the capability is irrelevant) |

The set of recognised `degrades_to` fallbacks lives in `canonical/phases.md` §"Capability fallbacks" and is shared across emitters so they degrade consistently.

### Handling `partial` tool support

A tool's capability in `tool-capabilities.yaml` may declare `supports: partial` (e.g. Copilot agent mode supports `SessionStart` but not `SessionEnd`). When the spec's required capability maps to a partial tool capability:

- If the partial features cover the spec's specific need → treat as supported; emit normally.
- If the partial features do not cover the need → treat as not supported; use `degrades_to:` if set, otherwise skip the spec.
- The judgment call lives in the emitter. Document the resolution in the emit report's §Degraded or §Skipped entry.

---

## 5. Idempotency + reproducibility

Emitters MUST be idempotent and reproducible:

- **Idempotent.** Running the same emitter twice with the same inputs produces byte-identical outputs the second time. No incrementing counters, no timestamps in the file *content* (the report timestamp is OK because the report is per-run, not committed).
- **Reproducible.** Same canonical input + same `tool-capabilities.yaml` + same emitter version → same output on any machine. No reading clock / random / env-var-dependent state inside the emitted content.
- **Deterministic ordering.** When emitting multiple files, iterate canonical inputs in lexicographic-sorted filename order. No filesystem-order-dependence.

Exception: the GENERATED-FILE header includes a timestamp. This is acceptable because the header is metadata (not skill content) and adopters don't diff headers across runs.

---

## 6. Self-test requirement

Each emitter SHIPS a self-test under `emitters/<tool>/test/`:

```
emitters/<tool>/
├── emit.<sh|js|py>           # the emitter itself
├── templates/                # any per-tool templates the emitter uses
├── README.md                 # what this emitter does + how to invoke
└── test/
    ├── golden-input/         # a minimal canonical/ subtree (1-2 skills)
    ├── golden-output/        # expected emitted files
    ├── tool-capabilities.test.yaml  # tool-capabilities entry for testing
    └── run-test.sh           # invokes emitter against golden-input, diffs against golden-output
```

The CI workflow runs `bash emitters/<tool>/test/run-test.sh` for every emitter on every push. A failed test blocks merge.

When a canonical spec changes, the affected emitter's golden-output may need to update. That's an intentional diff captured in the PR.

---

## 7. Adding a new tool

Steps to add a new target tool to the scaffold:

1. Add an entry to `canonical/tool-capabilities.yaml` with:
   - `tier: 1 | 2 | 3` (per `canonical/phases.md` §Three-tier enforcement)
   - Each capability field (`hook_intercept`, `subagent_invocation`, `session_lifecycle_hooks`, etc.)
   - `as_of: <YYYY-MM-DD>` reflecting when the tool's capabilities were last verified
   - File-format conventions (`skill_format`, `agent_format`, `rule_format`)
2. Author `emitters/<tool>/emit.<ext>` per this contract
3. Author `emitters/<tool>/test/` with golden-input + golden-output + run-test.sh
4. Update `docs/capability-matrix.md` (lands in S6.2) with the new tool's row
5. Add an ADR if the tool's quirks warranted design decisions
6. PR opens; CI runs all emitter tests including the new one

Emitter authoring is a one-time per-tool cost of ~150-250 LOC plus test fixtures.

---

## 8. Versioning

This contract is **Emitter Contract v1**. Bump rules:

- Patch (v1 → v1.x): clarifications, typo fixes, additional examples — no shape change. Emitters need no update.
- Minor (v1 → v1.N): new optional fields, new optional flags, new optional exit codes. Existing emitters keep working; new emitters can use the additions.
- Major (v1 → v2): any change that breaks existing emitters. Requires ADR; existing emitters get a deprecation window (≥2 releases) before retirement.

The `spec_version: 1` field at the top of every canonical skill / agent / governance-rule schema ties to this contract version. An emitter conforming to Emitter Contract v1 reads spec_version: 1.

---

## 9. What this contract does NOT specify

- Implementation language of any emitter
- Exact template-rendering mechanism
- How emitters discover their installation (they're invoked by path; no registry lookup)
- How emitters version themselves internally beyond the contract version
- How adopters install emitters (cloning the scaffold + running `npx scaffold init` is the v0.1 path; package distribution is a v0.2+ consideration)

These are left to emitter authors. Future ADRs may standardise some if friction surfaces.

---

## Cross-reference

- ADR-0003 (canonical spec format)
- `canonical/governance-rule.schema.md`
- `canonical/tool-capabilities.yaml`
- `canonical/phases.md`
- ADR-0002 (governance YAML shape)
- ADR-0001 (scaffold charter)
