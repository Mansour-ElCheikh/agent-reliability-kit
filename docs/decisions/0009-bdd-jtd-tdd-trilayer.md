# ADR-0009: BDD / JTD / TDD trilayer as the canonical spec → build → review modality

**Status:** Accepted (direction-locked; implementation deferred to v0.2)
**Date:** 2026-05-20
**Supersedes:** None (extends ADR-0006, which merged `define` into `spec`)
**Implementation gate:** v0.2 restructure of `spec.md` / `plan.md` / `build.md` / `review.md` changes skill bodies; the skill-eval methodology in [`docs/findings/skill-eval-methodology-2026-05.md`](../findings/skill-eval-methodology-2026-05.md) must re-run on the restructured skills before the v0.2 release ships, since the v0.1 validation only covers current skill bodies.

## Context

[ADR-0006](./0006-merge-define-into-spec.md) merged `define` into `spec`, leaving `canonical/skills/spec.md` as the sole entry to the Define phase. The current `spec.md` body has BDD `Given/When/Then` framing only at the task-row level (column inside the task table); spec-level Acceptance Criteria use loose prose / checklist.

Two adjacent gaps survive this state:

1. **No machine-verifiable shape contract.** The Acceptance Criteria can say *"the response is a JSON object with fields X, Y, Z"* as prose; nothing in the spec → build pipeline validates the shape structurally. Build tests assert behavior but not data contracts; review reads prose.

2. **No explicit traceability** from spec to test. A TDD task can pass without ever citing which Acceptance Criterion scenario it satisfies. This makes review checklist-driven rather than scenario-driven; loses the chain *behavior → shape → execution → verification*.

A coherent, layered, machine-verifiable spec → build → review modality is a genuine differentiator in the AI-SDLC space: most BDD frameworks have no machine-verifiable shape layer; most JSON-Schema / JTD workflows have no behavior framing; most TDD workflows lack explicit upstream traceability. The trilayer addresses all three gaps in one chain.

JTD ([JSON Type Definition, RFC 8927](https://www.rfc-editor.org/rfc/rfc8927)) provides simple, code-generatable schemas for structured JSON outputs. It is intentionally smaller than JSON Schema (fewer ways to express a shape) and is well-suited as the structured-acceptance layer in a BDD scenario whose THEN produces JSON.

## Decision

**Lock the BDD / JTD / TDD trilayer as the canonical spec → build → review modality**, to be implemented in v0.2 via `canonical/skills/spec.md`, `plan.md`, `build.md`, and `review.md` restructure.

| Phase | Modality | Status |
|---|---|---|
| **Spec** | Acceptance Criteria use BDD `Given/When/Then` per scenario. Structured outputs (APIs, data pipelines, schema-bound integrations) declare JTD schemas for the THEN's expected shape. | BDD: **REQUIRED**. JTD: **OPTIONAL** (apply when the acceptance has structured-data outputs; skip when it does not — solo project shipping a UI feature does not need JTD; team building a typed API does). |
| **Plan** | Each TDD task row cites the BDD scenario id and (if applicable) the JTD schema id it targets. | **REQUIRED** when the spec uses BDD. |
| **Build** | RED before GREEN: the failing assertion must show the BDD's THEN does not hold AND (if JTD applies) schema validation fails. | **REQUIRED**. |
| **Review** | Verify every BDD scenario passes + every JTD schema validates against produced outputs. | **REQUIRED**. |

The trilayer composes:

- **BDD** says *the WHAT in human-readable behaviour language* (stakeholder-validatable; agent-readable as concrete expectations).
- **JTD** says *the SHAPE machine-verifiably* (where the acceptance has structured-data outputs).
- **TDD** says *the EVIDENCE the code actually produces it* (failing test before, passing test after).

End-to-end the chain is auditable: a reviewer can trace a passing test back to a JTD schema that validates the test output, back to the BDD scenario the test row cites, back to the Acceptance Criterion in the spec. *That* is what "evidence not vibes" looks like operationalised.

## Consequences

**For v0.2:**

- `canonical/skills/spec.md` restructures: Acceptance Criteria section becomes a list of BDD scenarios (`Given X, When Y, Then Z`); a new optional section accepts JTD schemas for the THEN's structured-data outputs.
- `canonical/skills/plan.md` restructures: the task table gains a "Scenario / Schema" column citing the BDD scenario id and (if applicable) JTD schema id.
- `canonical/skills/build.md` restructures: the RED phase guidance names the BDD's THEN failing + (if JTD applies) schema validation failing as the explicit RED criterion.
- `canonical/skills/review.md` restructures: the checklist gains a "BDD scenarios pass" + "JTD schemas validate against produced outputs" pair of items.
- Emitters regenerate; golden fixtures update.
- ADR-0020 anatomy gate must pass on each restructured skill.

**Prevents:** the failure mode where a TDD task can pass without anyone being able to trace it back to the Acceptance Criterion it was supposed to satisfy. Also prevents the "the output looks right" review verdict that has no structural-data backing.

**Permits (the cost):** JTD is unfamiliar to most teams. Mitigation: JTD is **optional**; BDD is the required floor. Teams new to JTD can start BDD-only and adopt JTD when they have structured-data acceptance to validate. Documentation in `spec.md` should cite RFC 8927 + a JTD primer.

**Permits (the cost):** the spec is heavier to write than the current loose-checklist form. Mitigation: the heaviness is exactly the rigor being claimed; teams that want less rigor can stay on the loose-checklist form (the BDD framing is required structurally but the depth of each scenario is the team's call).

## What this ADR does *not* do

- Does **not** implement the restructure. This ADR locks the direction; v0.2 implements `spec.md`, `plan.md`, `build.md`, `review.md`.
- Does **not** add JTD to the engine. The engine is concerned with governance rules, not acceptance schemas; JTD validation happens in the adopter's test layer.
- Does **not** mandate the trilayer for adopters using the scaffold for v0.1 projects. v0.1 projects can run the current spec.md unchanged; the v0.2 restructure is opt-in for projects that explicitly adopt the trilayer modality.
- Does **not** replace TDD. TDD is the execution discipline; BDD is the spec-level framing; JTD is the structured-acceptance layer. The three compose; none is a substitute for another.

## Cross-reference

- [ADR-0006](./0006-merge-define-into-spec.md) — the prior merge of `define` into `spec`; this ADR extends `spec`'s scope
- [`canonical/skills/spec.md`](../../canonical/skills/spec.md) — current implementation (BDD at task-row level only; v0.2 restructure target)
- [`conventions/verification.md`](../../conventions/verification.md) — the verification-by-evidence principle this trilayer operationalises
- [`docs/findings/comparison-vs-flat-skill-models.md`](../findings/comparison-vs-flat-skill-models.md) — the topology context; the trilayer is a deepening of the hierarchical model's evidence chain
- RFC 8927 — JSON Type Definition
