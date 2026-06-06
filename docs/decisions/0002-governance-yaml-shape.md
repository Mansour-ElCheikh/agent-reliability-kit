# ADR-0002: Governance YAML shape — rule contract

**Status:** Accepted
**Date:** 2026-05-17
**Supersedes:** None
**Extended by:** ADR-0007 (2026-05-19) — adds the top-level `profile` and the rule markers `universal` / `ramp_to_error_on_team` / `safety` / `protected_paths`. This ADR's base contract is unchanged; the additions are documented in `canonical/governance-rule.schema.md`.

## Context

The governance engine layer needs a stable rule contract. Rules are written by adopters, evaluated by hooks, indexed by audit scripts, and cited by ADRs. If the shape drifts mid-project, every downstream piece breaks; if it is over-specified up-front, adopters cannot extend it.

The shape needs to:

1. Be readable as a flat list at scale (50+ rules in a mature project).
2. Carry severity (block / warn / record-only) explicitly per rule.
3. Be evaluable by either a shell hook (write-time) or a heavier audit engine (commit-time, CI-time) using the same definition.
4. Make scope (which paths a rule applies to) declarative, not encoded in predicate logic.
5. Allow numbering to be preserved across refactors so a rule called `R7` in 2026 is still `R7` in 2028.

## Decision

Adopt the following YAML rule contract. Each rule is one mapping with these required keys:

```yaml
rules:
  - id: R7_jsdoc_on_exports          # unique, never reused; convention <Rnumber>_<snake_lower>
    severity: warn                   # error | warn | audit
    description: Exported functions must have JSDoc
    enforcement: [hook, engine]      # which surfaces evaluate this rule
    check: jsdoc_on_exports          # named predicate (resolved by host engine)
    scope: "src/**"                  # glob; whitespace = "everywhere"
    # optional:
    approved_files: []               # whitelist that bypasses the check
    exclude_patterns: []             # patterns within scope to skip
```

Top-level keys:

```yaml
version: "1.0"
project: <slug>
mode:
  default: enforce                   # enforce | advisory
scope:
  include: ["src/**", "docs/**"]
  exclude: ["node_modules/**", "dist/**"]
rules: [ ... ]
```

Severity semantics:

- `error` — hook blocks Edit/Write; commit fails CI.
- `warn` — hook lets the change through but counts the warning; ratchet refuses commits that grow the count beyond baseline (see `RATCHET.md`).
- `audit` — record-only; surfaces in reports, never blocks.

## Consequences

- **Hook + engine share one source of truth.** A rule defined once is evaluated by both surfaces. The `enforcement: [hook, engine]` field declares which evaluators see it.
- **Numbering convention.** New rules get the next free integer prefix; numbers retire when a rule is removed but are never reused. A `superseded_by:` field is reserved for future use.
- **Predicate names are external.** `check: jsdoc_on_exports` resolves to a predicate registered in the host engine; the scaffold does not ship predicate implementations. Adopters wire their own (a few lines of shell or whatever language the engine speaks).
- **Scope is glob-driven.** Scope inclusion at the top level filters everything; per-rule `scope` further narrows. `approved_files` / `exclude_patterns` punch holes.
- **What this prevents:** rule definitions splitting across formats (one for the hook, another for CI) and drifting.
- **What this newly permits:** the ratchet — a single, comparable warning count over time, because every warning is named by a stable rule id.

## What this ADR does *not* do

- Does **not** specify the predicate implementations. `check: jsdoc_on_exports` is a name; the resolver is the host engine's job.
- Does **not** mandate the hook's shell language. `governance/hook.example.sh` is one shape; adopters using PowerShell or Python or a compiled binary swap freely.
- Does **not** specify the ratchet's storage format. Tracked separately in `governance/RATCHET.md`.

## Cross-reference

- governance/governance.yaml.example (the canonical example)
- governance/hook.example.sh (the PreToolUse hook shape)
- governance/RATCHET.md (the ratchet operation)
- ADR-0001 (scaffold charter — what ships, what does not)
