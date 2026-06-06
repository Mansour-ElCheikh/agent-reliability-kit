# ADR-0001: Scaffold charter — what ships, what does not

**Status:** Accepted
**Date:** 2026-05-17
**Supersedes:** None
**Amended in part by:** ADR-0007 (2026-05-19) — the "ships shapes, not contents" stance is narrowed for the *universal* governance subset, which now ships enabled-advisory. ADR-0001's charter, MVP scope, and the project-specific-rules guard stand unchanged.
**Amended in part by:** ADR-0008 (2026-05-20) — the "Not a runtime. Nothing executes" framing is reconciled with the working factory (TypeScript engine + emitters + scaffold wrapper that did ship in S6.3a/b). The honest framing is "Not a service or SDK"; the original intent (no production coupling, no daemon, no `import` into application code) is preserved. ADR-0001's adopter-artefact framing (shapes-not-contents for what lands in the adopter's tree) stands unchanged.

## Context

The scaffold was extracted from RepoNav, a codebase-intelligence product with 17 SDLC skills, 3 subagents, 39+ ADRs, 23 governance rules, a PreToolUse hook, a post-commit dispatcher, and a proctor dashboard. Not all of that surface is portable; some of it is RepoNav-specific (analyser predicates, seam detection, tree-sitter wiring) and some is too niche to belong in a generic scaffold (parallel-workflow orchestrator, sanity-fast/deep RepoNav-specific commands).

A first-cut scope decision was needed before extraction work began. The risk of shipping too much: every reader sees noise, the scaffold reads as "RepoNav-with-the-name-changed." The risk of shipping too little: the artefact is not load-bearing and readers cannot adopt it without re-deriving everything.

## Decision

Ship the **MVP scaffold**: the minimum set that lets a reader stand up the five layers (skills, subagents, ADRs, governance, memory) and have something to adapt. Specifically:

| Bucket | Ships in v0.1 |
|---|---|
| Charter docs | README, ARCHITECTURE, LICENSE, NOTICE, CHANGELOG |
| ADRs | template + 0001 (this) + 0002 (governance YAML shape) |
| Skills (9) | `sdlc`, `plan`, `plan-next`, `define`, `spec`, `review`, `refactor`, `audit`, `session-harvest` |
| Subagents (1) | `reviewer-agent` (the ReviewerAgent template) |
| Governance | `governance.yaml.example` (3–5 universal rules), `hook.example.sh`, `RATCHET.md` |
| Conventions | `testing-manifest.json.example`, `memory-protocol.md`, `session-harvest.md` |
| Hygiene | `.github/workflows/ci.yml`, `.gitignore`, `.editorconfig`, `.claude/settings.json` |
| Findings | `docs/findings/wave4-self-bootstrap.md` |

Does **not** ship in v0.1:

- Subagents `SeamScoutAgent`, `ParallelReconcileAgent` — too RepoNav-specific.
- Skills `seam-extract`, `seam-extract-workspace`, `sanity-fast`, `sanity-deep`, `parallel-workflow`, `update-plan`, `skill-creator`, `adr`, `build` — niche, RepoNav-specific, or out-of-scope for a starter kit.
- Proctor dashboard scripts — separate surface, not blueprint material.
- The 23 RepoNav governance rules verbatim — the contract format ships; rule contents are project-specific.
- The MCP gate hot path — RepoNav-specific; the *shape* ships (PreToolUse hook example), not the wiring.
- The eval harness — peeled to a separate publish per the scope-escape clause in the source workstream's bundle #2.

## Consequences

- **Reader on-ramp:** a senior engineer should be able to read the README + ARCHITECTURE.md and reach "I understand what this is and how I'd adopt it" in under 90 seconds. The scope above is calibrated to that.
- **Adopter ergonomics:** the scaffold is documents + shell scripts. No installer, no runtime, no SDK. Adopters copy what they need.
- **Drift surface:** RepoNav-specific paths (e.g. `mcp__reponav__analyze`) in extracted skills are softened to "your analyser of choice" but not fully sanitised. v0.2 fully generalises.
- **What this prevents:** the scaffold being mistaken for a framework. It is a kit.
- **What this newly permits:** a future v0.2 that adds back subagents and skills as their generalisations stabilise.

## What this ADR does *not* do

- Does **not** lock the public/private state of the repo. The scaffold is initially private, flipped public after CI green + brand-architect review.
- Does **not** specify the analyser. RepoNav is the case study, not the prescription. Any tool emitting deterministic architecture context fits.
- Does **not** commit to a contribution apparatus. Issues + maintainer-discretion PRs only. Full charter + CLA enable when external PR volume justifies (mirrors the lean-launch posture of the source project).

## Cross-reference

- README.md (the public pitch)
- ARCHITECTURE.md (the layer-by-layer description)
- ADR-0002 (governance YAML shape — the second locked decision)
- docs/findings/wave4-self-bootstrap.md (friction log)
