# Wave 4 self-bootstrap — friction findings

**Date:** 2026-05-17
**Context:** S6 (the session that extracted this scaffold from RepoNav) ran with **partial** SDLC battle-testing — see resolution log in the spine repo's transcript / forthcoming session-harvest. The factory itself was not used to gate its own extraction because the scaffold did not yet have the factory installed against its own tree.

This document captures what did not transplant cleanly. Each finding is a concrete known gap, not aspirational backlog.

## Findings

### F1 — No active dogfood loop against scaffold's own tree

**What:** The scaffold ships the skills, agents, and governance shape that compose into a dogfood loop. The scaffold itself does **not** run that loop on its own commits. Its only CI gate is the lint workflow at `.github/workflows/ci.yml` — markdown / YAML / JSON / shellcheck validators.

**Why:** Running the full loop requires a deterministic analyser (RepoNav, or any equivalent) wired against the scaffold's own tree. The scaffold is markdown + YAML + shell; a code-graph analyser produces near-zero signal on this surface. Wiring the loop here would have been theatre.

**What this means for adopters:** the scaffold demonstrates the *shape* of a dogfood loop, with RepoNav-the-product as the case-study evidence. Your project gets a meaningful loop by pointing your analyser at your own code.

**Resolution:** documented gap. Re-evaluate at scaffold v0.2 if a code-bearing surface lands here.

### F2 — `review` skill expects an analyser; scaffold ships none

**What:** `skills/review/SKILL.md` references calling an analyser ("your analyser of choice") at the start of review. The scaffold does not include an analyser implementation.

**Why:** Per the charter (ADR-0001), the scaffold ships shapes, not contents. An analyser is implementation, not blueprint.

**What this means for adopters:** the skill is usable as-is once you wire your analyser of choice. RepoNav is the case-study analyser; substitutes include tree-sitter-driven custom analysers, language-server-based tools, or any deterministic tool that emits a structural summary.

**Resolution:** documented in `ARCHITECTURE.md` §"The dogfood loop" and §"Where this scaffold ends."

### F3 — Subagent template uses a single example, not a library

**What:** `agents/reviewer-agent.md` is the only subagent shipped. The RepoNav source has three (`ReviewerAgent`, `SeamScoutAgent`, `ParallelReconcileAgent`).

**Why:** a conservative v0.1 MVP scope call. The exclusion rationale at the time framed the other two as "too RepoNav-specific" because they reference analyser-specific outputs (seam scoring, parallel-branch reconciliation). On a 2026-05-20 reconsideration that framing was over-conservative: the *roles* (refactor-scout reading any analyser's structural output; parallel-branch reconciler) are generic; only the implementations were RepoNav-specific. The dependency on an analyser is no worse than the existing `review` skill's analyser dependency (F2), which the scaffold accepts as a documented seam. The deferral was an MVP scope decision, not a "they don't generalize" judgement.

**What this means for adopters:** start with `reviewer-agent` as your adversarial pre-review. The locked v0.2 plan (ROADMAP) ships `refactor-scout-agent` and `parallel-reconcile-agent` as generic templates that name their analyser-output dependency explicitly (same pattern as the `review` skill).

**Resolution:** subagent library expansion to ≥3 personas is committed to v0.2 (see ROADMAP "Subagent library expansion"). Until then, write further subagents for project-specific scouting roles as your team identifies them.

### F4 — Skills retain trace references to "your analyser"

**What:** Generalisation of the 9 SDLC skills out of the RepoNav source replaced hard paths (e.g., `.reponav/plan-next-context.md`) with soft phrases ("your analyser's plan-next context artefact"). A reader unfamiliar with the convention may not know what "your analyser" refers to.

**Why:** A full generalisation would have required either (a) shipping a fictional analyser to anchor the skills against, or (b) rewriting each skill to be analyser-agnostic at the structural level. Both were out of S6 scope.

**What this means for adopters:** read `ARCHITECTURE.md` first; it establishes the analyser-as-substrate framing the skills assume.

**Resolution:** the README and ARCHITECTURE.md anchor on the analyser concept. A v0.2 pass could surface an "analyser interface" doc to make the contract explicit.

### F5 — Governance hook is a worked example, not a production engine

**What:** `governance/hook.example.sh` is ~50 lines of bash demonstrating the *shape*. The RepoNav production hook is ~300 lines (caching, exemptions, structured logging, baseline state, multi-tool dispatch). The example does not include any of that.

**Why:** A production hook is project-specific. The scaffold ships the contract (ADR-0002) and a minimal worked example, not a runtime.

**What this means for adopters:** expect to grow the hook as your rule set matures. The shape stays; the body is yours.

**Resolution:** `RATCHET.md` explicitly notes "the real RepoNav hook is ~300 lines." Documented.

### F6 — Eval harness peeled (bundle #2 scope-escape)

**What:** Wave 4's `agent-reliability-scaffold` brief originally bundled the eval harness publish into S6 with a scope-escape clause (peel to Branch D if S6 exceeded 90 min with >30 min eval work still pending). The clause fired.

**Why:** S6's MVP-scaffold scope ran longer than the 90-min trigger window. The eval harness publish is now Branch D, parallel to A.

**What this means for adopters:** the eval-evidence cited in the README (8% → 92%) is from RepoNav's eval harness (sweep 2026-05-03-1905-T6L8). The harness, pre-registration, and raw per-arm results are published at <https://github.com/Mansour-ElCheikh/evals> under `reponav-l8-correctness/`, pinned per the evals manifest (`reponav-l8-correctness/RESULTS.md` records the measured RepoNav branch `eval/pillar1-base-151eba5` and the public-fixture reconstruction) + the recorded model snapshot; see [evals/README.md](../../evals/README.md) (the in-tree breadcrumb) and ROADMAP "Public-flip gate" criterion 7.

**Resolution:** Branch D = the dedicated `evals` repository, built and pushed to <https://github.com/Mansour-ElCheikh/evals> (`reponav-l8-correctness` + `reponav-toon-promotion` + `METHODOLOGY.md`, each pinned). evals went public 2026-05-19 (ROADMAP gate-criterion-7 SATISFIED); see ROADMAP "Public-flip gate" for the scaffold's current criteria status.

### F7 — No MCP latency re-measurement

**What:** An earlier memory entry cited ~117 ms median MCP latency × N calls but no re-measurement happened after the recent format changes (TOON promotion, etc.). The scaffold publishes without fresh latency numbers attached.

**Why:** Deferred — not a v0.1 blocker. Latency claims do not appear in the public scaffold copy; only the correctness lift (8% → 92%) is cited, sourced from the L8/T6 eval.

**What this means for adopters:** the scaffold's case-study evidence is correctness-anchored, not performance-anchored. If you adopt the scaffold and care about latency, run your own measurement against your analyser.

**Resolution:** deferred. Out of S6 scope.

### F8 — `canonical/skills/` and `skills/` carry parallel content during the v0.1.x → v0.2 transition

**Status:** CLOSED — S6.3b (2026-05-18). Claude Code emitter shipped; root `skills/` + `agents/` deleted; `canonical/` is the sole source.

**What:** S6.1 (2026-05-17) added the `canonical/` layer with tool-agnostic source-of-truth specs. S6.2 (2026-05-18) added Cursor + Copilot emitters that regenerate `.cursor/rules/` and `.github/instructions/` from canonical/. The existing `skills/<name>/SKILL.md` files are still the de-facto Claude Code emitter output — hand-maintained, not yet regenerated.

**Why:** S6.3 implements the Claude Code emitter (mirror image of S6.2's Cursor + Copilot emitters), which will regenerate `skills/` from `canonical/`. Until then, `skills/` and `canonical/skills/` carry overlapping content. A maintainer editing a Claude Code-flavoured skill must update both files; the next Claude Code emitter run will overwrite hand edits in `skills/`.

**What this means for adopters:** during v0.1.x → v0.2, treat `canonical/skills/<name>.md` as the *intent*. For Cursor or Copilot, run the emitter and ignore `skills/`. For Claude Code consumers, the hand-maintained `skills/<name>/SKILL.md` files are the working version; edit them only with the understanding that S6.3 will regenerate them from canonical/.

**Resolution:** S6.3b shipped `emitters/claude-code` (TS), regenerating `.claude/skills/<name>/SKILL.md` + `.claude/agents/<name>.md` from `canonical/`. The hand-maintained root `skills/` (9 dirs) + `agents/reviewer-agent.md` were deleted in the same commit. `canonical/` is now the single source of truth across all three emitters. The scaffold's own `.claude/skills/` + `.claude/agents/` + `CLAUDE.md` are gitignored regenerable artifacts (anchored `/.claude/...` so emitter golden fixtures stay tracked); correctness is enforced by the canonical frontmatter validation + ADR-0036 anatomy gate + the Claude Code emitter golden self-test + a CI "emit against self" step. F8 CLOSED.

### F9 — Phase-to-globs mapping (Cursor-specific) lives in the Cursor emitter

**Status:** CLOSED — landed in S6.2 (2026-05-18).

**What:** S6.1's hand-trace surfaced that Cursor's `.cursor/rules/*.mdc` files require a `globs:` array. The canonical skill spec declares `applicable_phases: [<phase>]` but not globs (because globs are tool-specific). S6.2's Cursor emitter owns the phase-to-globs heuristic.

**Resolution:** `PHASE_GLOBS` constant in `emitters/cursor/emit.py` + documented table in `emitters/cursor/README.md` § "Phase-to-globs heuristic". Adopters who want different globs for a specific skill: in `--mode=adopt`, edit `.cursor/rules/<name>.mdc` and remove the `GENERATED FROM:` marker; the emitter preserves your file.

### F10 — Skills with invocation-only phases (audit, session-close) degrade to inline-in-steering on Cursor

**Status:** ACCEPTED — documented limitation of Tier 2.

**What:** Two canonical skills (`audit`, `session-harvest`) have `applicable_phases: [audit]` and `[session-close]` respectively. Cursor's MDC rule system only fires on file-glob matches; there's no slash-command-by-name invocation. These two skills can't sensibly be glob-applied.

**Why:** Cursor (Tier 2) lacks `llm_inline_invocation` support. The canonical spec declares `llm_inline_invocation: required, degrades_to: glob_applied_rule` — but `audit` and `session-harvest` have no glob phase to map to.

**What this means for adopters:** the Cursor emitter inlines `audit` and `session-harvest` into the `.cursorrules` steering file's scaffold-managed section under an "Invocation-only skills" list, but does not emit a `.mdc` rule. Users must invoke these manually (paste the skill content into Cursor's chat / Composer).

**Resolution:** documented in `emitters/cursor/README.md` § "What gets skipped" and the emit-report Degraded section. Adopters who need these skills as proper Cursor invocations would write custom Cursor extensions or accept the manual workflow.

### F11 — Universal capabilities (filesystem_writes, read_only_tools, bash_invocation) not enumerated per-tool

**Status:** ACCEPTED — emitters resolve unknown capabilities as supported-by-default.

**What:** During S6.2 implementation, the emit-time resolver initially treated missing tool-capability fields (e.g. `filesystem_writes` not declared in Cursor's entry) as unsupported — causing skills with `requires.filesystem_writes: required` to skip emit. The fix: add a `UNIVERSAL_CAPABILITIES` set in `emitters/_lib/scaffold_emit.py` containing `{filesystem_writes, read_only_tools, bash_invocation}`. Missing capabilities in this set default to `supports: True`.

**Why:** these are universal — every coding agent can read, write, and invoke shell. Enumerating them in every tool's `tool-capabilities.yaml` entry adds noise without value. Differentiating capabilities (hooks, subagents, lifecycle, invocation) remain explicit.

**What this means for adopters:** when adding a new tool to `tool-capabilities.yaml`, you only need to declare the differentiating capabilities. Universal ones are implicit. If a future tool genuinely lacks one of the universal capabilities (e.g. a "read-only" agent that doesn't write), declare `<capability>.supports: false` explicitly to override the default.

**Resolution:** S6.3a ported the `UNIVERSAL_CAPABILITIES` set into `emitters/_lib/src/capabilities.ts` (TS rewrite); behaviour preserved. Documented in the constant comment + `canonical/emitter-contract.md` §4.

### F12 — Predicate language is TS/JS-only

**Status:** OPEN — re-evaluate at v0.2 (ROADMAP.md).

**What:** S6.3b's rules engine loads adopter-extension predicates from `engine/extensions/*.predicates.{js,mjs}` via dynamic `import()`. Predicates must be JS/TS. A project whose governance checks are most naturally written in Python/Go/Ruby cannot register them natively.

**Why:** the engine is Node (ADR-0005); a native multi-language predicate registry (subprocess protocol, serialisation contract, error mapping) is real surface area not justified at v0.1. The escape hatch — wrap a `child_process` call to any language inside a one-line JS predicate — covers the need without the registry.

**What this means for adopters:** TS/JS predicates are first-class. For another language, write a thin JS predicate that shells out and maps stdout to `Finding[]`. Documented in `engine/extensions/README.md`.

**Resolution:** v0.2 candidate — a `check_command:` rule field that runs an arbitrary shell command and parses a documented finding format. Tracked in ROADMAP.md "shell-out / multi-language predicate support".

### F13 — Generated-header timestamp blocks committing the scaffold's own emitted surface

**Status:** ACCEPTED — resolved by gitignoring the scaffold-repo's emitted output.

**What:** The §3.2 generated-file header includes `GENERATED AT: <timestamp>`. The emitter contract calls this acceptable because "adopters don't diff headers across runs." But when the scaffold dogfoods itself (regenerating its own `.claude/skills/`), every emit changes the timestamp line, so a "commit the emitted surface + CI drift-check via git diff" approach would report perpetual false drift.

**Why:** the header timestamp is metadata, not content (idempotency exception in emitter-contract §5). The conflict only arises if you commit emitted output AND diff it across runs — which the scaffold-repo would, but adopters don't.

**What this means for adopters:** adopters commit their emitted `.claude/` surface normally; they re-emit deliberately, not on every CI run, so the timestamp churn is a non-issue for them. This finding is scaffold-repo-specific.

**Resolution:** S6.3b gitignores the scaffold-repo's own `/.claude/skills/`, `/.claude/agents/`, `/CLAUDE.md` (anchored so emitter golden fixtures stay tracked). Emitted output is treated like `dist/` — a build artifact. Correctness is proven by the golden self-test + anatomy gate + an "emit against self" CI step, not by committing the output. A future option (v0.2): a `--no-timestamp` emit flag for projects that want byte-stable committed output + git-diff drift detection.

### F14 — pnpm requires a one-time `corepack enable`

**Status:** ACCEPTED — documented prerequisite.

**What:** ADR-0005 amended the stack to pnpm, pinned via `package.json`'s `packageManager` field and run through corepack (ships with Node 16.10+). But corepack does not auto-install the `pnpm` shim onto PATH; a fresh environment must run `corepack enable` once before `pnpm` resolves.

**Why:** corepack-managed is the right call (no `npm install -g`, version pinned per-repo) but the `corepack enable` step is easy to miss; the failure mode (`pnpm: command not found`) is unobvious if you assumed pnpm was global.

**What this means for adopters:** run `corepack enable` once per machine. Documented in the README quick-start, every emitter README, and ADR-0005. CI uses `pnpm/action-setup@v4` which handles this automatically.

**Resolution:** documented across READMEs + ADR-0005. No code change; this is an environment prerequisite, named so adopters hitting `pnpm: command not found` find the fix fast.

### F15 — `plan-next` routing duplicates `sdlc` orchestrator logic

**Status:** CLOSED — 2026-06-03 (ADR-0011).

**What:** The 2026-05-18 SDLC redundancy audit (§2c) found that `plan-next`'s epic-status → phase routing table duplicates logic inside the `sdlc` orchestrator. Both map "epic.md Status" to "which phase runs next". This is real redundancy — but between `plan-next` and `sdlc`, not between `plan` and `plan-next` (those are different altitudes: decomposition vs selection, and are NOT redundant).

**Why deferred:** S6.4 is a positioning + consolidation wave. The `sdlc` orchestrator is the deterministic-routing differentiator; surgery on its routing contract *during* a positioning rewrite is two destabilisations at once (harvest L7: don't build new on an unproven change; this is the inverse — don't re-cut the foundation mid-story). The redundancy is latent and harmless until touched.

**What this means for adopters:** none today — both skills work; the duplicated routing is consistent, just maintained in two places. The cost is maintenance (a routing change must land in both), not behaviour.

**Resolution:** CLOSED by ADR-0011 (2026-06-03), after S6.4b stabilised the routing contract. The status → phase routing table moved to a single canonical source (`canonical/phases.md` §"Epic-status routing"); `sdlc` (Step 2) and `plan-next` both consume it, neither restates it, so a routing change lands in one place. The roadmap-narrative refresh RepoNav's dropped `update-plan` used to do was folded into `session-harvest` (a `roadmap-staleness` finding category) rather than restored as a skill. The predicted shape landed exactly.

## How to read this document

These are **known** gaps. The scaffold is shipped *with* them, not despite them. Each is small enough to live with at v0.1 and large enough to warrant naming.

If you find an unnamed gap during adoption, please open an issue. Issues citing this document by finding-id (F1–F15) are easier to triage. Status summary lives in [ROADMAP.md](../../ROADMAP.md) § "Open friction".
