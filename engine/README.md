# Rules engine

Governance evaluator. Implements the rule contract in [ADR-0002](../docs/decisions/0002-governance-yaml-shape.md) + [canonical/governance-rule.schema.md](../canonical/governance-rule.schema.md). Three jobs: write-time hook backend, commit-time / CI audit, ratchet baseline.

## Requirements

- Node 20+
- pnpm 9+ (`corepack enable`, then `pnpm install` from scaffold root)

Build: `pnpm -F @reliability-scaffold/engine build` → `dist/cli.js`.

## CLI

```sh
scaffold-engine audit   [--config <path>] [--format json|toon] [--staged] [--repo-root <path>]
scaffold-engine hook    [--config <path>] [--repo-root <path>]
scaffold-engine ratchet emit    [--config <path>] [--repo-root <path>]
scaffold-engine ratchet update  [--config <path>] [--repo-root <path>]
scaffold-engine predicates list
```

Invoke via `node engine/dist/cli.js <subcommand>` or the `scaffold-engine` bin after `pnpm install`.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Clean (no errors; warnings within ratchet baseline) |
| 1 | Error-severity findings present |
| 2 | Ratchet exceeded (a warn count grew past baseline) OR hook blocked a write |
| 3 | Usage error |
| 4 | Engine internal error (unregistered predicate, malformed governance.yaml) |

## Subcommands

### `audit`

Loads `governance.yaml`, discovers in-scope files (git ls-files, or a filesystem walk in a fresh / non-git tree), evaluates each file against every `enforcement: [engine]` rule, aggregates findings, compares warn-counts against the ratchet baseline. Writes both a human summary (stdout) and a machine report to `.scaffold/audit-report.<ts>.<json|toon>`.

`--format json` (default) — for CI dashboards, `jq`, GitHub Actions, Slack webhooks.
`--format toon` — RepoNav's compact Token-Oriented Object Notation. Materially smaller than JSON on the repetitive findings array; for adopters feeding audit context back into an LLM prompt.

`--staged` — evaluate only git-staged files (pre-commit use on Tier 2/3 tools).

### `hook`

Reads a PreToolUse JSON payload on stdin (`{ tool_name, tool_input: { file_path, content } }`, tolerant of Copilot's field variants). Evaluates the proposed write against `enforcement: [hook]` rules. Exit 0 = allow, exit 2 = block (reason on stderr). Only `error`-severity findings block a write; `warn`/`audit` are recorded by the audit pass + ratchet, not the write-time gate.

Tier 1 (Claude Code, Copilot agent) wire this as a PreToolUse hook on Write/Edit. Tier 2/3 tools have no write-time hook surface; they run `audit --staged` at git pre-commit instead (ADR-0004 automatic degradation).

### `ratchet emit` / `ratchet update`

`emit` writes an initial `.governance-baseline.json` from current warn-counts. `update` rewrites it to the current counts (run after a passing audit, as its own commit). Never auto-updates — the ratchet stays under explicit control. See [governance/RATCHET.md](../governance/RATCHET.md).

### `predicates list`

Lists registered predicates (11 built-in + any adopter extensions).

## Built-in predicates

| Predicate | Rule it backs | Reads |
|---|---|---|
| `roadmap_reference_in_commit_message` | R1 (roadmap-first) | HEAD commit message |
| `source_file_has_co_located_test` | R2 (tdd_test_first) | file existence (manifest `coLocation.testPath`, default sibling `*.test.*`) |
| `test_file_in_manifest_directory` | R3 | `testing-manifest.json` (`testFilePatterns` + declared scopes) |
| `boundary_imports` | R4 | file content (import statements) |
| `decision_keyword_without_adr` | R5 (adr_on_decision) | HEAD commit message + new ADR files |
| `prompt_size_warn` | R26 (skill_anatomy_size) | file byte size vs `warn_bytes` / `max_bytes` |
| `no_secrets` | safety (ADR-0007) | file content (credential-shape regex) |
| `scope_containment` | universal (ADR-0007) | changed file paths vs `protected_paths` |
| `doc_validity` | universal (ADR-0007) | YAML frontmatter (`validity` + `as_of` + `expires_after_days`\|`expires`) |
| `tasks_min_invariant` | min_invariant_per_task (R21, ADR-0010) | `tasks.md` Min-Invariant column |
| `test_shape_assertions` | test_invariants (R20, ADR-0010) | test file (assertion vocabulary by extension, ADR-0013) |

## Adopter-extension predicates

Drop a `<name>.predicates.{js,mjs}` file in `engine/extensions/`. Every exported function is registered as a predicate under its function name; reference it via a rule's `check:` field. See [extensions/README.md](./extensions/README.md). v0.1 is TS/JS-only (F12); wrap shell-outs in a JS predicate via `child_process` if you need another language.

## Self-test

```sh
pnpm -F @reliability-scaffold/engine test
```

Runs `test/audit.test.ts` (vitest) against `test/fixtures/` — a project deliberately constructed to trigger R2 ×2, R3 ×1 (error), R4 ×1 (error), R26 ×1 (warn), plus ratchet emit / exceeded / ratchet-down and TOON-grammar assertions. Asserts on the returned report object (no timestamp normalisation needed). CI runs this on every push.
