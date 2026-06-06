---
validity: current
as_of: 2026-05-20
expires_after_days: 180
---

# Scaffold scored against an external 11-axis software-factory rubric

> **Superseded by [`sdlc-axes-scoring-2026-06.md`](sdlc-axes-scoring-2026-06.md).** This is the 2026-05-20 snapshot (it reads "9 predicates / 9 ADRs / 21 tests", accurate at that date), preserved unedited for chronology. The current score is 9 SOLID / 1 PARTIAL / 1 OUT OF SCOPE against the same rubric; see the 2026-06 re-score.

This finding scores `agent-reliability-scaffold` (v0.1.3-dev) against an external rubric for "software factory" operating models around AI coding agents, authored by a third party in the AI-SDLC space in mid-May 2026. The rubric enumerates eleven concrete properties such a factory tends to include. We score each axis honestly: what the scaffold ships against each, what is partial, what is out of scope by design.

The source rubric is not named in this artefact (per the repo's no-external-names-in-public-docs convention). The 11 axes are paraphrased close to the source wording; quotation is limited per copyright respect.

## Method

For each axis:
- **What the rubric asks for:** paraphrased.
- **What this scaffold ships:** the concrete artefact(s) that address (or do not address) the axis.
- **Score:** `SOLID` (axis fully addressed by scaffold-shipped components), `PARTIAL` (addressed but with honest deferrals or scope gaps), `OUT OF SCOPE` (deliberately not addressed by the scaffold's positioning; the responsibility lives in a complementary surface).
- **Evidence:** line-cited file paths so a reviewer can verify without taking this finding's word for it.

Scoring is against the scaffold's v0.1.3-dev state at flip-time. v0.2 commitments that would change a score are noted but do not count toward the score (this is a measurement of what ships, not what is promised).

---

## Per-axis scoring

### Axis 1: Development environments that constrain blast radius

**What the rubric asks for:** environments (devcontainers, sandboxes) that limit how much damage an agent can do at runtime.

**What this scaffold ships:** write-time constraint via the engine's `hook` subcommand — Edit/Write tool calls are intercepted before they touch the filesystem; `error`-severity rules exit 2 (block the write); `no_secrets` safety rule fires regardless of profile. The hook is a different *kind* of blast-radius constraint than environment isolation: it blocks unsafe writes before they happen rather than containing damage after. Environment-level isolation (devcontainer, sandbox) is the adopter's responsibility; the scaffold is environment-agnostic.

**Score:** `PARTIAL` — solid at the write-time-gate layer; out of scope at the environment-isolation layer.

**Evidence:** `engine/src/cli.ts` (`hook` subcommand); [`governance/hook.example.sh`](../../governance/hook.example.sh); [`engine/README.md`](../../engine/README.md) exit-code 2 semantics; [ADR-0007](../decisions/0007-universal-rules-ship-enabled.md) safety-rule ramp.

---

### Axis 2: Project instructions that are slim, maintained, and actually used

**What the rubric asks for:** documentation and conventions agents load on demand, kept slim and current.

**What this scaffold ships:** 12 canonical skills + 1 subagent, each one tool-agnostic markdown file in `canonical/`. The anatomy gate (ADR-0036) enforces structural conformance on every commit. The skill bodies are eval-validated per the published methodology (skill-description discrimination 42/42; behavioural conformance 3/3 spot-checks). Emitters render each skill into per-tool surfaces (`.claude/skills/`, `.cursor/rules/`, `.github/instructions/`) so the agent actually loads them.

**Score:** `SOLID`.

**Evidence:** [`canonical/skills/`](../../canonical/skills/) (12 files); [`scripts/check-anatomy.mjs`](../../scripts/check-anatomy.mjs); [`docs/findings/skill-eval-methodology-2026-05.md`](skill-eval-methodology-2026-05.md); 3 emitter self-tests pass.

---

### Axis 3: Rules, ADRs, and documentation that agents can load on demand

**What the rubric asks for:** governance rules, decision records, and docs in formats agents can ingest.

**What this scaffold ships:** YAML governance rule contract (`governance.yaml.example`) with 9 deterministic predicates; ADRs in `docs/decisions/` (9 ship as worked examples), each with `Status` / `Date` / `Supersedes` frontmatter; the `decision_keyword_without_adr` predicate flags decision-language commits without a new ADR. Canonical skill bodies are markdown the agent reads.

**Score:** `SOLID`.

**Evidence:** [`governance/governance.yaml.example`](../../governance/governance.yaml.example); [`docs/decisions/`](../decisions/) (9 ADRs); [`engine/src/predicates.ts`](../../engine/src/predicates.ts) `decision_keyword_without_adr`; [`canonical/governance-rule.schema.md`](../../canonical/governance-rule.schema.md).

---

### Axis 4: Work sliced into small, independently-deliverable increments

**What the rubric asks for:** small PRs / commits that are reviewable and rollback-able, rather than giant agent-produced changesets.

**What this scaffold ships:** the `spec` skill enforces a task table with one `given/when/then` per task; the `build` skill is an instructional RED/GREEN/REFACTOR runner that executes one slice at a time; `plan-next` selects the next concrete step from a plan. The structure pushes work into deliverable units by construction.

**Score:** `SOLID`.

**Evidence:** [`canonical/skills/spec.md`](../../canonical/skills/spec.md) (task-table structure); [`canonical/skills/build.md`](../../canonical/skills/build.md) (slice-at-a-time runner); [`canonical/skills/plan-next.md`](../../canonical/skills/plan-next.md).

---

### Axis 5: Planning and review loops before implementation begins

**What the rubric asks for:** explicit plan + review phases before code lands, not retrospective review only.

**What this scaffold ships:** the `plan` skill is read-only Plan Mode + ordered TDD task table + dependency map + risk surfacing; the `review` skill invokes the adversarial subagent before commit; the `sdlc` orchestrator enforces phase ordering (no `build` before `plan`). The adversarial subagent (`reviewer-agent`) is genuinely critical: returns PASS/FAIL/PASS WITH WARNINGS with line-cited issues; rejects vague acceptance criteria, untestable tasks, boundary violations, ADR contradictions.

**Score:** `SOLID`.

**Evidence:** [`canonical/skills/plan.md`](../../canonical/skills/plan.md); [`canonical/skills/review.md`](../../canonical/skills/review.md); [`canonical/agents/reviewer-agent.md`](../../canonical/agents/reviewer-agent.md); [`canonical/skills/sdlc.md`](../../canonical/skills/sdlc.md) phase-dispatch logic.

---

### Axis 6: Deterministic scripts for anything the agent should not reason about every time

**What the rubric asks for:** code, not LLM reasoning, for tasks where reliability matters.

**What this scaffold ships:** 9 deterministic predicates in the engine, each implemented as TypeScript code with vitest fixtures (21 tests passing); zero LLM dependency in the predicate path; emitter rendering is template-based, not LLM-generated; anatomy gate is `scripts/check-anatomy.mjs`. The whole "rules engine + emitter + anatomy" axis runs as deterministic Node code.

**Score:** `SOLID`.

**Evidence:** [`engine/src/predicates.ts`](../../engine/src/predicates.ts); [`engine/test/audit.test.ts`](../../engine/test/audit.test.ts) (21 tests); [`emitters/`](../../emitters/) (claude-code, cursor, copilot — all TS, all template-based); [`scripts/check-anatomy.mjs`](../../scripts/check-anatomy.mjs).

---

### Axis 7: Hooks that block unsafe actions instead of politely suggesting better behaviour

**What the rubric asks for:** mechanical enforcement that prevents bad outcomes, not advisory warnings the agent can ignore.

**What this scaffold ships:** the `hook` subcommand blocks on `error`-severity findings (exit 2). The Universal Default Set includes `no_secrets` as a safety rule that blocks under both `solo` and `team` profiles; other universal rules ramp from advisory (solo) to blocking (team). Tier 1 tools (Claude Code, Copilot agent mode) get write-time blocking; Tier 2/3 tools get commit-time blocking via `audit --staged`.

**Score:** `SOLID`.

**Evidence:** [`engine/src/cli.ts`](../../engine/src/cli.ts) `hook` subcommand exit codes; [`governance/hook.example.sh`](../../governance/hook.example.sh) wired-to-engine; [ADR-0007](../decisions/0007-universal-rules-ship-enabled.md) profile-driven ramp; [`docs/capability-matrix.md`](../capability-matrix.md) per-tier enforcement.

---

### Axis 8: Focused review personas (security, architecture, accessibility, performance, AI-specific risks)

**What the rubric asks for:** multiple specialised review personas, each with a narrow scope, applied where relevant.

**What this scaffold ships:** one canonical subagent (`reviewer-agent`) for general adversarial pre-review (vagueness, redundancy, scope creep, architectural violations, ADR contradictions). The persona library is not expanded beyond this in v0.1. F3 in the friction log tracks this honestly as an MVP scope deferral, not a generalisability judgement; specific personas (security, accessibility, performance, refactor-scout, parallel-reconcile) will land when adopter friction surfaces concrete need, not speculatively (ROADMAP "Considered but not committed" section).

**Score:** `PARTIAL` — one persona shipped against an axis that calls for many; honest deferral framing.

**Evidence:** [`canonical/agents/reviewer-agent.md`](../../canonical/agents/reviewer-agent.md); [`docs/findings/wave4-self-bootstrap.md`](wave4-self-bootstrap.md) §F3; [`ROADMAP.md`](../../ROADMAP.md) "Considered but not committed".

---

### Axis 9: Browser-driven QA evidence for user-facing changes

**What the rubric asks for:** automated UI QA producing screenshot / interaction evidence as part of the agent's delivery artefact.

**What this scaffold ships:** nothing on this axis. The scaffold is build-time discipline, not runtime QA; analyser-agnostic and QA-tooling-agnostic by design. The README explicitly says "not a service or SDK" and "not an analyser." Adopters wire their own QA layer; the scaffold's `review` skill can consume QA evidence if the adopter feeds it in.

**Score:** `OUT OF SCOPE` — by deliberate positioning, not by omission. The scaffold occupies the build-time layer; runtime QA is a complementary surface the scaffold composes with rather than provides.

**Evidence:** [`README.md`](../../README.md) "What it is not" section; [`canonical/skills/review.md`](../../canonical/skills/review.md) (declares what it reads from analyser output if present).

---

### Axis 10: A codification step where lessons become rules, hooks, ADRs, or evals

**What the rubric asks for:** an organisational mechanism that converts every painful lesson into a durable artefact that prevents the next instance.

**What this scaffold ships:** this is the scaffold's core value proposition. Every category the axis names has a concrete shipped place in the kit:
- **Rules:** `governance.yaml` predicates; 9 built-in, adopter-extensible via `engine/extensions/`
- **Hooks:** `governance/hook.example.sh` wired to the engine
- **ADRs:** `docs/decisions/NNNN-*.md` with `decision_keyword_without_adr` predicate forcing one when the commit decides something
- **Evals:** evals breadcrumb to public per-arm data; the scaffold's own skill-eval methodology

The `session-harvest` skill explicitly flushes lessons into `memory/*.md` at session close. The Universal Default Set ships enabled (per ADR-0007) so adopters get the codified-discipline-as-default experience.

**Score:** `SOLID`.

**Evidence:** [`canonical/skills/session-harvest.md`](../../canonical/skills/session-harvest.md); [`docs/decisions/`](../decisions/) (9 ADRs as worked examples); [`governance/governance.yaml.example`](../../governance/governance.yaml.example); [`evals/README.md`](../../evals/README.md); [ADR-0007](../decisions/0007-universal-rules-ship-enabled.md) enabled-by-default.

---

### Axis 11: Metrics for pipeline-improvement vs activity

**What the rubric asks for:** measurements that tell you whether the agent pipeline is actually getting safer/better over time, not just producing more output.

**What this scaffold ships:** the ratchet (`.governance-baseline.json`) tracks warning count over time and refuses regressions — that is one improvement metric. The skill-eval methodology produces pass/fail metrics with line-cited evidence. The case-study eval produces the lift number (8% → 92%) with pre-registered pooled per-arm rates. What is missing: a first-class metrics dashboard, a session-event log writer for telemetry (schema exists; emitter deferred to v0.2), and dimensions other than warning-count (e.g. cycle-time, review latency, rejection rate).

**Score:** `PARTIAL` — ratchet + eval-methodology are real metrics; first-class observability surface and richer metric dimensions are v0.2 work.

**Evidence:** [`governance/RATCHET.md`](../../governance/RATCHET.md); [`docs/findings/skill-eval-methodology-2026-05.md`](skill-eval-methodology-2026-05.md); [`ROADMAP.md`](../../ROADMAP.md) "Session-event log emitter" v0.2 commitment.

---

## Summary

| Axis | Score |
|---|---|
| 1: Blast-radius constraint | PARTIAL (write-time gate solid; env isolation adopter's) |
| 2: Slim maintained instructions | SOLID |
| 3: Rules + ADRs + docs loadable | SOLID |
| 4: Small independent slices | SOLID |
| 5: Planning + review loops | SOLID |
| 6: Deterministic scripts | SOLID |
| 7: Blocking hooks | SOLID |
| 8: Focused review personas | PARTIAL (one persona shipped, others honestly deferred) |
| 9: Browser-driven QA | OUT OF SCOPE (by positioning) |
| 10: Codification step | SOLID |
| 11: Pipeline metrics | PARTIAL (ratchet + eval metrics; richer observability v0.2) |

**Net:** 7 SOLID, 3 PARTIAL with honest deferral framings, 1 OUT OF SCOPE by deliberate positioning. The scaffold covers seven of eleven axes solidly, three partially with explicit roadmap commitments or scope-decision framings, and one axis is outside the scaffold's positioning (runtime/QA layer is a complementary surface).

## What this scoring does *not* claim

- **Does not claim "full software-factory compliance."** Three axes are partial; one is out of scope. An organisation adopting this scaffold gets the build-time discipline + governance + ADRs + adversarial review + codification cycle; runtime / browser-QA / environment-isolation are complementary layers the scaffold composes with rather than provides.
- **Does not claim adopter outcomes match the case study's lift.** The 8% → 92% lift number was measured in a specific harness (analyser-paired) and is reproducible from the public evals repository. Adopter outcomes depend on which analyser they wire (if any), which tools they use, which axes of their own operating model they invest in.
- **Does not commit to closing the partial axes on a fixed timeline.** The ROADMAP "Considered but not committed" section explicitly defers specific persona expansion + richer observability pending adopter-friction evidence.

## What this scoring does claim

- **Substance matches positioning.** The README's "AI-SDLC infrastructure: SDLC factory + governance engine" claim is supported by 7 SOLID + 3 PARTIAL axes against an external rubric.
- **Eval-validated discipline at v0.1.** Skill bodies are eval-locked (skill-description discrimination 42/42, behavioural conformance 3/3); changes require re-eval per the published methodology.
- **Honest scope.** Axes 8, 9, 11 are not handwaved; they are scored partial / out-of-scope with explicit reasoning and roadmap framing.

## Cross-reference

- [`docs/findings/skill-eval-methodology-2026-05.md`](skill-eval-methodology-2026-05.md): the skill validation methodology referenced above
- [`docs/findings/comparison-vs-flat-skill-models.md`](comparison-vs-flat-skill-models.md): hierarchical SDLC topology differentiation
- [`docs/findings/wave4-self-bootstrap.md`](wave4-self-bootstrap.md): F-items above (F1-F15 friction tracking)
- [`README.md`](../../README.md): the positioning this scoring validates
- [`ROADMAP.md`](../../ROADMAP.md): "Committed" vs "Considered but not committed" v0.2 framing
- [ADR-0007](../decisions/0007-universal-rules-ship-enabled.md): Universal Default Set + profile-driven severity ramp
- [ADR-0009](../decisions/0009-bdd-jtd-tdd-trilayer.md): BDD/JTD/TDD direction (axis 1 + axis 4 deepening planned for v0.2)
