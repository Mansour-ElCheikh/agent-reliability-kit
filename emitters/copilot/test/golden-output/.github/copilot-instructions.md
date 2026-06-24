<!-- BEGIN scaffold-managed: emitters/copilot -->
<!--
GENERATED FROM: canonical/skills/
EMITTER: emitters/copilot (v1)
GENERATED AT: NORMALISED
DO NOT EDIT - changes will be overwritten on next emit.
To customise: copy this file to a different name and break the canonical link.
-->

## SDLC discipline (from agent-reliability-kit)

This project uses canonical SDLC specs. Per-skill instructions live in
`.github/instructions/<name>.md`; Copilot agent mode reads them automatically
on matching invocations.

Active skills:

- `audit` — see `.github/instructions/audit.md`
- `sdlc` — see `.github/instructions/sdlc.md`

To regenerate after canonical/ changes:

```sh
node emitters/copilot/dist/cli.js --output-root . --mode=adopt
```
<!-- END scaffold-managed: emitters/copilot -->
