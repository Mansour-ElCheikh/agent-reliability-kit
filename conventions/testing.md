# Testing convention — placement, layers, invariants, safety

`testing-manifest.json` is the single source of truth for *what tests your project ships and where they live*. This document defines the framework-neutral principles that manifest encodes: how a test is recognised, the layer and style taxonomy, what a test must actually assert, and how a destructive test is kept away from production data. None of it presumes a runner. The kit reads your manifest rather than assuming `vitest`, `pytest`, `go test`, or anything else.

The governance engine reads the manifest at three opt-in, stack-neutral checks (ADR-0013): the co-located-test rule (`source_file_has_co_located_test`), the manifest-placement rule (`test_file_in_manifest_directory`), and the Min-Invariant rule (`test_invariants` / `test_shape_assertions`).

---

## 1. Recognising and placing tests

A project declares, in `testing-manifest.json`:

- **`commands`** — each test command, the `layer` it covers, its `style` (below), and the path `scope` it owns.
- **`testFilePatterns`** — the globs that identify a test file. Omit it to use the built-in multi-framework default (JS/TS `*.test.*` / `*.spec.*`, pytest `test_*.py` / `*_test.py`, Go `*_test.go`); narrow or extend it for your stack. The engine recognises whatever you declare, so a `test_scan.py` is no longer invisible to governance.
- **`coLocation.testPath`** — the source→test path template for the co-located-test rule. Default `{dir}/{name}.test.{ext}` (the JS/TS sibling layout). A pytest project that co-locates sets `{dir}/test_{name}.{ext}`.

Two placement strategies; pick the one your project uses:

- **Co-location** — the test sits beside its source (`src/foo.ts` + `src/foo.test.ts`; or `pkg/scan.py` + `pkg/test_scan.py`). Enable `source_file_has_co_located_test`; the template above tells it where to look.
- **Declared directory** — tests live in a separate tree (`tests/`, `integration/`). Enable `test_file_in_manifest_directory`; every recognised test file must fall inside some command's `scope`.

Either way the invariant is the same: **every source unit has a test the manifest can find.** A project that keeps tests in a separate tree should rely on manifest-placement and leave the co-location rule off, rather than bending the template.

---

## 2. The three styles

`testing-manifest.json` tags each layer with a `style:`. The terminology matters because a test written at the wrong style for its layer produces false confidence: white-box tests that pass on implementation coincidence, or black-box tests that catch nothing because they only assert presence.

### `white-box` — tests that know internals

**Covers:** module-level logic, individual functions, pure transformations; edge cases at the smallest unit boundary; exact outputs for given inputs (concrete invariants, not shape-only assertions).

**Where they live:** typically co-located with source. The manifest declares the actual path; a co-location template or a declared `unit` scope both work.

**Examples (any runner):**

- a parser returns the exact parsed structure for a known input
- a capability resolver returns the exact degradation list for a given spec

**When to use:** the default for module-level logic. Fast feedback, cheap to write and maintain.

**Constraint:** white-box tests assert on internal structure, so a behaviour-preserving refactor that changes internals breaks them. That is a feature (it catches accidental behavioural drift) but it adds friction; counter-balance with black-box layers.

### `black-box` — tests that only see the public seam

**Covers:** cross-module wiring (integration); user-visible behaviour through the actual product surface (end-to-end); public-API contracts.

**Where they live:** outside the source tree. Typical declared scopes: `integration/`, `e2e/`, `test/contract/`.

**Examples:** drive the real CLI, public API, or UI and assert on the observable result (stdout, response body, rendered output) without importing internal modules.

**When to use:** once multiple modules collaborate, integration tests pay back their cost; anything that ships to a user wants an end-to-end test of the surface they actually touch; public-API code is defined by its black-box contract.

**Critical rule:** a black-box test must not import internal modules. If it needs to, the seam it is testing is not a real seam — fix the seam first.

### `static` — no runtime assertions

**Covers:** type checks, lint and format gates, schema validation, structural/governance rules.

**Examples:** a type-checker run with no emit; a structural gate over a directory of authored files (the kit runs its own `check:anatomy` over `canonical/skills/`); the governance engine audit pass.

**When to use:** always. Static checks are the cheapest layer and catch whole classes of error before any test runs.

**Constraint:** they do not catch behavioural bugs. A type-correct function that returns the wrong answer is invisible to static analysis; compose static with white-box and black-box.

---

## 3. Tests must assert a concrete invariant (Min-Invariant)

A test that asserts only *shape* — that a value exists, is an array, is truthy, is not null — passes whenever the code returns the right *type*, even when it returns the wrong *answer*. That is a false green. Every test asserts at least one **concrete domain invariant**: a value, a count, a threshold, a named field, or an expected error.

- JS/TS: `expect(scan(dir)).toHaveLength(3)`, not `expect(scan(dir)).toBeDefined()`
- pytest: `assert len(scan(dir)) == 3`, not `assert scan(dir) is not None`

The `test_invariants` rule (`test_shape_assertions`, ADR-0010) flags a test block whose assertions are all shape-only. Its assertion vocabulary is chosen per file — vitest/jest for `.ts`/`.js`, pytest for `.py` — or forced with `assertion_style:` (ADR-0013). It is conservative by design (it fires only when *every* assertion in a block is shape-only, to keep the false-positive rate low), opt-in, and adopter-scoped to the test directories where false greens actually bite. A language it has no vocabulary for is skipped, not mis-judged; the pytest vocabulary is newly added and not yet swept against a large real corpus, so scope it deliberately. The same discipline applies one step earlier as the Min-Invariant column on `tasks.md` (`min_invariant_per_task`): the plan names the concrete assertion before the test is written.

---

## 4. Guard destructive tests against production data

Some tests must touch real side-effecting infrastructure — a database, a filesystem, a live account. A test that wipes or writes must never be able to reach production data, however the environment is misconfigured. The principle, stated without prescribing any one stack's mechanism:

1. **Physical isolation.** The destructive test runs against a dedicated, disposable target — a throwaway schema, a temp directory, a sandbox account — never a shared or production one.
2. **Fail-fast refusal.** Before any destructive step, the harness asserts the target is the isolated one and *refuses to run* if the config looks production-pointed (a known production-host fragment, a missing isolation marker). A refused destructive test is a passed safety check, not an error to suppress.
3. **Assert the target before the operation.** The destructive call is immediately preceded by an assertion naming the expected target (the schema, the path, the account), so a misroute fails on the assertion rather than on the data.

This principle is derived from a single production-wipe incident in one of the source projects, not from broad cross-project practice. It is documented because the failure mode is severe and the mitigation is cheap — not because it is universally battle-tested. The mechanism (a connection guard, an environment assertion, a fixture that refuses) is the adopter's; the kit ships **no predicate** for it, because the check is runtime fixture behaviour an engine cannot read from a static diff.

---

## 5. Composition: surface → minimum layers

`testing-manifest.json` declares per-surface minimum layers, so adding a feature that touches a surface refuses to ship until those layers run green:

| Surface | Minimum layers | Implied styles |
|---|---|---|
| `core` (internal modules) | `[unit]` | white-box |
| `publicApi` (library exports) | `[unit, integration]` | white-box + black-box |
| `userFacing` (UI, CLI) | `[unit, integration, e2e]` | white-box + 2× black-box |

Each style catches a different class of bug — white-box the inner logic, integration the wiring, end-to-end the surface — so skipping a style leaves a known blind spot.

---

## 6. What this means for an agent

- The default style for an agent writing a test is **white-box** at the unit layer: co-located (or in the declared unit scope), fast, with a concrete invariant.
- For integration and end-to-end layers the agent must switch style deliberately: no importing internal modules in a black-box test, no asserting on private state.
- If writing a black-box test reaches for internals, the seam is wrong — surface the seam-design problem before writing the test.
- The `style:` declaration in `testing-manifest.json` is the authority; a test whose style violates its layer declaration is a finding for the `review` skill to catch.

---

## Cross-reference

- [`testing-manifest.json.example`](./testing-manifest.json.example) — the manifest schema this document defines styles and recognition for.
- [`git-workflow.md`](./git-workflow.md) §8 — the test gate that guards the trunk (no change merges until its test command passes).
- [ADR-0010](../docs/decisions/0010-min-invariant-governed-rule.md) — the Min-Invariant rule binding; [ADR-0013](../docs/decisions/0013-testing-predicates-manifest-driven.md) — manifest-driven, multi-framework recognition.
- [`canonical/skills/build.md`](../canonical/skills/build.md) — RED → GREEN → REFACTOR; [`canonical/skills/review.md`](../canonical/skills/review.md) — the final-gate test-quality check (styles match their layer declaration).
- Engine predicates: `source_file_has_co_located_test`, `test_file_in_manifest_directory`, `test_shape_assertions` (`engine/src/predicates.ts`).
