# ADR-0007: Universal governance rules ship enabled (advisory); project-specific rules ship as shape; `profile` governs severity and coordination

**Status:** Accepted
**Date:** 2026-05-19
**Supersedes:** None (amends ADR-0001 in part)

## Context

ADR-0001 chartered the scaffold to ship "shapes, not contents": `governance.yaml.example` carries a placeholder rule set, and an adopter authors their own invariants. The stated risk it guarded against: shipping one project's rules reads as "RepoNav-with-the-name-changed," and a wrong-for-their-project rule blocking an adopter's commit on day one destroys trust.

Three things have changed since ADR-0001 (2026-05-17):

1. **ADR-0001 conflated two different things.** "Project-specific rules" (RepoNav R17 seam detection, domain boundaries, editorial/brand voice) genuinely should not ship enabled. But *universal engineering hygiene* — test-first, no-secrets, scope-containment, planning-doc validity, skill anatomy — is industry consensus, not one project's opinion. ADR-0001's blanket "shapes only" suppressed the universal subset along with the project-specific subset. A cross-reference of an external agentic-pipeline framework (the user's 2026-05-18 review: "6 components / 6 stages / 4 principles") found its principles are largely a *subset* of what the scaffold already operationalizes, and that the scaffold independently converged on the framework's most distinctive item (per-skill anti-rationalization tables) — evidence the universal core is consensus, not personal philosophy.

2. **The S6.4a soft-start severity model did not exist when ADR-0001 was written.** Rules can now ship at `severity: warn` (record, do not block) with a documented one-line ramp to `error` (the R2 / R2b pattern). This removes the precise day-one-blocking failure ADR-0001's inertness was protecting against: a universal rule shipped enabled-but-advisory does not block anyone's commit.

3. **The 2026-05-18 pre-ship eval established that governance is the certified value spine.** Skill *discrimination* and *behavioral conformance* are certified (run_eval 42/42 + a faithful real-skill harness 12/12 + correct sibling-routing; build/spec/plan behavioral spot-checks 3/3); implicit skill-trigger *rate* is an uncertified tooling-measurement gap (spine harvest `wave4_s6_4b_harvest_2026-05-18.md` L7). The deterministic guarantee the kit actually makes runs through the governance hook/engine, not through an agent spontaneously invoking a skill. Shipping that spine inert as `.example` placeholders hollows the kit's strongest, demonstrated differentiator — especially for the repo's primary purpose (public evidence of capability, where a reviewer cloning it must see real gates fire, not placeholders).

## Decision

**Ship a curated Universal Default Set enabled; ship project-specific rules disabled as labelled shape; a `profile` field governs severity ramp and coordination model.**

1. **Universal Default Set — ships enabled, `severity: warn`, documented one-line ramp to `error`:** `tdd_test_first`, `scope_containment`, `doc_validity`, `skill_anatomy`. Each is consensus engineering hygiene with in-repo evidence of value, not project-specific vocabulary.

2. **`no_secrets` ships at `severity: error` in every profile.** Secrets are never a `warn`-acceptable condition. The soft-start eases *discipline* friction, never *safety*.

3. **Project-Specific Set — ships disabled, labelled shape-only:** editorial/brand-voice (e.g. em-dash gate), domain/seam rules (R17-class), language/framework predicates, commit-message style. ADR-0001's anti-"RepoNav-renamed" guard continues to govern exactly this subset.

4. **`profile: solo | team`** in `governance.yaml`:
   - **solo** — universal rules stay `warn`; ratchet records but does not block; CI annotates, does not fail. Minimum friction working alone.
   - **team** — universal rules ramp to `error`; ratchet blocks; CI is a required check.
   - The profile also selects the **coordination model**: the scaffold **composes with a team's existing git / PR / sprint process and does not impose a commit, branch, or wave workflow on teams.** The solo parallel-agent-session discipline (waves, post-commit debounce, baseline-before-patch) is solo-profile guidance only. The full solo/team coordination decomposition is deferred; this ADR locks only the composes-not-impose contract.

5. **The scaffold's own repository runs `profile: team` / strict.** The public artifact must demonstrate full enforcement; `solo` is an adopter ergonomic, not the showcase configuration.

ADR-0001 is **amended in part, not superseded**: its charter, MVP scope, and the project-specific-rules guard stand; only its blanket application of "shapes only" to the *universal* governance subset is narrowed by this ADR.

## Consequences

**Working factory day one:** `git clone` → `/scaffold` bootstrap → a planted violation actually triggers a gate. The kit's strongest, eval-certified property (deterministic enforcement) becomes *demonstrated on clone*, not merely *described*. For the repo's primary purpose this converts the single biggest credibility hole (governance shipped inert) into the demo.

**Prevents:** a reviewer or adopter concluding the governance layer is decorative; and the day-one-blocking trust failure (mitigated by `warn` default + ramp + `solo` profile).

**Permits (the cost):** `governance.yaml` is now opinionated for the universal subset. Mitigation: the set is deliberately small, consensus-only, advisory by default, and profile-aware. The Universal Default Set is now an ADR-gated curated list — **adding a universal rule requires an ADR demonstrating it is consensus hygiene, not personal workflow.** "It is my preferred practice" is not sufficient; that class ships in the project-specific shape set.

**New contract for teams:** the kit explicitly does not impose a branch/commit/wave workflow. Teams adopt the universal hygiene + governance and keep their own coordination process. This is a stated, testable property, not an implicit one.

## What this ADR does *not* do

- Does **not** ship project-specific rules enabled (the ADR-0001 guard stands for that subset).
- Does **not** flip the repository public. Public visibility remains separately gated (external review + the locked public-flip criteria).
- Does **not** implement the full solo/team coordination decomposition (deferred; only the composes-not-impose contract is locked here).
- Does **not** change the analyser stance, the canonical spec format, or the SDLC phase vocabulary.

## Cross-reference

- ADR-0001 (charter — amended in part by this ADR)
- ADR-0002 (governance YAML shape — the rule contract this set instantiates)
- `governance/governance.yaml.example` (the Universal Default Set + labelled project-specific shape)
- spine harvest `wave4_s6_4b_harvest_2026-05-18.md` L7 (internal session-memory record, not in the public tree; the eval finding it captures, governance is the certified spine and skill-trigger rate is the uncertified gap, has its public account in `docs/findings/skill-eval-methodology-2026-05.md`)
- `conventions/verification.md` (names the verification-by-evidence principle this enforcement embodies)
- Implementation naming clarification: this ADR's §Decision lists `skill_anatomy` as a Universal Default Set member; the implemented rule id in `governance.yaml.example` is `skill_anatomy_size` (using the `prompt_size_warn` predicate). Same rule, naming refined during implementation; the ADR body records the design intent, the governance file records the live name.
