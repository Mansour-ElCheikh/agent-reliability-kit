# Sample audit output: a planted violation, caught

This document captures **verbatim output** from running the governance engine against a freshly bootstrapped target project on 2026-05-20. The point is to show, concretely, what an adopter sees when a rule fires.

The captured run mirrors what [ONBOARDING.md](../../ONBOARDING.md) walks you through. If you follow the onboarding steps, you should see output identical in shape to what is shown below; if not, the engine or this example has drifted, which is itself a signal worth reporting.

## Setup

A fresh empty target directory was bootstrapped with the Claude Code emitter:

```sh
TARGET=$(mktemp -d)
mkdir -p "$TARGET/.claude"
node $(pwd)/scripts/dist/scaffold.js --target "$TARGET" --mode bootstrap
```

Bootstrap output (captured verbatim):

```
Scaffold — target: <TARGET>
  Mode: bootstrap
  Emitters: claude-code

→ claude-code
Emit report: <TARGET>/.scaffold/emit-report.claude-code.2026-05-20T11-58-57Z.md

Seeded team-shared files: governance.yaml, docs/decisions/template.md,
testing-manifest.json, conventions/testing.md, conventions/git-workflow.md,
conventions/sandbox.md, conventions/memory-protocol.md, conventions/session-harvest.md,
conventions/verification.md, eslint.config.mjs, .prettierrc.json,
.prettierignore, .github/workflows/reliability.yml

The governance engine is installed but the ratchet baseline is not set.
Skipped. When ready: node <scaffold>/engine/dist/cli.js ratchet emit --repo-root .

Scaffold complete.
```

## Planted violation

A new TypeScript source file was placed under `src/` with no co-located test:

```sh
cat > "$TARGET/src/calculator.ts" <<'EOF'
export function add(a: number, b: number): number {
  return a + b;
}
EOF
```

The `tdd_test_first` rule (part of the Universal Default Set, ADR-0007) expects any new `src/**/*.ts` to have a co-located test sibling. There is none here.

## Audit run

```sh
node $(pwd)/engine/dist/cli.js audit \
  --config "$TARGET/governance.yaml" \
  --repo-root "$TARGET" \
  --format json
```

Captured output:

```
Governance audit — my-project
  0 error(s), 1 warning(s), 0 audit-only
  Per-rule:
    tdd_test_first: 1
  RATCHET EXCEEDED — these rules grew past baseline:
    tdd_test_first: 0 → 1 (+1)
Report: <TARGET>/.scaffold/audit-report.2026-05-20T11-58-57-587Z.json
```

What this output says, line by line:

- `0 error(s), 1 warning(s), 0 audit-only`: one finding at warning severity. Because the seeded `governance.yaml` ships under `profile: solo`, universal rules emit at `warn`. Under `profile: team` this same finding would be `error` and would block the write.
- `Per-rule: tdd_test_first: 1`: which rule fired and how often.
- `RATCHET EXCEEDED`: the ratchet's recorded baseline for `tdd_test_first` was `0`; this run has `1`. Existing warnings would have been grandfathered; this is a *new* one.
- `Report: ...audit-report...json`: structured findings written to `.scaffold/` (gitignored).

The same audit in TOON format (the compact LLM-context shape):

```sh
node $(pwd)/engine/dist/cli.js audit \
  --config "$TARGET/governance.yaml" \
  --repo-root "$TARGET" \
  --format toon
```

Lands at `.scaffold/audit-report.<timestamp>.toon`. Same findings, different serialization, optimized for feeding back into an LLM context window without burning tokens.

## What the same violation would look like under this example's `governance.yaml`

This example switches the seeded config to `profile: team`. Under that profile, `tdd_test_first` ramps from `warn` to `error`. The same audit run would emit:

```
Governance audit — example-typescript-service
  1 error(s), 0 warning(s), 0 audit-only
  Per-rule:
    tdd_test_first: 1
  RATCHET EXCEEDED — these rules grew past baseline:
    tdd_test_first: 0 → 1 (+1)
```

And the wired hook would **block the write** instead of allow-and-count. That is the team-vs-solo profile distinction in concrete terms: discipline becomes enforcement when the team agrees.

## What is missing from this example

- This is a shape example: the directory does not contain runnable application code. A reader who wants to verify the audit run end-to-end should follow [ONBOARDING.md](../../ONBOARDING.md), which uses `mktemp -d` to set up a fresh target and runs the same flow.
- The two project-specific rules in this example's `governance.yaml` (`boundary_imports`, `roadmap_first`) are not exercised in the captured run because the planted violation is a `tdd_test_first` case. To see them fire, plant an import-boundary violation or commit to `src/api/**` without a roadmap reference.
- The `.scaffold/` outputs are not committed (they are gitignored by convention).
