---
validity: current
as_of: 2026-06-04
expires_after_days: 90
---

# Roadmap

Forward-looking only. Shipped history lives in [CHANGELOG.md](./CHANGELOG.md).

Status as of: 2026-06-04. v0.1.3-dev ships with the canonical layer (12 skills + 1 subagent) as the sole source of truth, three emitters (Claude Code, Cursor, Copilot), the TypeScript rules engine (11 predicates) self-testing in CI, tool-neutral git-workflow + testing conventions ([ADR-0012](./docs/decisions/0012-git-and-testing-conventions.md), [ADR-0013](./docs/decisions/0013-testing-predicates-manifest-driven.md)), a session-metrics reader ([ADR-0014](./docs/decisions/0014-session-metrics-reader.md)), and a blast-radius / sandbox convention ([ADR-0015](./docs/decisions/0015-blast-radius-and-sandboxing.md)). Against the external 11-axis software-factory rubric the kit now scores 9 SOLID / 1 held-PARTIAL / 1 out-of-scope ([2026-06 re-score](./docs/findings/sdlc-axes-scoring-2026-06.md)). Skill bodies are eval-locked at v0.1 per [`docs/findings/skill-eval-methodology-2026-05.md`](docs/findings/skill-eval-methodology-2026-05.md); changes require re-eval before release.

Notation (S-phases, waves, F-items, R-items, L8/T6, spine repo): see [Vocabulary](#vocabulary) at the bottom.

---

## Future — v0.2

Committed direction (driven by closed-friction items or locked ADRs):

- **Codex emitter.** AGENTS.md target. Tier 2.
- **Aider emitter.** CONVENTIONS.md target. Tier 3.
- **Continue emitter.** `.continuerc.json` target. Tier 3 with `customCommands` array.
- **BDD / JTD / TDD trilayer implementation** ([ADR-0009](./docs/decisions/0009-bdd-jtd-tdd-trilayer.md)). Direction is locked; implementation restructures `canonical/skills/spec.md` (BDD `Given / When / Then` at Acceptance Criteria + optional JTD per RFC-8927) and updates `plan.md` / `build.md` / `review.md` to cite the chain. **Requires re-running the skill-eval methodology before ship** since skill bodies change.
- **Analyser-interface contract** (closes F4). Documented JSON shape for architecture summary, hot files, boundary map, blast radius. Any analyser satisfying the contract works. The scaffold ships the contract, not an analyser; adopters wire theirs.
- **Dogfood loop against the scaffold's own tree** (closes F1). The evidence-generation cycle: daily-drive the discipline on real work, capture friction as F-items, let observed friction drive what governance is actually needed rather than speculatively designed. Outputs include a public scoring artefact per cycle.
- **MCP latency re-measurement** (closes F7). Run the same eval setup against the current TOON-promoted code path; publish numbers.
- **Shell-out / multi-language predicate support** (closes F12). Adds a `check_command:` field that lets `governance.yaml` rules call out to arbitrary shell.
- **pytest assertion-vocabulary corpus sweep** ([ADR-0013](./docs/decisions/0013-testing-predicates-manifest-driven.md)). `test_shape_assertions` now picks a pytest vocabulary for `.py` files, shipped as a conservative TDD-pinned heuristic but not yet swept against a large real pytest corpus the way the vitest variant was (the 2026-06 B2 sweep). A corpus sweep graduates the pytest path from advisory to measured; results to the eval repo.
- **Manifest command-resolution check** ([ADR-0012](./docs/decisions/0012-git-and-testing-conventions.md)). R22's one portable increment beyond the shipped manifest-placement predicate: verify every command declared in `testing-manifest.json` resolves to a runnable script. Folds into `test_file_in_manifest_directory` or a sibling predicate.
- **Session-event log + plan-next stub writers (host-lifecycle-wired).** Worked-example writers now ship (`governance/session-events.writer.example.mjs`; `governance/plan-next-stub.refresher.example.mjs` + contract `canonical/plan-next-stub.schema.md`, which scans `dev/epics/*/epic.md` statuses per ADR-0011). v0.2 wires them into each host's session / commit lifecycle (a Claude Code SessionEnd / PostToolUse / post-commit hook, a Cursor wrapper) so they fire automatically rather than by manual call.
- **`--write-settings` default flip** to ON for the Claude Code emitter. v0.1 keeps it opt-in to avoid surprising adopters with custom hook configs; v0.2 flips once adoption patterns are observed.
- **`typescript-eslint` adoption.** Style-consistency layer above the tsc strict gate.

Considered but not committed (require evidence before promotion):

- **Subagent library expansion beyond `reviewer-agent`.** F3's 2026-05-20 reframe established this is an MVP scope deferral, not a generalisability judgement. Specific agents (refactor-scout, parallel-reconcile, others) will land when adopter friction surfaces a concrete need, not speculatively from design discussion.
- **Documentation-completeness + narrative-vs-reality predicates.** Prompted by a 2026-05-19 doc-drift retro, but the drift class may evaporate once meta-loop discipline holds. Reconsidered without commitment; the substantive review piece (`docs-architect` subagent) is also speculative pending evidence the existing `brand-architect` + `positioning-architect` pair leave a real gap.
- **Faithful skill-triggering-rate harness.** Discrimination (skill descriptions do not mis-fire) is certified; spontaneous implicit-trigger *rate* is not, due to a measurement trap described in [`docs/findings/skill-eval-methodology-2026-05.md`](docs/findings/skill-eval-methodology-2026-05.md). A real rate-harness needs non-gutted skill bodies with covert in-procedure markers the genuine workflow naturally emits, or skill-level telemetry the host does not expose. Deferred until a tractable approach surfaces.
- **6-dimension eval rubric + `engine skill-eval` subcommand.** Lets adopters score their own `canonical/skills/` against the same yardstick we used. Capability-eligible; demand-driven.

---

## Open friction (tracked in [docs/findings/wave4-self-bootstrap.md](docs/findings/wave4-self-bootstrap.md))

| ID | Status | Title |
|---|---|---|
| F1 | OPEN, v0.2 | No active dogfood loop against scaffold's own tree |
| F2 | DOCUMENTED | `review` skill expects an analyser; scaffold ships none |
| F3 | DOCUMENTED | Subagent template uses a single example, not a library (MVP scope deferral) |
| F4 | DOCUMENTED | Skills retain trace references to "your analyser" |
| F5 | DOCUMENTED | Governance hook is a worked example, not a production engine |
| F6 | CLOSED 2026-05-18 | Eval harness peeled (now Branch D) |
| F7 | OPEN, v0.2 | No MCP latency re-measurement |
| F8 | CLOSED 2026-05-18 | `canonical/skills/` ↔ `skills/` duplication |
| F9 | CLOSED 2026-05-18 | Phase-to-globs mapping (landed in Cursor emitter) |
| F10 | ACCEPTED | Invocation-only skills degrade to inline-in-steering on Cursor |
| F11 | ACCEPTED | Universal capabilities not enumerated per-tool |
| F12 | OPEN, v0.2 | Predicate-language constraint (TS/JS-only) |
| F13 | ACCEPTED | Generated-header timestamp blocks committing scaffold's own emitted surface (gitignored instead) |
| F14 | ACCEPTED | pnpm requires one-time `corepack enable` (documented prerequisite) |
| F15 | CLOSED 2026-06-03 (ADR-0011) | `plan-next` routing duplicated `sdlc`; routing table now single-sourced in `canonical/phases.md`, both skills consume it |

---

## Vocabulary

Notation used throughout this roadmap, for public readers unfamiliar with the project's internal phase conventions:

- **S6.x** (e.g., S6.3a, S6.4b): Sprint 6 phases. Numbers are sequential; letter suffixes denote sub-phases delivered as separate PRs. History in [CHANGELOG.md](./CHANGELOG.md).
- **PR #N**: pull request number in this repository.
- **Waves**: multi-session execution batches planned in the spine repo (see below).
- **Branches A-D within a wave**: parallel workstreams of one wave. Branch D = the dedicated public [`evals`](https://github.com/Mansour-ElCheikh/evals) repository.
- **F1-F15**: friction findings (see Open friction table above and [`docs/findings/wave4-self-bootstrap.md`](docs/findings/wave4-self-bootstrap.md)).
- **R-items** (R2, R7, R17, R26, etc.): governance rule IDs (see [`governance/governance.yaml.example`](./governance/governance.yaml.example)).
- **L8 / T6**: pre-registered eval levers (L) and trials (T) in the RepoNav eval harness; published at [`Mansour-ElCheikh/evals/reponav-l8-correctness/`](https://github.com/Mansour-ElCheikh/evals/tree/main/reponav-l8-correctness).
- **Spine repo**: a private session-management / planning repository where waves, execution prompts, and session-harvest files live; not in scope for the public scaffold.

---

## Cross-references

- [CHANGELOG.md](./CHANGELOG.md): shipped history (S6.x phases, ADR-0007/0008/0009, public-flip readiness)
- [ADR-0001](./docs/decisions/0001-scaffold-charter.md): scaffold charter (what does / does not ship)
- [ADR-0005](./docs/decisions/0005-node-only-stack-and-workspaces.md): Node-only stack lock
- [ADR-0007](./docs/decisions/0007-universal-rules-ship-enabled.md): Universal Default Set + profile-driven severity ramp
- [ADR-0008](./docs/decisions/0008-not-a-runtime-language-reconciliation.md): runtime-language reconciliation
- [ADR-0009](./docs/decisions/0009-bdd-jtd-tdd-trilayer.md): BDD / JTD / TDD trilayer direction (v0.2 implements, requires re-eval)
- [ADR-0010](./docs/decisions/0010-min-invariant-governed-rule.md): Min-Invariant re-bound to a governed rule id (R21/R20 analogue predicates)
- [ADR-0011](./docs/decisions/0011-epic-status-single-routing-source.md): epic-status single routing source (closes F15)
- [ADR-0012](./docs/decisions/0012-git-and-testing-conventions.md): tool-neutral git-workflow + testing conventions; R22 already-covered; DB-safety guard as principle
- [ADR-0013](./docs/decisions/0013-testing-predicates-manifest-driven.md): testing predicates read test-file shape from the manifest (multi-framework)
- [ADR-0014](./docs/decisions/0014-session-metrics-reader.md): session-metrics reader over the session-event log (Axis 11 pipeline metrics)
- [ADR-0015](./docs/decisions/0015-blast-radius-and-sandboxing.md): blast-radius four-layer model + sandbox composition contract (Axis 1)
- [`docs/findings/sdlc-axes-scoring-2026-06.md`](./docs/findings/sdlc-axes-scoring-2026-06.md): current 11-axis re-score (supersedes the 2026-05 snapshot)
- [`conventions/public-flip-hygiene.md`](./conventions/public-flip-hygiene.md): scrub secrets, never rewrite chronology
- [`docs/findings/wave4-self-bootstrap.md`](./docs/findings/wave4-self-bootstrap.md): F-items above
- [`docs/findings/skill-eval-methodology-2026-05.md`](./docs/findings/skill-eval-methodology-2026-05.md): skill validation methodology + measurement traps
- [`docs/findings/comparison-vs-flat-skill-models.md`](./docs/findings/comparison-vs-flat-skill-models.md): hierarchical SDLC topology vs flat skill models
