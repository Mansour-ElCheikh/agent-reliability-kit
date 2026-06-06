# agent-reliability-kit

**AI-SDLC infrastructure: an SDLC factory + YAML-driven governance engine for agent work predictable enough to ship.**

Every change passes the same gates. Every architectural call is recorded. Every regression is caught at write-time, not deploy-time. Authored once in a tool-agnostic source, emitted per-tool at the strongest enforcement each tool supports.

[![CI](https://github.com/Mansour-ElCheikh/agent-reliability-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Mansour-ElCheikh/agent-reliability-kit/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## How it composes

```
FACTORY:   plan  →  spec  →  build  →  review  →  audit
           12 canonical skills + 1 adversarial subagent (reviewer-agent)

ENGINE:    YAML rules  →  PreToolUse hook (write-time gate)
                       →  audit subcommand (commit-time + CI gate)
                       →  ratchet (refuses regressions vs baseline)
           11 deterministic predicates ship built-in

RECORD:    ADRs (decisions; the decision_keyword_without_adr predicate
                  flags commits whose message decides something without one)
           16 ADRs ship in this repo as worked examples
```

Factory produces; engine gates; ADRs record. The product is what falls out the top.

## The factory (skills + subagents)

12 canonical skills + 1 adversarial subagent ship in `canonical/`. Each is one tool-agnostic markdown file with capability frontmatter; emitters render per-tool configs.

| Phase | Skill | Job |
|---|---|---|
| Plan | `plan`, `plan-next`, `sdlc` (orchestrator) | Read-only architecture pass, ordered TDD task table, cross-feature dispatch |
| Spec | `spec` | Epic + tasks; scales internally by component count |
| Build | `build` | Instructional TDD runner: one RED / GREEN / REFACTOR slice at a time |
| Review | `review` | Diff review pre-ship; invokes the adversarial subagent |
| Audit | `audit` | Engine narration + hook diagnostics over committed work |
| Support | `debugging-and-error-recovery`, `performance-optimization`, `refactor`, `session-harvest`, `scaffold` | Cross-phase: root-cause debugging, measure-first perf, rollback-disciplined refactor, durable knowledge capture, kit bootstrap |

The skill set is **hierarchical**: `sdlc` orchestrates phase dispatch by epic status, `plan-next` selects cross-feature work, phase skills sit below. Deterministic-routing differentiator vs flat skill libraries: [`docs/findings/comparison-vs-flat-skill-models.md`](docs/findings/comparison-vs-flat-skill-models.md).

**Adversarial subagent.** `canonical/agents/reviewer-agent.md` is the template: a fresh-context reviewer that returns PASS / FAIL / PASS WITH WARNINGS with line-cited issues. Not helpful; critical. Rejects vague acceptance criteria, untestable tasks, boundary-rule violations, ADR contradictions.

## The governance engine

YAML rule contract, evaluated by the TypeScript engine in `engine/`:

```yaml
rules:
  - id: R7_jsdoc_on_exports
    severity: warn          # error = block, warn = allow + count, audit = record only
    description: Exported functions must have JSDoc
    enforcement: [hook, engine]
    check: jsdoc_on_exports
    scope: "src/**"
```

**Three enforcement surfaces.** The `hook` subcommand reads a PreToolUse JSON payload, evaluates `enforcement: [hook]` rules, exits 0 (allow) or 2 (block). The `audit` subcommand evaluates `enforcement: [engine]` rules for CI / commit-time gates. The `ratchet emit` / `ratchet update` subcommands maintain the warning baseline (`.governance-baseline.json`).

**11 deterministic predicates ship built-in:** `boundary_imports`, `prompt_size_warn`, `doc_validity`, `scope_containment`, `no_secrets`, `source_file_has_co_located_test`, `test_file_in_manifest_directory`, `roadmap_reference_in_commit_message`, `decision_keyword_without_adr`, plus the Min-Invariant pair `tasks_min_invariant` + `test_shape_assertions` (ADR-0010). The three test-file predicates read test-file shape from `testing-manifest.json`, so they work for any stack, not only JS/TS (ADR-0013). Adopters extend via `engine/extensions/*.predicates.{js,mjs}`.

**The ratchet.** New commits that increase a warning count past the baseline are refused; existing warnings are grandfathered. The baseline updates only on explicit `ratchet update`, never automatically.

## ADRs (durable architectural record)

Dated, immutable, supersedable. `docs/decisions/0042-some-decision.md` with `Status` / `Date` / `Supersedes` frontmatter; numbers never reused. The `decision_keyword_without_adr` predicate flags commits whose message uses decision language (`decided`, `chose`, `picked`) without a new ADR in the diff. **16 ADRs ship to date in this repo** as worked examples of the discipline.

## Two-axis enforcement

The engine emits at the strongest tier each tool supports, gated by the team's profile:

| Tier | Tools (May 2026) | What the adopter gets |
|---|---|---|
| 1 | Claude Code, Copilot agent mode | Write-time hook gates + adversarial subagent + skill-driven playbooks + commit-time gate |
| 2 | Cursor, Codex | Glob-applied advisory rules + commit-time gate + inline review in the skill body |
| 3 | Aider, Continue | Steering-file conventions + commit-time gate |

| Profile | Universal rules | Ratchet | CI behaviour |
|---|---|---|---|
| `solo` (default) | warn | records, does not block | annotates |
| `team` | warn ramps to error | blocks | required check |

Safety rules (`no_secrets`) emit at `error` under both profiles. The two axes are orthogonal: a Cursor team on `profile: team` gets advisory rules at blocking severity. Designed in [ADR-0007](docs/decisions/0007-universal-rules-ship-enabled.md).

## Case study: RepoNav

A pre-registered eval measured how often agents pick the architecturally-correct seam when refactoring an unfamiliar codebase. 36 trials, 12 per arm, three Claude tiers (Haiku / Sonnet / Opus class as of the 2026-05-03 sweep):

| Arm | Right seam chosen |
|---|---|
| Without deterministic context | 8% (1/12) |
| With architecture context pre-loaded | 100% (12/12), **+92pp** |
| With analyser invoked mid-task | 92% (11/12), **+83pp** |

The lift comes from context delivery at decision time: a deterministic architecture summary available before the refactor, not from any gate forcing a call. The kit puts the right context, the right review, and the right record in the right place at the right time; the analyser is the reference implementation, never bundled here. Raw per-arm data, pre-registration, and harness: <https://github.com/Mansour-ElCheikh/evals> (manifest in [`reponav-l8-correctness/RESULTS.md`](https://github.com/Mansour-ElCheikh/evals/blob/main/reponav-l8-correctness/RESULTS.md)). About $11 API spend for the L8 sweep, about $60 cumulative across the L1 to L8 series.

**What this measures, and what it does not.** Read the number for what it is: a single-decision result. Each trial scores one architectural-seam choice on one refactoring fixture, with the summary primed fresh at decision time. The effect is context *availability*, not a forcing gate (in the broader lever series, a gated-call variant and a multi-decision variant did not reproduce the lift). So it proves context-at-decision-time on this fixture; it does **not**, on its own, validate `plan-next` routing, the governance engine, the `reviewer-agent`, the skills' behavioural efficacy, or `session-harvest`. Those are evidenced separately (the [skill-eval methodology](docs/findings/skill-eval-methodology-2026-05.md)) or pilot-measured in [docs/findings/](docs/findings/) (the `reviewer-agent` catch-rate, the Min-Invariant rule, and `plan-next` routing), not by this sweep.

## Quick start

```sh
git clone https://github.com/Mansour-ElCheikh/agent-reliability-kit
cd agent-reliability-kit
corepack enable && pnpm install && pnpm run build   # one time

# In your project
cd <your-project>
node <scaffold>/scripts/dist/scaffold.js            # auto-detect tools, run emitters
git add -A && git commit -m "chore: bootstrap reliability kit"
```

`scaffold.ts` (the kit's bootstrap script) detects which tools the repo uses, runs each applicable emitter, and prompts (never silently) before establishing the ratchet baseline. Mixed-tool teams get the right per-tool configs on clone.

## What it is not

- **Not a service or SDK.** No daemon, no network calls, no `import` statements. The engine and emitters are local CLIs; the hook gates Edit/Write actions in the agent's tool layer. ([ADR-0008](docs/decisions/0008-not-a-runtime-language-reconciliation.md))
- **Not an analyser.** It does not read your codebase. Bring your own; the analyser-interface contract formalises in v0.2.
- **Not Claude-Code-only.** Claude Code gets the strongest enforcement; Cursor, Copilot, Aider, Codex, Continue degrade according to capability.

## Status

`0.1.3-dev`. Canonical layer (12 skills + 1 subagent) is the sole source of truth; three emitters (Claude Code, Cursor, Copilot) and the rules engine (11 predicates, hook, audit, ratchet) self-test in CI. Governance ships a Universal Default Set enabled (advisory under `solo`, ramping to blocking under `team`; see [ADR-0007](docs/decisions/0007-universal-rules-ship-enabled.md)).

**Skill bodies are eval-locked at v0.1.** The 12 skills + 1 subagent were validated per [`docs/findings/skill-eval-methodology-2026-05.md`](docs/findings/skill-eval-methodology-2026-05.md): skill-description discrimination 42/42 negatives + a real-skills harness 12/12, plus behavioural conformance spot-checks 3/3 on `build` / `spec` / `plan`. Changes to skill bodies require re-eval per that methodology before their own release. [ADR-0009](docs/decisions/0009-bdd-jtd-tdd-trilayer.md) records a locked direction for v0.2 (BDD `Given / When / Then` at the Acceptance Criteria level + optional JTD); its implementation is unstarted and gated on re-eval.

[ARCHITECTURE.md](ARCHITECTURE.md) goes deeper on the factory + engine internals. [ROADMAP.md](ROADMAP.md) lists forward work. [CHANGELOG.md](CHANGELOG.md) lists shipped.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
