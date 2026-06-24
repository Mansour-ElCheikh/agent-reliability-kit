# Ship gate: tests + governance must be green before ship

Formalises ADR-0013. The ship gate is the deterministic backstop that makes "gated" a
mechanism, not a discipline the agent has to remember. It runs the target repo's OWN gates
and blocks ship on red.

## What it runs

`reliability-engine gate [--repo-root <path>]` runs, in the target repo:

1. **Tests + lint** - each `testing-manifest.json` command key that is a real `package.json`
   script, plus a `lint` script if present. Falls back to the `test` script when the manifest
   declares nothing runnable. Package manager is detected from the lockfile.
2. **Governance audit** - the existing engine audit (`runAudit`); any `error`-severity
   finding is a red check. Skipped cleanly (green) when the repo has no `governance.yaml`.

A check is red if its script exits non-zero or the audit reports errors. With NO runnable
test at all, the gate is red (you cannot ship un-gated). The gate is `blocked` iff any check
is red.

**Setup-sequencing note (battle-test C3).** "No runnable test → red" also covers a *configured*
runner that finds **zero test files** — e.g. `vitest run` exits non-zero with "No test files
found" the moment you delete the scaffolded placeholder before writing the first real test.
That is correct at ship (you cannot ship untested), but it is a trap during initial setup. Keep
the placeholder test until your first real test exists (or, only at setup time, run with
`--passWithNoTests`). The ship gate's own command must never use `--passWithNoTests` — zero
tests = red is the point.

## What the gate vouches for — and what it does NOT (read this)

The governance check blocks on **error-severity findings only**. Under the default
`profile: solo`, almost every universal rule is `warn` (the soft-start ramp) — only
`no_secrets` is `error`. So **stated plainly, the default solo gate is "tests green + no
secrets"**, not "every governance rule satisfied". That is by design (solo should not be
nagged to a halt), but it must not be mistaken for full enforcement:

- The gate now **surfaces** the advisory warning count instead of hiding it — e.g.
  `governance — 0 errors (4 warning(s) advisory — not blocked; run --strict to block)`. You
  see exactly what is being waved through.
- **`reliability-engine gate --strict`** blocks on `warn`-severity findings too. Use it in CI, on
  a shared branch, or any time "passes the gate" must mean "clean", not "no errors".
- **`profile: team`** ramps the universal rules `warn → error`, so the plain (non-`--strict`)
  gate blocks on them. `--strict` gives the same blocking force per-invocation without
  changing the profile.

(Honest framing recorded after battle-test finding C2: a gate that silently passes on warnings
while skills imply full enforcement is the kit's own phantom-enforcement anti-pattern.)

## Exit behaviour

| Invocation | Green | Red |
|---|---|---|
| `reliability-engine gate` | prints `SHIP GATE: PASS`, exit 0 | prints `SHIP GATE: BLOCKED` + the red checks, exit 1 |
| `reliability-engine gate --strict` | as above, but warnings also count as red | blocks on any error **or warning** finding, exit 1 |
| `reliability-engine gate --stop-hook` | silent, exit 0 | emits `{"decision":"block","reason":...}`, exit 0 (the JSON blocks) |

## How to use it (two surfaces)

- **At the ship step (recommended).** The `sdlc` / `review` skill runs `reliability-engine gate`
  at the Built -> Shipped boundary and refuses to ship on a non-zero exit. This is the cheap
  default: the full suite runs once, at ship, not on every turn.
- **As a Stop hook (optional).** `governance/gate-hook.example.sh` wires
  `gate --stop-hook` so a blocked gate makes the agent continue and fix before it can stop.
  Cost: the suite runs on each stop, so guard it (the example only gates when an epic is at
  `Built`) or prefer the ship-step invocation for large suites.

## How it composes (no layer is redundant)

| Layer | Proves | Cannot prove |
|---|---|---|
| PreToolUse governance hook | a bad write is blocked at write time | the suite is green at ship |
| `build` skill (TDD runner) | test-first ordering, observed RED, Min-Invariant assertions | that it was actually followed |
| **ship gate** | the suite is green + governance clean at ship | test-first ordering (the build skill's job) |

The build skill instructs TDD; the gate enforces a green suite at ship. A build that skipped
TDD cannot reach ship green: the gate is the backstop (ADR-0013, gap 4).

## Non-tautological (Guardrail 4 / F1)

The gate's "blocks on red" is proven, not asserted: `engine/test/gate.test.ts` fails on an
always-pass stub (a red test script -> `blocked` true; governance errors -> `blocked` true),
and the CLI is verified end-to-end (a green target exits 0; the same target flipped red exits
1). A gate that ignored its checks would fail those.
