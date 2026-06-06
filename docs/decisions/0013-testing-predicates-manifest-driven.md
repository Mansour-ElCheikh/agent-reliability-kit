# ADR-0013: Testing predicates read test-file shape from the manifest (multi-framework recognition)

**Status:** Accepted
**Date:** 2026-06-04
**Supersedes:** None

## Context

The kit positions itself as tool-agnostic: author discipline once, emit per-tool,
enforce for any stack. The git + testing triangulation (ADR-0012) ran an
adversarial check against that claim for the testing predicates and found it
false as shipped. Verified against `engine/src/predicates.ts`:

- `source_file_has_co_located_test` derived the test path by suffixing `.test`
  before the extension (`:46`), so for `foo.py` it looked for `foo.test.py` —
  never pytest's `test_foo.py` — and flagged a properly-tested pytest source as
  untested.
- `test_file_in_manifest_directory` returned early unless the path matched
  `/\.test\.[a-z]+$/` (`:66`), so a `test_foo.py` was invisible: its placement was
  never checked at all.
- `test_shape_assertions` (`:386`–`:432`) split on `it(` / `test(` and matched
  vitest/jest matchers (`expect(`, `toBeDefined`, `toHaveProperty`, `toEqual`),
  so on a pytest suite (`assert`, `pytest.raises`) it fired on nothing.

The net effect: a pytest adopter got every source file flagged untested, no
manifest-placement enforcement, and no shape-only-assertion check — three
silent failures that directly contradict the tool-agnostic positioning. The
constraint is that the fix must not break the JS/TS behaviour the engine's own
fixtures and tests depend on (the registry is exactly eleven predicates; R2 fires
twice and R3 once on the self-test fixture), and must not add a predicate (ADR-0012
records that no new testing predicate ships).

## Decision

**`testing-manifest.json` is the single source of truth for test-file *shape*.
The three test-file predicates read recognition, co-location, and assertion
vocabulary from it (or from framework-neutral defaults), instead of hard-coding
the JS/TS idiom.** The pre-registered bar: a non-JS/TS project must get real
coverage with zero or minimal hand-config, and the JS/TS behaviour must be
byte-for-byte unchanged. Resolved as three generalisations of the existing
predicates — no new predicate, registry stays at eleven:

1. **Recognition is manifest-driven.** A new optional `testFilePatterns` field
   (array of globs) identifies test files. Absent, it defaults to a
   multi-framework set: JS/TS `*.test.*` / `*.spec.*`, pytest `test_*.py` /
   `*_test.py`, Go `*_test.go`. Both `test_file_in_manifest_directory` (its
   recognition gate) and `source_file_has_co_located_test` (its skip-guard) use
   it, so `test_foo.py` is no longer invisible.

2. **Co-location is a template.** A new optional `coLocation.testPath` field
   templates the source→test path; it defaults to `{dir}/{name}.test.{ext}` (the
   JS/TS sibling). A pytest project that co-locates sets `{dir}/test_{name}.{ext}`.

3. **Assertion vocabulary is per-language.** `test_shape_assertions` selects its
   shape-only / domain-invariant vocabulary from the file extension (`.ts`/`.js`
   → vitest/jest, `.py` → pytest) or an explicit `assertion_style:` rule field. A
   language it has no vocabulary for is skipped, not mis-judged.

Back-compat is preserved exactly: with the defaults, every JS/TS path reproduces
the prior behaviour. The change was driven test-first — forty existing engine
tests stay green (including the self-test fixture's R2×2 / R3×1 counts and the
eleven-predicate registry list), and eight new tests pin the pytest and template
behaviour (`engine/test/predicates.test.ts`, `engine/test/predicates-deweld.test.ts`).

## Consequences

**For the next contributor:** the kit's testing governance is genuinely
multi-framework. A pytest (or Go, or mixed) adopter declares `testFilePatterns`
and `coLocation` once — or relies on the defaults — and the co-located-test,
manifest-placement, and Min-Invariant checks all work on their stack. The
manifest, already the source of truth for *which layers run where*, is now also
the source of truth for *what a test file looks like*.

**Prevents** the credibility failure where a tool-agnostic kit silently mis-fires
on the first non-JS stack an adopter brings — the exact over-claim the
triangulation's adversarial pass caught before release.

**Permits (the cost):** the pytest shape-assertion vocabulary is a newly added
heuristic. It is conservative by construction (it flags a block only when *every*
assertion is shape-only, preferring false-negatives to false-positives, matching
the vitest path's design) and TDD-pinned on representative cases, but it has
**not** yet been swept against a large real pytest corpus the way the vitest
variant was. Adopters should scope `test_invariants` to the directories where
false greens actually bite, and treat the pytest vocabulary as advisory until a
corpus sweep lands (logged as a follow-up). The manifest also gains two optional
fields; projects with no manifest still get the multi-framework defaults.

## What this ADR does *not* do

- Does **not** add a predicate. It generalises the three existing test-file
  predicates; the registry stays at eleven.
- Does **not** change any rule's severity, scope, or enforcement surface, nor the
  Universal Default Set.
- Does **not** validate the pytest assertion vocabulary against a real corpus —
  that sweep is a logged follow-up; until then the pytest path is advisory.
- Does **not** implement R22's "every declared command resolves to a runnable
  script" completeness check (logged in ADR-0012 as a separate enhancement).
- Does **not** touch the non-test predicates, the emitters, the SDLC loop, or the
  conventions (those are ADR-0012).

## Cross-reference

- ADR-0012 (git + testing conventions) — records that no new testing predicate
  ships; this ADR is the engine change that makes that convention's
  framework-neutral claim true.
- ADR-0010 (Min-Invariant re-bind) — `test_shape_assertions` is the predicate
  generalised here.
- `engine/src/predicates.ts` (`source_file_has_co_located_test`,
  `test_file_in_manifest_directory`, `test_shape_assertions`, the shared
  `loadTestingManifest` / `testFilePatterns` / `coLocatedTestPath` helpers);
  `engine/src/types.ts` (`TestingManifest`, `GovernanceRule.assertion_style`).
- `engine/test/predicates.test.ts`, `engine/test/predicates-deweld.test.ts` — the
  red-first tests (8 new) and the preserved back-compat suite.
- `conventions/testing-manifest.json.example`, `conventions/testing.md` — the
  documented manifest schema and the principles it encodes.
