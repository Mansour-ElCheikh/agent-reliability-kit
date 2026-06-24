# Test layers — white-box / black-box / static

`testing-manifest.json` declares the test layers a project ships. Each layer carries a `style:` declaration. This document defines what each style covers, when to use it, and how the layers compose.

The terminology matters because tests written at the wrong style for their layer produce false confidence: white-box tests that pass because of implementation coincidence; black-box tests that catch nothing because they only assert presence.

---

## The three styles

### `white-box` — tests that know internals

**What they cover:**
- Module-level logic, individual functions, pure transformations
- Edge cases at the smallest unit boundary
- Exact outputs for given inputs (concrete invariants, not shape-only assertions)

**Where they live (convention):** co-located with source. `src/foo.ts` → `src/foo.test.ts`. Adopters can move tests to a sibling `__tests__/` dir; the manifest declares the actual path.

**Examples:**
- `expect(parseFrontmatter(text)).toEqual({ name: 'audit', spec_version: 1 })`
- `expect(resolveCapabilities(spec, caps).degradations).toEqual([['hook_intercept', 'commit_time_gate']])`

**When to use:** the default for any module-level logic. Fast feedback (vitest in watch mode), easy to write, cheap to maintain.

**Constraint:** white-box tests assert on internal state. Refactors that don't change behaviour but DO change internal structure break them. That's a feature (catches accidental behavioural drift via implementation change) but adds friction. Counter-balance with black-box layers.

---

### `black-box` — tests that only see the public seam

**What they cover:**
- Cross-module wiring (integration layer)
- User-visible behaviour through the actual product surface (e2e layer)
- Public API contracts

**Where they live (convention):** outside `src/`. Typical paths: `integration/`, `e2e/`, `test/contract/`. The manifest declares the project's actual paths.

**Examples:**
- Integration: `expect(await emit({ tool: 'cursor', output: tmp })).toHaveProperty('emitted', 9)`
- E2E: drive the actual CLI / UI, assert on stdout / DOM / network — no peeking into module-level state

**When to use:**
- Once a feature has multiple modules collaborating, integration tests pay back the cost of writing them
- For any feature that ships to users, e2e tests validate the surface they actually see
- For public-API code, black-box tests are the contract

**Constraint:** slower to write + run; can't catch every internal bug; expensive to maintain when the public surface evolves. Compose with white-box for inner logic.

**Critical rule:** black-box tests must NOT import internal modules. If they need to, the seam they're testing isn't a real seam — refactor first.

---

### `static` — no runtime assertions

**What it covers:**
- Type checks (`tsc --noEmit`)
- Lint rules (eslint, governance rules)
- Format checks (prettier, structural conventions)
- Schema validation (JSON Schema, YAML schema)

**Examples:**
- `tsc -p tsconfig.json --noEmit`
- `pnpm run check:anatomy` (ADR-0020 gate over `canonical/skills/`)
- governance engine audit pass

**When to use:** always. Static checks are the cheapest layer; they catch entire classes of bugs before tests run.

**Constraint:** doesn't catch behavioural bugs. A type-correct function that returns the wrong answer is invisible to static checks. Compose with white-box + black-box.

---

## Composition: surface → minimum layers

`testing-manifest.json` declares per-surface minimums. Examples:

| Surface | Minimum layers | Implied styles |
|---|---|---|
| `core` (internal modules) | `[test:unit]` | white-box |
| `publicApi` (library exports) | `[test:unit, test:integration]` | white-box + black-box |
| `userFacing` (UI, CLI) | `[test:unit, test:integration, test:e2e]` | white-box + 2× black-box |

A feature that touches `userFacing` ships only when all 3 layers run green. This composes the styles deliberately:
- White-box catches the inner-logic bugs
- Integration catches the wiring bugs
- E2E catches the surface bugs

Skipping a style produces a known blind spot.

**Enforced (ADR-0016).** This composition is no longer documentation-only. The
`userfacing_integration_layer` rule is **self-scoping**: if the repo has user-facing route/page
files but the manifest declares no `integration`/`e2e` layer, it is a finding (warn under `solo`,
blocks under `team`) — you cannot silently ship a user-facing surface with only a unit layer (the
World Cup `/share` 404 was that blind spot). A project with **no** user-facing surface (a CLI,
library, or analyzer) is exempt by construction — the rule never fires. It requires the layer be
*declared* (so the ship gate runs it); it does **not** gate UX/taste — that has no deterministic
invariant and stays human-reviewed.

---

## What this means for AI agents

The default style for an agent writing tests is **white-box** (co-located, fast feedback). That's usually right for the unit layer.

For integration / e2e layers, the agent must EXPLICITLY switch style:
- Don't import internal modules in `integration/` tests
- Don't assert on private state in `e2e/` tests
- If you reach for internals, the seam is wrong — surface the seam-design problem before writing the test

The `style:` declaration in `testing-manifest.json` is the agent's authority. If `test:integration.style = "black-box"`, integration tests violating that constraint are a finding for `review` skill to catch.

---

## Cross-reference

- [conventions/testing-manifest.json.example](./testing-manifest.json.example) — the schema this document defines styles for
- [canonical/skills/plan.md](../canonical/skills/plan.md) — `Min-Invariant` discipline at task-row level (applies to all styles)
- [canonical/skills/review.md](../canonical/skills/review.md) — final-gate test-quality checklist (verifies styles match layer declaration)
- [governance/governance.yaml.example](../governance/governance.yaml.example) R3 (`test_file_in_manifest_directory`) — enforces tests live in declared layer dirs
