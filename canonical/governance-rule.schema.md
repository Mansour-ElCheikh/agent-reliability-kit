# Canonical governance rule schema v1

**spec_version:** 1
**Formalises:** ADR-0002 (Governance YAML shape)
**Extended by:** ADR-0007 (Universal Default Set: top-level `profile`; rule markers `universal` / `ramp_to_error_on_team` / `safety` / `protected_paths`)
**Consumed by:** the rules engine (S6.3), every per-tool emitter that wires governance into a tool's hook surface, and every audit script that reads `governance.yaml`.

This document specifies the **field contract** for entries in `governance.yaml`. Every rule a project authors against this schema is portable across the three enforcement tiers without re-authoring.

---

## Top-level shape

```yaml
schema_version: 1
project: <slug>

profile: solo               # solo | team   (ADR-0007; default solo)

mode:
  default: enforce          # enforce | advisory   (legacy; profile is primary)

scope:
  include: [<glob>, ...]
  exclude: [<glob>, ...]

rules:
  - <rule entry>
  - ...
```

### Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schema_version` | integer | yes | Schema version this file conforms to. v1 is current. |
| `project` | string | yes | Project slug. Used in reports. |
| `profile` | enum | no | ADR-0007. `solo` (default) keeps universal rules at their authored severity (warn = non-blocking) with an advisory ratchet; `team` ramps `ramp_to_error_on_team` warn rules to error and enforces the ratchet. `safety` rules ignore this. |
| `mode.default` | enum | no | `enforce` (default; rules fire as severity says) / `advisory` (all rules degrade to audit-only). Legacy knob; `profile` is the primary control. |
| `scope.include` | array of glob strings | yes | Paths the engine considers in-scope. Empty array = empty scope (engine does nothing). |
| `scope.exclude` | array of glob strings | no | Paths inside `scope.include` to skip. Default empty. |
| `rules` | array of rule entries | yes | The rules themselves. May be empty during initial bootstrap. |

---

## Rule entry shape

```yaml
- id: <Rnumber>_<snake_lower>
  severity: error | warn | audit
  description: <human-readable one-liner>
  enforcement: [hook, engine]
  check: <predicate name>
  scope: <glob>            # optional; defaults to top-level scope
  status: active           # optional; active | experimental | deprecated
  spec_version: 1          # optional; defaults to schema_version
  approved_files: [...]    # optional; whitelist that bypasses check
  exclude_patterns: [...]  # optional; patterns inside scope to skip
  <predicate-specific fields>
```

### Rule fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique. Convention: `<Rnumber>_<snake_lower_name>` (e.g. `R7_jsdoc_on_exports`). Numbers never reused. |
| `severity` | enum | yes | `error` (block) / `warn` (allow + count toward ratchet) / `audit` (record only) |
| `description` | string | yes | One-line human description. Used in reports + emit output. |
| `enforcement` | array of enum | yes | Subset of [`hook`, `engine`, `audit`]. Declares which evaluator surfaces evaluate this rule. |
| `check` | string | yes | Named predicate. Resolved by the engine's predicate registry at evaluation time. |
| `scope` | glob string | no | Narrows the top-level scope to a subset for this rule. Default: top-level scope. |
| `status` | enum | no | `active` (default) / `experimental` (run but mark output) / `deprecated` (skip, log warning) |
| `spec_version` | integer | no | Per-rule schema version override; defaults to top-level `schema_version` |
| `approved_files` | array | no | Whitelist of file paths that bypass this rule's predicate |
| `exclude_patterns` | array | no | Glob patterns within scope this rule skips |
| `universal` | boolean | no | ADR-0007. Marks membership in the Universal Default Set (informational + ties to the profile ramp). |
| `ramp_to_error_on_team` | boolean | no | ADR-0007. Under `profile: team`, a `warn` finding from this rule is raised to `error` (the soft-start ramp). No-op under `solo`. |
| `safety` | boolean | no | ADR-0007. Safety rule (e.g. `no_secrets`). Always `error`; never downgraded by `advisory` mode or the `solo` profile. |
| `protected_paths` | array of glob strings | no | `scope_containment` predicate input: touching a path that matches is a finding (the universal "change only what you were asked to"). |

### Predicate-specific fields

Rules may carry additional fields specific to their predicate:

```yaml
# Example: boundary-import predicate
- id: R4_boundary_import_isolation
  ...
  check: boundary_imports
  forbidden_import_patterns: ["^vscode$"]
  approved_files: ["src/extension.ts"]
```

Predicate-specific fields documented per predicate (synced with `engine/src/predicates.ts` as of v0.1.3-dev):

| Predicate | Predicate-specific fields | Notes |
|---|---|---|
| `boundary_imports` | `forbidden_import_patterns: [regex]`, `approved_files: [glob]` | A file matching `scope` that imports a `forbidden_import_patterns` regex is a finding, unless it matches an `approved_files` glob |
| `prompt_size_warn` | `warn_bytes: integer`, `max_bytes: integer` | File-size predicate; warns at `warn_bytes`, errors at `max_bytes` regardless of declared severity |
| `doc_validity` | `file_patterns: [glob]` | Targets only files matching `file_patterns`; checks for `validity` + `as_of` + (`expires_after_days` \| `expires`) keys in YAML frontmatter |
| `scope_containment` | `protected_paths: [glob]` (also in the top-level rule fields table) | A change touching any path matching `protected_paths` is a finding (the universal "change only what you were asked to") |
| `no_secrets` | (none beyond `exclude_patterns`) | Pattern scan for known credential shapes (AWS, GitHub PAT, etc.); the canary fixtures in `engine/test/audit.test.ts` are deliberate test inputs |
| `source_file_has_co_located_test` (conventional rule id: `tdd_test_first` / `R2`) | (none beyond `exclude_patterns`) | A new source file matching `scope` must have a co-located test sibling |
| `test_file_in_manifest_directory` | (read from `testing-manifest.json`) | Tests must live in directories declared in the manifest |
| `roadmap_reference_in_commit_message` | (none) | Commit message touching files in `scope` must reference a roadmap item or ADR id |
| `decision_keyword_without_adr` | (none) | A commit whose message uses decision language (`decided`, `chose`, etc.) without a new ADR in the diff is a finding |
| `tasks_min_invariant` (rule `min_invariant_per_task`, ADR-0010) | `file_patterns: [glob]`, `forbidden_invariant_values: [str]` | A tasks.md Min-Invariant cell that is empty or a shape word (`array`/`object`/`defined`) is a finding; defaults to RepoNav's R21 list |
| `test_shape_assertions` (rule `test_invariants`, ADR-0010) | (none beyond `scope`) | An it()/test() block whose assertions are all shape-only (no domain invariant) is a finding; opt-in / advisory |
| `userfacing_integration_layer` (rule `userfacing_integration_layer`, ADR-0016) | `scope: testing-manifest.json`, `file_patterns: [route globs]` | SELF-SCOPING: if route/page files exist but the manifest declares no `integration`/`e2e` layer, it is a finding; no routes = no-op (CLIs/libs/analyzers exempt). Gates that the layer is declared, never UX/taste |

Example (Min-Invariant predicate, ADR-0010):

```yaml
- id: min_invariant_per_task
  ...
  check: tasks_min_invariant
  file_patterns: ["dev/epics/**/tasks.md"]
  forbidden_invariant_values: ["array", "object", "defined"]   # optional; overrides defaults
```


---

## Severity semantics

| Severity | Hook behaviour | Engine behaviour | Ratchet effect |
|---|---|---|---|
| `error` | Block the Edit/Write tool call (exit nonzero) | Fail audit run; exit nonzero | N/A (errors don't accumulate; they block) |
| `warn` | Log + allow the tool call | Record in findings | Counted toward ratchet baseline; refuses commits that increase the count |
| `audit` | No-op at hook time | Record only in audit report | Not counted toward ratchet |

---

## Enforcement surfaces

`enforcement: [hook, engine, audit]` declares which evaluators see the rule:

- `hook` — write-time evaluator (PreToolUse on Claude Code / Copilot agent; git pre-commit on Tier 2/3). If the rule's `check` predicate is too expensive for write-time (e.g. requires walking the entire codebase), DROP `hook` from the array.
- `engine` — full audit-run evaluator (invoked manually or by CI). Always available regardless of tier.
- `audit` — record-only evaluator (informational; runs alongside `engine`)

A rule may declare multiple surfaces; the engine evaluates each declared surface independently.

---

## Three-tier enforcement compatibility

Per ADR-0004 (S6.2 territory):

| Tier | What rules degrade to |
|---|---|
| 1 | All severities + all enforcement surfaces work natively |
| 2 | `enforcement: [hook]` rules degrade to commit-time gate (git pre-commit); `severity: error` blocks commit instead of write |
| 3 | All rules degrade to advisory; `severity: error` becomes warn at commit-time; no write-time blocking |

This degradation is **automatic** based on the target tool's `tool-capabilities.yaml` entry. Rule authors don't write tier-specific logic.

---

## Examples

### Minimal rule (audit-only)

```yaml
- id: R10_roadmap_first
  severity: audit
  description: Commits touching public surfaces should reference a roadmap item.
  enforcement: [engine]
  check: roadmap_reference_in_commit_message
  scope: "src/**"
```

### Boundary rule (error severity)

```yaml
- id: R1_boundary_imports
  severity: error
  description: Only approved files may import the platform-specific API.
  enforcement: [hook, engine]
  check: boundary_imports
  scope: "src/**"
  forbidden_import_patterns: ["^vscode$"]
  approved_files:
    - "src/extension.ts"
    - "src/VSCodeWorkspaceAdapter.ts"
  exclude_patterns: ["**/*.test.ts"]
```

### Test-alignment rule (warn severity with ratchet)

```yaml
- id: R2_test_alignment
  severity: warn
  description: New source files require a co-located test file.
  enforcement: [hook, engine]
  check: source_file_has_co_located_test
  scope: "src/**/*.ts"
  exclude_patterns:
    - "src/**/*.config.ts"
    - "src/extension.ts"
```

### Min-Invariant rule (SDLC-methodology, opt-in — ADR-0010)

Restores RepoNav's R21 (`tasks_min_invariant`) and R20 (`test_shape_assertions`) binding so the `plan` / `build` / `review` skills and the engine share a rule id. Ships opt-in (not in the Universal Default Set — it presupposes the epic/`tasks.md` convention), advisory, engine-surface only. Efficacy mechanism measured on a pilot (eval B: 100% to 0% false-green slip-through on the shape-preserving class, `docs/findings/eval-min-invariant-ab-2026-06.md`); base-rate sweep over real diffs pending.

```yaml
- id: min_invariant_per_task
  severity: warn
  description: Every tasks.md task row carries a concrete Min-Invariant, not a shape word.
  enforcement: [engine]
  check: tasks_min_invariant
  file_patterns: ["dev/epics/**/tasks.md"]

- id: test_invariants
  severity: warn
  description: Test blocks need a domain invariant, not only shape-only assertions.
  enforcement: [engine]
  check: test_shape_assertions
  scope: "src/**/*.test.ts"
```

---

## Versioning

This schema is **v1**. Bump rules mirror the emitter contract's:

- Patch: clarifications. No `schema_version` change required.
- Minor: new optional rule fields. Existing rule files keep parsing; new ones may use the additions.
- Major: any change that breaks parsing of existing `governance.yaml` files. Requires ADR.

When `schema_version` bumps, the engine handles both versions through one release cycle, then drops the older version in the next release.

---

## What this schema does NOT specify

- Implementation of predicates (`check: <name>` resolves to engine-registered functions; not specified here)
- Ratchet state file format (specified in `governance/RATCHET.md`)
- Hook implementation (per-tool; specified in emitter contract)
- Engine evaluation order (engine's choice, must be deterministic; per S6.3's engine ADR if needed)

---

## Cross-reference

- ADR-0002 (Governance YAML shape — the original ADR; this schema formalises it)
- ADR-0003 (Canonical spec format — pending S6.1 author)
- ADR-0004 (Three-tier enforcement — pending S6.2)
- `canonical/emitter-contract.md`
- `canonical/tool-capabilities.yaml`
- `governance/RATCHET.md`
