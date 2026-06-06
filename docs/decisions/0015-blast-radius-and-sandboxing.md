# ADR-0015: Blast radius is a four-layer composition; the kit owns three and contracts the sandbox boundary

**Status:** Accepted
**Date:** 2026-06-04
**Supersedes:** None

## Context

Axis 1 of the external SDLC-factory rubric (`docs/findings/sdlc-axes-scoring-2026-05.md` §Axis 1) asks for environments that limit how much damage an agent can do at runtime. It scored `PARTIAL`: the write-time hook is solid, but environment isolation was "the adopter's responsibility; the scaffold is environment-agnostic", stated as a bare scope-out with no composition story.

Two things made that read as a half-told story rather than a positioning. First, the kit's prevention layers were real but un-narrated as *blast radius*: the `hook` blocks unsafe writes and `scope_containment` fences protected paths, but nothing connected them into "here is how far a wrong move can reach." Second, the destructive-op safety layer added in ADR-0012 (`testing.md` §4: a destructive test must not be able to touch production) is squarely a blast-radius control, but it lived only in the testing convention, unlinked from Axis 1. The net effect: strong prevention, silence on isolation, and the two owned-but-unnarrated layers invisible to a reader scoring the axis.

The constraint is ADR-0001: the kit ships shapes and worked examples, not contents. It must not bundle a sandbox runtime any more than it bundles an analyser. So "close Axis 1" cannot mean "ship a container"; it must mean "own every layer the kit can enforce from the repo and the tool layer, and contract the one it cannot."

## Decision

**Frame blast radius as a four-layer composition and ship `conventions/sandbox.md`. The kit owns Layers 1–3 and provides the wiring contract for Layer 4; the sandbox runtime stays adopter infrastructure.**

- **Layer 1, write-time prevention.** The `hook` refuses an unsafe Edit/Write before it lands (exit 2); `no_secrets` blocks under every profile. Owned, shipped.
- **Layer 2, path-scope containment.** `scope_containment` bounds an agent's writable reach to non-protected paths; the convention shows a worked rule fencing CI config, IaC, and the secrets surface. Owned, shipped.
- **Layer 3, destructive-op safety.** The `testing.md` §4 principle (physical isolation + fail-fast on production-pointed config + assert-target-before-destroy) bounds what a test can destroy at runtime. Owned, shipped (ADR-0012).
- **Layer 4, environment isolation.** The sandbox runtime (devcontainer, microVM, syscall sandbox, restricted shell) is the adopter's. `sandbox.md` is the contract for composing the kit into it: install the Layer-1 hook *inside* the sandbox, mount narrow, keep egress off by default, treat the sandbox as the outer gate and the hook + scope rules as the inner gate (defence in depth).

This makes Axis 1 a positioning, not a gap: the kit provides every layer it can enforce plus a clean composition contract for the one that needs host infrastructure. Re-scored `SOLID` in the 2026-06 finding, with the explicit caveat that Layer 4 is a composition contract, not a bundled runtime.

## Consequences

**For the next contributor:** the blast-radius story is complete and honest. An adopter can see exactly which layers the kit enforces (1–3) and how to wire the layer it does not own (4). The destructive-op safety principle is now connected to the blast-radius narrative instead of stranded in the testing convention.

**Prevents** the "strong prevention, silent on isolation" half-story that read as an omission. It also prevents the opposite failure, over-claiming: the convention states plainly that a markdown contract is not a kernel isolation boundary.

**Permits (the cost):** the kit still ships no sandbox runtime. A team that runs no isolation gets Layers 1–3 only; full defence in depth requires the adopter to stand up Layer 4. That is the deliberate ADR-0001 boundary, the same one drawn around the analyser, accepted because bundling a runtime would betray the kit's positioning and because the kit cannot enforce kernel isolation from inside a repo.

## What this ADR does *not* do

- Does **not** ship a sandbox, container, or VM. Layer 4 stays adopter infrastructure; the devcontainer snippet in the convention is one illustrative option, not a dependency.
- Does **not** add an engine predicate. `scope_containment` and `no_secrets` already exist; `sandbox.md` composes them, it does not add a check. The registry stays at eleven.
- Does **not** mandate a specific isolation runtime or change the `hook` / `scope_containment` behaviour.
- Does **not** touch the SDLC loop, the emitters, or the analyser boundary.

## Cross-reference

- ADR-0001 (ships shapes, not contents) — why the sandbox runtime stays adopter-supplied.
- ADR-0007 (profile ramp) — whether Layers 1–2 warn or block.
- ADR-0012 (`testing.md` §4) — Layer 3, the destructive-op safety principle this links in.
- `docs/findings/sdlc-axes-scoring-2026-05.md` §Axis 1 (the `PARTIAL`) and the 2026-06 re-score (the close to `SOLID`-by-positioning).
- `conventions/sandbox.md` (the convention this ships); `governance/hook.example.sh`; `governance/governance.yaml.example` (`scope_containment`, `no_secrets`).
