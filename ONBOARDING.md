# Onboarding: from clone to a gate firing, in 15 minutes

A tool-agnostic SDLC discipline kit is only useful if you can experience the loop. This walkthrough takes you from `git clone` to **a deterministic gate firing on a planted violation in your own project**, in roughly fifteen minutes. Every command below was captured running against this repository on 2026-05-20; the output snippets are verbatim from that run.

If you came here looking for the value proposition or the architecture, those live in [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md). This document is about hands-on adoption.

## What you will have at the end

- The kit cloned, built, and self-testing green.
- A target project (yours, or a fresh empty directory for the walkthrough) bootstrapped with `governance.yaml`, the canonical skills emitted to `.claude/skills/`, and the reviewer-agent installed.
- A planted violation (a new TypeScript source file without a co-located test) **caught by the governance engine**, with the finding reported in JSON and TOON.
- A clear next step for customizing governance to your project's actual invariants.

## Prerequisites

- Node 20 or newer
- pnpm 9+ via corepack (`corepack enable`)
- git
- About 15 minutes of attention

## Step 1: Clone, install, build

```sh
git clone https://github.com/Mansour-ElCheikh/agent-reliability-kit
cd agent-reliability-kit
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

Verify the engine is healthy:

```sh
pnpm -F @reliability-scaffold/engine test
```

You should see `Tests  21 passed (21)`. If you do not, stop and open an issue; the kit's discipline is whatever the engine self-tests prove, so a red baseline is a real signal.

## Step 2: Bootstrap into a target project

Pick a target directory. For the walkthrough you can use a fresh empty directory; for real adoption point at your project:

```sh
TARGET=$(mktemp -d)
mkdir -p "$TARGET/.claude"   # marks the target as a Claude Code project (tool auto-detection)
node $(pwd)/scripts/dist/scaffold.js --target "$TARGET" --mode bootstrap
```

The wrapper detects the target's tooling, runs the applicable emitter (Claude Code here), and seeds the team-shared files. You should see output ending with `Scaffold complete.`

Inspect what was seeded:

```sh
ls "$TARGET"
```

You should see, among others:
- `governance.yaml`: the rule contract (copied from `governance.yaml.example`)
- `.claude/skills/`: the 12 canonical skills emitted as `.claude/skills/<name>/SKILL.md`
- `.claude/agents/reviewer-agent.md`: the adversarial subagent
- `conventions/`: `testing.md`, `git-workflow.md`, `sandbox.md`, `verification.md`, `memory-protocol.md`, `session-harvest.md`
- `.github/workflows/reliability.yml`: a starter CI workflow you can tighten
- `CLAUDE.md`: the project-level pointer Claude Code reads at session start
- `eslint.config.mjs`, `.prettierrc.json`: formatting baselines

The bootstrap intentionally **does not** set the ratchet baseline. The wrapper prints a follow-up command for that; you run it when you are ready to lock in the current state as the floor.

## Step 3: Plant a violation and watch the gate fire

This is the moment the kit's value becomes concrete. The Universal Default Set (ADR-0007) includes `tdd_test_first`: a new TypeScript source file under `src/**` must have a co-located test sibling. Plant a violation:

```sh
cat > "$TARGET/src/calculator.ts" <<'EOF'
export function add(a: number, b: number): number {
  return a + b;
}
EOF
```

Run the engine in audit mode against the target:

```sh
node $(pwd)/engine/dist/cli.js audit \
  --config "$TARGET/governance.yaml" \
  --repo-root "$TARGET" \
  --format json
```

You will see output identical in shape to this real captured run:

```
Governance audit — my-project
  0 error(s), 1 warning(s), 0 audit-only
  Per-rule:
    tdd_test_first: 1
  RATCHET EXCEEDED — these rules grew past baseline:
    tdd_test_first: 0 → 1 (+1)
Report: <target>/.scaffold/audit-report.<timestamp>.json
```

That is the loop. A deterministic rule (`tdd_test_first`) caught a concrete behavior on a real file path, the ratchet flagged the regression past baseline, and the structured report landed under `.scaffold/`. No agent had to remember anything; the engine ran.

To see the same audit in the LLM-context format (compact TOON):

```sh
node $(pwd)/engine/dist/cli.js audit \
  --config "$TARGET/governance.yaml" \
  --repo-root "$TARGET" \
  --format toon
```

Both formats land in `.scaffold/` (gitignored by default).

## Step 4: Customize for your project

The seeded `governance.yaml` ships with the Universal Default Set enabled at `severity: warn` under `profile: solo` (records, does not block). The project-specific section ships commented-out as shape; you uncomment what fits and fill in the patterns.

Concrete adoption checklist:

1. Open the seeded `governance.yaml` and read the two sections (Universal vs Project-specific).
2. For a real codebase, ramp the profile to `team` to make universal rules block instead of warn: change `profile: solo` to `profile: team`. The `no_secrets` safety rule blocks under both profiles.
3. Look at the commented project-specific shapes (`boundary_imports`, `roadmap_first`, `testing_manifest_alignment`, `adr_on_decision`). Uncomment the ones that match invariants you actually have. Replace the example patterns with yours.
4. When the rule set is settled and your codebase is at the level you want as the floor, set the ratchet baseline:
   ```sh
   node <scaffold>/engine/dist/cli.js ratchet emit --repo-root "$TARGET"
   ```
   From this point, any commit that grows a warning count past baseline fails the ratchet.
5. Add the seeded `.github/workflows/reliability.yml` to your repo or fold its steps into your existing CI.

A worked example with a customized `governance.yaml` and captured audit output lives in [examples/typescript-service](examples/typescript-service/).

## Where to next

- [ARCHITECTURE.md](ARCHITECTURE.md) for the five-layer model, the canonical / emitter pattern, and the dogfood loop.
- [ROADMAP.md](ROADMAP.md) §Vocabulary for the project's internal phase / wave / F-item notation.
- [docs/decisions/0007-universal-rules-ship-enabled.md](docs/decisions/0007-universal-rules-ship-enabled.md) for the rationale behind shipping the Universal Default Set enabled and how to add new universal rules.
- [docs/findings/skill-eval-methodology-2026-05.md](docs/findings/skill-eval-methodology-2026-05.md) for how the skills themselves were validated (and the measurement traps found and corrected).
- [evals/README.md](evals/README.md) for the dedicated public evals repository where the case-study evidence lives.

If the loop did not fire on your planted violation, the troubleshooting order is: (1) confirm `pnpm run build` was green, (2) confirm `engine vitest 21/21` passed, (3) confirm `governance.yaml` was seeded into the target (not the source repo), (4) confirm the planted file lives under `src/**` matching the `tdd_test_first` scope. If still stuck, open an issue with the captured output of each of the four steps above.
