# Examples

Worked adoption examples showing what an adopter's project tree and configuration look like after running `/scaffold` and customizing.

These are **shape examples**, not runnable services. They show the files that land in your repo and how to fill in the project-specific blanks. For the runnable end-to-end flow, see [`../ONBOARDING.md`](../ONBOARDING.md).

## Available examples

| Example | What it shows |
|---|---|
| [`typescript-service/`](typescript-service/) | A TypeScript service adopting the scaffold: customized `governance.yaml` ramped to `profile: team`, two project-specific rules uncommented (`boundary_imports`, `roadmap_first`), and captured engine audit output showing a real gate firing on a planted violation. |

## How to read an example

Each example directory contains:

- A short `README.md` (where present) framing the scenario.
- The customized `governance.yaml` that the team would commit.
- A `SAMPLE-AUDIT-OUTPUT.md` with captured output from running the engine against a planted violation in that example's shape. Output is verbatim, not synthesized.

The intent is: clone the scaffold, run `pnpm install && pnpm run build`, point the engine at the example's directory shape, and see the same output documented in `SAMPLE-AUDIT-OUTPUT.md`. If the output diverges, the example or the engine has drifted; either is a real signal worth reporting.
