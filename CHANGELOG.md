# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Public-flip readiness (Working Factory Day 1 through pre-flip pass)

Post-S6.4b, still untagged (package.json stays `0.1.3-dev`). The kit ships and dogfoods a working core (ADR-0007), publishes the case-study evidence (evals repo), and clears the locked public-flip gate before flipping public.

### Self-governance + test-existence (2026-06-23)

The kit starts eating its own dog food, and closes a gap that surfaced the moment it did.

- **The kit governs itself.** A live `governance.yaml` applies the Universal Default Set (ADR-0007) to the kit's own `engine/` / `emitters/` / `scripts/` / `canonical/` / `docs/` tree; CI runs it advisory (records, never blocks) with the ratchet refusing new regressions. Self-audit is 0 errors / 0 warnings, within baseline — the kit dogfooding the floor it prescribes, not a fixture.
- **ADR-0026 — layout-agnostic test-existence predicate.** `source_file_has_test` requires a test discoverable by name among in-scope files wherever they live (co-located, central `test/` dir, pytest, Go), closing the hole the co-located-only `source_file_has_co_located_test` could not cover for central layouts. Subsumes the co-located form; pairs with `test_file_in_manifest_directory`. Registry 12 to 13; TDD'd (8 cases). Shipped as a built-in available to project rules, not added to the Universal Set (test location is a project choice).
- **Closed a real coverage gap the dogfood surfaced.** `engine/src/extensions.ts` (the adopter predicate loader) was exercised by no test at all; added `engine/test/extensions.test.ts` (5 cases over every branch: registration + non-function filtering, the `.predicates.{js,mjs}` pattern filter, the missing-directory and failed-import paths). Engine suite 91 to 96. The self-governance note that had silently counted it among the covered files is corrected in place (flagged set 7 to 6).
- **Engine coverage floor in CI.** `@vitest/coverage-v8` enforces a reachability ratchet over `engine/src` — lines/statements 85%, branches/functions 80%, set just below the measured 86.2% / 81.7% (the re-export barrel, the integration-tested CLI entrypoint, and type-only declarations excluded). It guards against regressions and entirely-unexercised modules; it is a floor, not a quality target — assertion quality stays the Min-Invariant rule's job (ADR-0010). Verified to fail when coverage drops below the floor.
- **Import-failure errors chain their cause.** The adopter-extension loader attaches the original error via `{ cause: e }` instead of flattening it into the message, preserving the stack for an adopter debugging a failing extension (asserted in the loader's failed-import test).

### Flip (2026-06-03) — faithful, honestly-scoped, battle-tested source

Outcome of the RepoNav to scaffold to consumer triangulation: make the scaffold a faithful, honestly-scoped, battle-tested source before it is globalised/published.

- **ADR-0010 — Min-Invariant re-bound to a governed rule id** (the one real substance loss vs RepoNav). Two built-in engine predicates restore RepoNav's R21/R20 binding in tool-neutral form: `tasks_min_invariant` (`min_invariant_per_task`) audits the tasks.md Min-Invariant column; `test_shape_assertions` (`test_invariants`) flags shape-only test assertions. Added `forbidden_invariant_values` to the rule type; registry 9 to 11; TDD'd (`engine/test/predicates.test.ts`, vitest 21 to 32). The `plan` / `build` / `review` skills + `reviewer-agent` + the schema now name the rule id, so the skill rule and the mechanical check share an id. Shipped opt-in (not the Universal Set; it presupposes the epic/tasks.md convention).
- **ADR-0011 — epic-status is the single routing source of truth (closes F15)**. The status to phase routing table moved to one canonical table in `canonical/phases.md`; `sdlc` and `plan-next` both consume it, neither restates it. RepoNav's dropped `update-plan` roadmap refresh folded into `session-harvest` (a `roadmap-staleness` finding) rather than restored.
- **Session-event log writer + plan-next stub refresher** shipped as worked examples (`governance/session-events.writer.example.mjs` and `governance/plan-next-stub.refresher.example.mjs` + `canonical/plan-next-stub.schema.md`, the `hook.example.sh` precedent); both schemas move from referenced-but-unshipped to contract + worked example. The stub refresher scans `dev/epics/*/epic.md` statuses per ADR-0011 (dogfooded against 15 real RepoNav epics).
- **Four efficacy evals designed + executed** (`docs/findings/eval-{min-invariant-ab,reviewer-agent,plan-next-routing}-2026-06.md`; harness in `evals/`): Min-Invariant A/B (100% to 0% false-green slip), reviewer-agent catch-rate (9/9 vs 7/9 control, +22pp; surfaced + fixed a Branch-A over-flagging bug), plan-next routing (8/8 correct, marginal value +1 — bar partially met, reported straight), and a predicate-vs-real-RepoNav sweep (B2: `tasks_min_invariant` 0 FP; `test_shape_assertions` ~25% FP → opt-in confirmed). All in-session pilots; persistent runs graduate to the eval repo.

### Changed (flip)

- **Eval headline honestly scoped.** README §Case study + ARCHITECTURE + memory now carry the L8/T6 result's three bounds (single-decision, one-fixture, fresh-priming) and the negative/inconclusive companions (a forcing gate and a multi-decision variant did not reproduce the lift). The number proves context-at-decision-time, not the whole loop.
- **Skill-eval scope published honestly + reconciled.** `skill-eval-methodology-2026-05.md` now reports the `reviewer-agent`, the Min-Invariant rule, and `plan-next` routing as **pilot-measured** (evals A/B/C), leaving the implicit-trigger rate + the git/testing-workflow convention layer as the remaining uncertified fronts; README Status scoped to match.
- Min-Invariant rule label upgraded from "reasoned, unproven by sweep" to "mechanism measured on a pilot" across ADR-0010, `governance.yaml.example`, and the schema, once Eval B passed.

### Added

- **ADR-0007** (#7): Universal governance rules ship enabled-advisory; project-specific rules ship as labelled shape; `profile: solo|team` governs the severity ramp + the composes-not-impose contract. ADR-0001 amended in part (not superseded).
- **ADR-0008** (#14): Reconcile "not a runtime" language with the working factory. ADR-0001 amended in part for the runtime-language axis (parallel to ADR-0007's governance amendment).
- **ADR-0009** (#14): Lock the BDD / JTD / TDD trilayer as the canonical spec → build → review modality. v0.2 implements `spec.md` / `plan.md` / `build.md` / `review.md` restructure.
- **Engine** (#7): `profile` + `resolveEffectiveSeverity` (safety > advisory > team-ramp > base); 3 net-new predicates (`no_secrets` safety, `scope_containment`, `doc_validity`); registry 6 to 9; +6 fixtures (vitest 21).
- `governance.yaml.example` rewritten to the ADR-0007 model: 5 universal rules enabled-advisory + project-specific shape commented + `profile: solo` default.
- Reference toolchain shipped + seeded by `/scaffold`: `eslint.config.mjs` (calibrated flat config), `.prettierrc.json`, `.prettierignore`, and an adopter `.github/workflows/reliability.yml` (lint + format + test + governance + secret tripwire).
- `conventions/verification.md` (names the verification-by-evidence rule); `docs/findings/skill-eval-methodology-2026-05.md` (the skill-validation arc + transcript-inversion lesson).
- `conventions/public-flip-hygiene.md` (#9, tightened in #10): locked Public-flip-gate criterion 8; full-history secret / PII / absolute-path scan gates the flip.
- `conventions/repo-documentation.md` (#14): tiered documentation guideline (Tier 1 universal hygiene; Tier 2 engineering rigour; Tier 3 agentic-coding-specific).
- `docs/findings/comparison-vs-flat-skill-models.md` (#14): public-grade hierarchical-vs-flat skill-topology analysis.
- `evals/README.md` (#9): breadcrumb to the dedicated public `evals` repository (`github.com/Mansour-ElCheikh/evals`).
- `ONBOARDING.md`, `CONTRIBUTING.md`, `SECURITY.md`, `examples/typescript-service/` (#13): pre-flip adoption surfaces.
- `ROADMAP.md` Vocabulary section (#12); `validity` / `as_of` / `expires_after_days` frontmatter (#12).
- ROADMAP "Public-flip gate" criterion 7 (dedicated public evals repository published) and criterion 8 (public-flip hygiene scan), both SATISFIED 2026-05-19 / 2026-05-20 respectively.

### Changed

- README + ARCHITECTURE reconciled to the enabled-governance reality (ADR-0007); README Status corrected; the canonical governance schema (`canonical/governance-rule.schema.md`) and ADR-0002 record the new fields.
- Scaffold CI: `format:check` (hard) + advisory `eslint`.
- README + ARCHITECTURE post-S6.4b adoption-readiness pass (#14): RepoNav lede compressed to single-sentence; vault row reframed (no false-publication implication); "Not a runtime" reframed to "Not a service or SDK" per ADR-0008; new "Architecture at a glance" section with ASCII flow diagram + repo-tree shape; new "Hierarchical SDLC topology" section; new "Two-axis enforcement (per-tool tier + per-profile severity)" subsection; new "Analyser integration: today vs v0.2" section; new "Individual customisation, no drift" subsection.
- NOTICE: SHA-pin reframe to manifest pointer (#12); runtime-language reconciliation per ADR-0008 (#14).
- `memory/MEMORY.md`, `memory/scaffold_charter.md`: SHA-pin reframe (#12); runtime-language reconciliation per ADR-0008 (#14); F8-deleted root-dir reference fixed (#10).
- `canonical/governance-rule.schema.md` (#14): synced with engine `types.ts`; predicate-specific fields documented per predicate.
- `docs/findings/wave4-self-bootstrap.md` F3 (#14): reframed honestly — the conservative single-subagent scope was an MVP call, not a "they don't generalize" judgment; subagent library expansion (`refactor-scout-agent`, `parallel-reconcile-agent`) is committed to v0.2.
- Public surfaces (README, gate5, provenance, charter, self-bootstrap) reframed (#12) to point at the evals manifest instead of citing the SHA as if fetchable from public Reponav.

### Removed

- 4 internal-process design records removed pre-public-flip (their substance, where worth preserving publicly, was extracted): `docs/findings/s6.1-handtrace-sdlc-emit.md` (262 lines, orphan), `docs/findings/sdlc-redundancy-audit.md` (113 lines; the public-grade Osmani comparison was extracted to `docs/findings/comparison-vs-flat-skill-models.md`), `docs/findings/wave4-s6-3-design-review.md` (640 lines), `docs/findings/wave4-s6-4-spec.md` (93 lines). Cross-references in ADR-0005, ADR-0006, ROADMAP, `engine/README.md`, and `scripts/src/scaffold.ts` updated.

### Known gaps / deferred to v0.2

- D5 (full solo/team coordination decomposition) deferred; only the composes-not-impose contract is locked.
- Implicit skill-trigger *rate* is an uncertified tooling-measurement gap (not a defect); faithful rate-harness is a v0.2 item.
- BDD / JTD / TDD trilayer implementation in `canonical/skills/spec.md` (ADR-0009 locks direction; v0.2 restructures the skill; re-eval required per `docs/findings/skill-eval-methodology-2026-05.md`).
- Subagent library expansion beyond `reviewer-agent` (deferred; evidence-driven, not pre-committed to specific agent names).
- Analyzer-interface contract (formal JSON shape for architecture summary, hot files, boundary map, blast radius).

## [0.1.3-dev] - 2026-05-18

In-flight dev cut (not tagged). TypeScript migration of the whole emitter/engine stack, the rules engine + Claude Code emitter (closing the canonical-vs-skills duplication), SDLC consolidation, two-layer TDD, and the tool-agnostic positioning rewrite. Covers S6.3a, S6.3b, S6.4a, and S6.4b of the option δ extension.

### Added

- **Rules engine** (`engine/`, TypeScript): `governance.yaml` parser, 6 predicates, audit/hook/ratchet modes, TOON dual-format output, vitest self-test (S6.3b)
- **Claude Code emitter** (`emitters/claude-code/`): emits `.claude/skills/<name>/SKILL.md` + `.claude/agents/<name>.md` from `canonical/`. Closes F8; the root `skills/` + `agents/` directories are deleted and `canonical/` is the sole source of truth (S6.3b)
- `/scaffold` skill + wrapper (`scripts/src/scaffold.ts`): Bootstrap/Adopt front door that auto-detects tools and runs each applicable emitter; `canonical/session-event-log.schema.md` (S6.3b)
- `--integrate-vault` in `scripts/src/scaffold.ts`: composable-siblings vault compose (per-user state to the vault, team-shared discipline to the repo); fail-fast when no vault is present; kit stays standalone-capable (S6.4b)
- New canonical skills: `build` (instructional TDD runner), `debugging-and-error-recovery`, `performance-optimization`; `plan` enriched with read-only Plan Mode + dependency map (S6.4a)
- Two-layer TDD: `R2` (warn) + `R2b` (error, write-time block) in `governance.yaml.example`; `governance/hook.example.sh` rewired to the engine (S6.4a)
- ADRs: 0005 (Node-only stack + pnpm workspaces), 0006 (`define` merged into `spec`); `docs/findings/{sdlc-redundancy-audit,wave4-s6-4-spec}.md`; F15 (S6.3a/S6.4a)
- `positioning-architect` subagent (lands in spine `~/.claude/agents/`): substantive positioning review, complements `brand-architect` (S6.4b)

### Changed

- **README + ARCHITECTURE positioning rewrite** (S6.4b): lede adopts the tool-agnostic best-fit + elevator pitch + the three complementary surfaces (vault = runtime session substrate, scaffold = build-time discipline, analyzer = decision-time grounding, never bundled), replacing the v0.1.0 "five composable layers / factory output" framing. Factual-regression fix: source paths are `canonical/skills/<name>.md` emitted to `.claude/skills/`, count is "12 skills + 1 subagent" (was "nine"). Brand flags cleared (browser-native-first framing; model tiers anchored to the dated sweep; $11 L8-sweep vs ~$60 cumulative spend disambiguated)
- Cursor + Copilot emitters rewritten from Python to TypeScript; ADR-0020 anatomy backfilled across all canonical skills; R26 skill-size rule; CI migrated to pure Node; build is pnpm workspaces (S6.3a/S6.3b; corepack is a documented prerequisite, F14)
- `define` retired and merged into `spec` (internal component-count branch, ADR-0006); `audit` reshaped to engine-narration framing ("not a second review"). Net **12 skills + 1 subagent** (S6.4a)
- `docs/capability-matrix.md` reconciled to 12 skills (per-tier rollup recomputed); License stays Apache-2.0 (MIT switch deferred out of S6.4 per user)

### Known gaps (after this dev cut)

- S6.4b is executed but not yet merged to `main` (worktree branch); this version is intentionally untagged
- F12 (TS-only predicates), F13 (generated-header timestamp vs committing emitted output), F15 (plan-next/sdlc routing overlap) remain open
- `docs/capability-matrix.md` is hand-maintained until v0.2 ties it to the emit reports
- See `docs/findings/wave4-self-bootstrap.md` for the full friction list

## [0.1.2] - 2026-05-18

Cursor + Copilot emitters land (option δ S6.2). The canonical layer now has working consumers; mixed-tool teams using Cursor + Claude Code + Copilot can author SDLC discipline once in `canonical/` and emit per-tool configs.

### Added

- `emitters/_lib/scaffold_emit.py` — shared emitter library (canonical loading, capability resolution, emit reports, steering-file managed sections, generated headers)
- `emitters/cursor/emit.py` — Cursor emitter (Python 3.10+ with PyYAML + Jinja2). Emits `.cursor/rules/<name>.mdc` per glob-applicable skill + scaffold-managed section in `.cursorrules`. Inline-in-steering fallback for invocation-only skills (audit, session-harvest).
- `emitters/cursor/README.md` — phase-to-globs heuristic table + adopter workflow
- `emitters/cursor/templates/skill.mdc.j2` — Jinja2 template (custom delimiters `<<` `>>` to avoid collision with markdown body)
- `emitters/cursor/test/{golden-input,golden-output,run-test.sh}` — self-test with audit (simple) + sdlc (complex) golden specs
- `emitters/copilot/emit.py` — Copilot agent mode emitter. Emits `.github/instructions/<name>.md` per skill + scaffold-managed section in `.github/copilot-instructions.md`
- `emitters/copilot/README.md` + templates + self-test
- `docs/decisions/0004-three-tier-enforcement.md` — locks the three-tier enforcement model + capability-fallback vocabulary
- `docs/capability-matrix.md` — per-(skill, tool) emit outcome table + per-tier rollup
- F10 + F11 added to `docs/findings/wave4-self-bootstrap.md`; F9 closed
- CI: Python setup, Jinja2 + PyYAML install, both emitter self-tests, tool-capabilities staleness warning (>180 days from `as_of`)
- README quickstart updated for v0.1.2 emitter invocation

### Changed

- `canonical/emitter-contract.md` — clarified generated-header placement (after frontmatter, in markdown comment); added §3.4 steering-file managed-section rule
- `canonical/tool-capabilities.yaml` — no changes (no new tools); `as_of` dates remain `"2026-05-17"`
- F8 status: still open, closes in S6.3 (Claude Code emitter)

### Known gaps (after this release)

- F8: `canonical/skills/` and `skills/` still overlap until S6.3
- Codex, Aider, Continue emitters: pending v0.2+ (signal-driven)
- Per-tool `/scaffold` wrapper skill (single-command bootstrap): S6.3
- See `docs/findings/wave4-self-bootstrap.md` F1-F11 for the full list

## [0.1.1] - 2026-05-17

Canonical spec layer landed (option δ S6.1). Tool-agnostic source-of-truth for skills, agents, and governance rules.

### Added

- `canonical/skills/<name>.md` × 9 (sdlc, plan, plan-next, define, spec, review, refactor, audit, session-harvest): tool-agnostic playbook content with capability-requirement frontmatter
- `canonical/agents/reviewer-agent.md`: tool-agnostic agent spec with capability requirements
- `canonical/governance-rule.schema.md`: formalises ADR-0002's YAML rule contract
- `canonical/tool-capabilities.yaml`: 6-tool registry (claude-code, copilot-agent, cursor, codex, aider, continue) with `as_of` dates
- `canonical/phases.md`: SDLC phase vocabulary + three-tier enforcement model + capability fallback definitions
- `canonical/emitter-contract.md`: every emitter's required inputs/outputs/invocation surface/idempotency/self-test
- `docs/decisions/0003-canonical-spec-format.md`: ADR locking the canonical spec format v1
- `docs/findings/s6.1-handtrace-sdlc-emit.md`: hand-trace of `sdlc` skill through Claude Code / Cursor / Copilot emit paths
- F8 (canonical/ vs skills/ duplication during transition) and F9 (phase-to-globs heuristic lives in Cursor emitter) added to `docs/findings/wave4-self-bootstrap.md`
- README + ARCHITECTURE: forward-references to the canonical layer

### Changed

- Status of the scaffold reframes from "Claude Code SDLC kit" to "tool-agnostic SDLC discipline kit for mixed-tool engineering teams." Three-tier enforcement model documented per ADR-0004 (pending S6.2).

### Known gaps

- F8: `canonical/skills/` and `skills/<name>/SKILL.md` overlap during v0.1.x. S6.2 emitter regenerates skills/ from canonical/, closing F8.
- Cursor + Copilot + Codex + Aider + Continue emitters: pending S6.2 (Cursor + Copilot) and v0.2+ (others).
- See `docs/findings/wave4-self-bootstrap.md` F1-F9 for the full list.

## [0.1.0] - 2026-05-17

Initial public release. Extracted and generalised from RepoNav.

### Added

- Five-layer scaffold: skills, subagents, ADRs, governance, memory.
- Nine SDLC skills: `sdlc`, `plan`, `plan-next`, `define`, `spec`, `review`, `refactor`, `audit`, `session-harvest`.
- ReviewerAgent subagent template.
- ADR template + two charter ADRs.
- Governance YAML rule format + example PreToolUse hook + ratchet documentation.
- Conventions: testing-manifest, memory protocol, session-harvest.
- Document-validity rule and PreToolUse hook (frontmatter contract).
- Hygiene: CI workflow (lint + format check), `.gitignore`, `.editorconfig`.
- Self-bootstrap friction log at `docs/findings/wave4-self-bootstrap.md`.

### Known gaps

- Skills still bear traces of RepoNav-specific paths (e.g. references to `mcp__reponav__analyze`); softened to "your analyser of choice" but not fully generic.
- Governance examples are illustrative (5 universal rules), not a complete production set.
- No active dogfood loop against scaffold's own tree (the analyser hot path is not part of this scaffold by design).
- No subagents beyond ReviewerAgent in v0.1; SeamScout and ParallelReconcile remain RepoNav-internal.
- See `docs/findings/wave4-self-bootstrap.md` for the full list.
