# Cursor emitter

Reads `canonical/` and writes Cursor-format configuration: `.cursor/rules/*.mdc` per skill + `.cursorrules` steering file with a scaffold-managed section.

## Requirements

- Node 20+
- pnpm 9+ (managed via corepack; `corepack enable` once, then `pnpm install` from scaffold root)

## Invocation

```sh
node emitters/cursor/dist/cli.js --output-root <path> --mode <bootstrap|adopt|overwrite> [--dry-run]
```

Build the emitter first (`pnpm -F @reliability-scaffold/emit-cursor build`) — `dist/cli.js` is the build output.

| Flag | Description |
|---|---|
| `--output-root` | Adopter's project root (or any target dir). Files emit into `<output-root>/.cursor/rules/` + `<output-root>/.cursorrules`. |
| `--mode` | `bootstrap` (fail if any target file exists) / `adopt` (preserve adopter content; replace only scaffold-managed sections + files with our GENERATED marker) / `overwrite` (replace everything). |
| `--dry-run` | Print what would be emitted; write nothing. |
| `--canonical-root` | Override canonical source dir (default: `<scaffold>/canonical/`). For tests. |
| `--tool-capabilities` | Override `tool-capabilities.yaml` path. For tests. |

**Typical adopter flow:**

```sh
git clone https://github.com/Mansour-ElCheikh/agent-reliability-kit
cd agent-reliability-kit && corepack enable && pnpm install && pnpm run build   # one time
cd <your-project>
node <path-to-scaffold>/emitters/cursor/dist/cli.js --output-root . --mode=bootstrap
git add -A && git commit -m "chore: bootstrap cursor configs from canonical/"
```

**Re-emit after canonical/ changes:**

```sh
node <path-to-scaffold>/emitters/cursor/dist/cli.js --output-root . --mode=adopt
```

## Phase-to-globs heuristic (per F9)

Cursor MDC rules need a `globs:` array (which file paths the rule applies to). Canonical skills declare `applicable_phases:` instead. The Cursor emitter maps phases to globs:

| Canonical phase | Cursor globs | `alwaysApply` |
|---|---|---|
| `define` | `dev/epics/*/epic.md`, `dev/epics/*/tasks.md` | false |
| `plan` | `dev/epics/*/plan.md`, `dev/epics/*/tasks.md` | false |
| `review` | `dev/epics/*/review.md`, `src/**`, `tests/**` | false |
| `refactor` | `src/**` | false |
| `audit` | (none — skipped; audit is invoked, not glob-applied) | n/a |
| `session-close` | (none — skipped; session-end, not file-trigger) | n/a |
| `cross-phase` | `dev/epics/**`, `src/**`, `docs/**` | false |

Source: `src/cli.ts` constant `PHASE_GLOBS`. Adopters who want different globs for a specific skill: in `--mode=adopt`, edit `.cursor/rules/<name>.mdc` BEFORE running emit; if the file lacks our `GENERATED FROM:` marker, adopt mode preserves it as-is.

## What gets emitted

Per canonical skill (when `applicable_phases` has at least one glob-mappable phase):
- `<output-root>/.cursor/rules/<skill-name>.mdc` — the rule body with frontmatter (description, globs, alwaysApply) + scaffold-generated header + body

`<output-root>/.cursorrules` — single steering file with a `<!-- BEGIN scaffold-managed: emitters/cursor -->` / `<!-- END scaffold-managed: emitters/cursor -->` section listing active skills. Adopter content outside the markers is preserved.

`<output-root>/.scaffold/emit-report.cursor.<timestamp>.md` — full emit report (emitted / degraded / skipped / errors).

## What gets skipped

- Skills with phases mapping to no globs (currently `audit`, `session-close`)
- Canonical agents (Cursor has no subagent surface)
- Skills with `status: deprecated` or `status: experimental`
- Skills with `emit_to:` restricting to other tools

## Degradations applied

Per ADR-0004's three-tier model, Cursor (Tier 2) applies these fallbacks:

| Canonical requirement | Cursor degradation |
|---|---|
| `llm_inline_invocation: required` | `glob_applied_rule` — rule fires when files match `globs:`; not user-invoked |
| `subagent_invocation: required` or `preferred` | `inline_review_in_skill_body` — checklist already in skill body |
| `session_lifecycle_hooks: required` or `preferred` | `manual_invocation` — user manually fires the equivalent skill |
| `hook_intercept: required` (with `commit_time_gate`) | git pre-commit gate (engine-backed; ships in S6.3) |

Each per-(skill, tool) outcome with degradations gets a "Degradations applied" block in the generated file header AND a line in the emit report.

## Adopter customisation

**To customise a single rule:** edit `.cursor/rules/<name>.mdc` directly. On next `--mode=adopt` emit, the emitter checks for the `GENERATED FROM:` marker — if you removed it (or the file is brand new), adopt mode preserves your file. To get the canonical version back, rename your file and re-emit.

**To customise the steering file:** edit `.cursorrules` content OUTSIDE the `<!-- BEGIN scaffold-managed: emitters/cursor -->` / `<!-- END -->` markers. Content between the markers gets replaced on every emit; content outside is preserved.

**To stop emitting a specific skill:** add `emit_to: [...]` to the canonical skill's frontmatter, excluding `cursor`. The skill stays for other tools.

## Testing

```sh
bash emitters/cursor/test/run-test.sh
```

Compares emit output against golden fixtures. Failures indicate either a regression in the emitter OR an intentional canonical-spec change — review the diff in the PR and update goldens if intentional.
