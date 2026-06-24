# ADR-0026: Layout-agnostic test-existence predicate (source_file_has_test)

**Status:** Accepted
**Date:** 2026-06-23
**Supersedes:** None

## Context

The kit shipped two test-discipline predicates and neither enforces the most common case: "every source file has a test" under a **central** test layout.

- `source_file_has_co_located_test` requires a *sibling*: it fills the template `{dir}/{name}.test.{ext}` anchored to the **source** directory (`engine/src/predicates.ts`). It structurally cannot match a test that lives under a different root, e.g. `engine/src/gate.ts` tested by `engine/test/gate.test.ts`.
- `test_file_in_manifest_directory` checks test **location** (test files sit in declared dirs); it never asks whether a given source file *has* a test.

So a project that keeps tests in a central directory (`test/`, `__tests__/` — what most TS/JS projects, including this kit, actually do) had no shipped predicate for source-test existence. This was surfaced on 2026-06-23 when the kit first dogfooded its own governance (`governance.yaml`): it had to *exclude* its own co-located rule because the kit uses `engine/test/`, which exposed the gap in the kit's own value proposition ("we enforce test discipline").

## Decision

Add `source_file_has_test`, a **layout-agnostic** test-existence predicate (registry 12 to 13).

For a source file in scope, it requires a test discoverable **by name** among the in-scope test files (`context.allInScopeFiles`), wherever they live: co-located (`foo.ts` + `foo.test.ts`), a central dir (`engine/src/gate.ts` + `engine/test/gate.test.ts`), pytest (`test_foo.py`), or Go (`foo_test.go`). Test-file recognition reuses the ADR-0022 manifest `testFilePatterns` (multi-framework), defaulting to the JS/TS + pytest + Go set.

It **subsumes** `source_file_has_co_located_test` (a sibling test is found in scope) and **pairs** with `test_file_in_manifest_directory`: together they give "every source has a test" + "tests live where declared". The match is name-derivation only; it confirms a test *exists*, not that it exercises the source's behavior (that is the `test_shape_assertions` / Min-Invariant concern).

## Consequences

- The kit can now self-enforce test-existence on its central layout: `governance.yaml` drops the documented co-located exclusion and applies `source_file_has_test` to its own `engine/src` / `scripts/src`.
- Adopters with a central test layout get a test-existence floor they previously lacked, without being forced onto the co-located convention.
- **Prevents:** a new source file shipping with no test under a central layout (previously invisible to every shipped predicate).
- **Permits:** a false pass if an unrelated test happens to share the source's basename, and it cannot tell a real test from a stub. Mitigated by the basename-derivation match and `exclude_patterns` for type-only / barrel / entrypoint files that legitimately carry no unit test.

## What this ADR does *not* do

- It does not verify the test actually imports or exercises the source (no coverage or import-graph analysis); existence, not linkage.
- It does not deprecate `source_file_has_co_located_test`; the strict-sibling form stays for projects that mandate co-location.
- It does not change the Universal Default Set. Test *location* (co-located vs central) is a project choice, so `source_file_has_test` ships as a built-in available to project-specific rules, not as a new universal floor. Reclassifying the Universal Set's test rule is a separate ADR-0007 amendment.

## Cross-reference

- ADR-0010 (Min-Invariant binding), ADR-0022 (manifest-driven multi-framework test recognition), ADR-0007 (Universal Default Set).
- `engine/src/predicates.ts` (`source_file_has_test` + registry), `engine/test/predicates.test.ts` (8 cases), `engine/test/audit.test.ts` (registry list 13).
- The kit's own `governance.yaml` self-application; surfaced by the 2026-06-23 self-governance dogfood.
