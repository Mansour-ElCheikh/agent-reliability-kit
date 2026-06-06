# Copilot emitter

Reads `canonical/` and writes Copilot-agent-mode configuration: `.github/instructions/<name>.md` per skill + `.github/copilot-instructions.md` steering file with a scaffold-managed section.

## Requirements

- Node 20+
- pnpm 9+ (managed via corepack; `corepack enable` once, then `pnpm install` from scaffold root)

## Invocation

```sh
node emitters/copilot/dist/cli.js --output-root <path> --mode <bootstrap|adopt|overwrite> [--dry-run]
```

Build the emitter first (`pnpm -F @reliability-scaffold/emit-copilot build`).

Same flags as the Cursor emitter (see `emitters/cursor/README.md` § Invocation).

## What gets emitted

Per canonical skill (with `status: active` and either no `emit_to:` restriction or `copilot-agent` listed in `emit_to:`):

- `<output-root>/.github/instructions/<skill-name>.md` — the skill body wrapped with a generated-file header + trigger phrases as a prose preface + per-skill degradation notes

`<output-root>/.github/copilot-instructions.md` — single steering file. If it doesn't exist, the emitter creates one with the scaffold-managed section. If it exists, the emitter inserts/updates the scaffold-managed section between `<!-- BEGIN scaffold-managed: emitters/copilot -->` / `<!-- END -->` markers; adopter content outside the markers is preserved.

`<output-root>/.scaffold/emit-report.copilot-agent.<timestamp>.md` — full emit report.

## What gets skipped

- Canonical agents (Copilot agent mode has no subagent surface; the `reviewer-agent` checklist already inlines into `skills/review` and `skills/define` bodies)
- Skills with `status: deprecated` or `status: experimental`
- Skills with `emit_to:` restricting to other tools

## Degradations applied

Per ADR-0004, Copilot agent mode is Tier 1 with partial support for session lifecycle hooks. Common degradations:

| Canonical requirement | Copilot degradation |
|---|---|
| `subagent_invocation: preferred` (no native subagent surface) | `inline_review_in_skill_body` — reviewer-agent checklist is inlined |
| `session_lifecycle_hooks: preferred` (SessionStart yes, SessionEnd no) | `manual_invocation` — user invokes session-harvest manually at session end |

Each per-skill output includes a note about degradations applied (when any).

## How Copilot reads these files

In VS Code Copilot agent mode (as of 2026-05):
- `.github/copilot-instructions.md` is loaded as the global system prompt for any agent session in this repo
- `.github/instructions/<name>.md` files are pulled in based on instruction-file matching (Copilot's heuristic; tool-version specific)
- In chat mode (non-agent), only `.github/copilot-instructions.md` is read

This emitter writes both surfaces; Copilot decides which to use per session mode.

## Adopter customisation

Same pattern as the Cursor emitter:
- Customise a per-skill file: delete the `GENERATED FROM:` marker or rename the file; adopt mode preserves it.
- Customise the steering file: edit content OUTSIDE the BEGIN/END markers; content inside is regenerated on every emit.
- Exclude a skill: add `emit_to:` to canonical and omit `copilot-agent`.

## Testing

```sh
bash emitters/copilot/test/run-test.sh
```

Diffs emit output against golden fixtures. Same workflow as Cursor: update goldens in PR when canonical changes are intentional.
