# ADR-0005: Node-only stack + npm workspaces packaging

**Status:** Accepted
**Date:** 2026-05-18
**Supersedes:** None
**Supersedes (implicitly):** S6.1 / S6.2 Python emitter implementations (rewritten to TS in S6.3a)

## Context

S6.1 (canonical layer) and S6.2 (Cursor + Copilot emitters) shipped emitter code in Python. The pick was tactical: PyYAML + Jinja2 are mature, and the implementer (Claude in S6.1) chose ergonomic libraries without re-litigating against ADR-0011 and ADR-0012 from the predecessor RepoNav repo.

Re-grounded in those predecessor ADRs during S6.3 design review (v2, 2026-05-18):

- **RepoNav ADR-0011** (2026-03-17) — "Implement a governance engine (`src/governance/coreRules.ts`)." TypeScript.
- **RepoNav ADR-0012** (2026-03-17) — "Create a standalone `governance-kit` repository containing... a config-driven TypeScript rule engine." Explicitly: "Engine requires Node.js runtime (JS/TS only)."
- **RepoNav production hook** — `.reponav/hooks/governance-gate.mjs`. Node.

The scaffold inherits the predecessor decision intent. Python in S6.1 was a drift, not a re-design. v2 of the S6.3 design review surfaced this; the user locked the correction on 2026-05-18.

A separate question landed alongside: how should the scaffold be packaged for downstream consumption? Three shapes were considered:

1. Single flat repo, no package boundary → simple, no install path for selective adoption.
2. Multi-repo (engine + emitters as separate Git repos) → strong boundary, heavy maintenance overhead at v0.1 scale.
3. npm workspaces inside one repo → boundary without multi-repo overhead. Adopters `npm install @reliability-scaffold/engine` or the full scaffold as they prefer.

## Decision

### Part 1: TypeScript everywhere

The rules engine, all per-tool emitters, the shared emitter library, and the `/scaffold` wrapper script ship as TypeScript transpiled to Node 20+. The previous Python implementations are removed in S6.3a (`emitters/_lib/scaffold_emit.py`, `emitters/cursor/emit.py`, `emitters/copilot/emit.py` rewritten as `.ts` siblings, Python originals deleted; no legacy preserved).

Library choices (locked for v0.1):

| Need | Library | Reason |
|---|---|---|
| YAML | `js-yaml` | mature, matches PyYAML semantics |
| Templating | `nunjucks` | Jinja2-compatible delimiters via `env.tags`; trim/lstrip parity |
| CLI | `commander` | standard, low peer-dep churn |
| Glob | `picomatch` | RepoNav's existing pick |
| Tests | `vitest` | RepoNav's runner |
| Lint | shipped: none in v0.1 | typescript-eslint deferred to v0.2 |

### Part 2: pnpm workspaces (corepack-managed) packaging

The scaffold repo is one workspace root:

```
package.json (root, type: "module", packageManager: "pnpm@9.x")
pnpm-workspace.yaml         (declares workspaces)
├── engine/                 # @reliability-scaffold/engine
├── emitters/
│   ├── _lib/               # @reliability-scaffold/emit-lib
│   ├── claude-code/        # @reliability-scaffold/emit-claude-code
│   ├── cursor/             # @reliability-scaffold/emit-cursor
│   └── copilot/            # @reliability-scaffold/emit-copilot
├── scripts/
│   └── scaffold.ts         # standalone wrapper
└── tsconfig.base.json      # shared TS config
```

Each workspace package has its own `package.json` + `tsconfig.json` extending `tsconfig.base.json`. The shared `_lib` is imported by all emitters via the `workspace:*` protocol.

**Why pnpm** (amended from initial npm choice on 2026-05-18 mid-S6.3b):

- **Strict node_modules layout**: a workspace's source can only import its declared `dependencies` + `peerDependencies`. Eliminates phantom-dep bugs that work locally but break for adopters whose npm resolution flattens differently.
- **Workspace ergonomics scale better**: at v0.2 the scaffold has 5+ packages (engine + 5 emitters + scaffold wrapper). `pnpm -F <pkg> build` and `pnpm -r build` stay readable; npm workspaces verbose syntax does not.
- **Content-addressable store**: faster install + smaller disk footprint via hardlinks. Most adopters with multiple Node projects see this immediately.
- **`workspace:*` protocol** is enforced (`@reliability-scaffold/emit-lib: workspace:*` resolves locally always; never accidentally pulls a published version mid-development).

**Corepack as the install mechanism**: pnpm is pinned via the `packageManager` field in `package.json`. Adopters run `corepack enable` once (`corepack` ships with Node 16.10+). After that, `pnpm` is on PATH and `pnpm install` works without a global pnpm install. ADR-0005 does NOT require adopters to `npm install -g pnpm`.

### Part 3: CI workflow is pure Node + pnpm

The scaffold's own `.github/workflows/ci.yml` migrates from Ruby (YAML parse) + Python (staleness check) + bash (validators) to pure Node + pnpm + bash. One runtime setup, one package manager, faster CI, simpler review. Workflow uses `pnpm/action-setup@v4` (reads `packageManager` from `package.json`) + `actions/setup-node@v4` (cache: 'pnpm') + `pnpm install --frozen-lockfile` for deterministic CI installs.

## Consequences

**Positive:**
- Aligns with RepoNav's ADR-0011 / ADR-0012 (predecessor decisions, not departing without cause).
- Single-runtime adoption story: adopters need Node only. No Python install, no Ruby install.
- Job-positioning consistency: RepoNav (TS) + scaffold (TS) reads as coherent stack thinking, not polyglot scattering.
- Workspaces let adopters install just the engine (`npm install @reliability-scaffold/engine`) without the rest. v0.2 npm-publish doesn't require restructuring.
- CI runs faster (one runtime, not three).

**Negative:**
- One-time rewrite cost: ~600 LOC across `_lib`, Cursor, Copilot. Mechanical work; S6.3a's first deliverable.
- Two emitter golden-output sets may need regeneration if TS implementation produces subtly different formatting from Python. Diffs captured intentionally in the S6.3a PR.
- `nunjucks` is less load-bearing than Jinja2 in the broader ecosystem. If a future emitter needs a templating feature `nunjucks` lacks, swapping is workspace-local (single `_lib` change).

**Risks:**
- Workspace setup adds one layer of `package.json` config to grok. Mitigated: tsconfig + workspace shape documented in this ADR + README's Stack section.
- Adopters on Python-heavy projects (data science, ML) may push back. Mitigated: predicates in `engine/extensions/` can shell out to Python via Node's `child_process` — TS-required for the registry, not for the predicate's actual computation.

## Cross-reference

- RepoNav ADR-0011, ADR-0012 (predecessor decisions)
- ADR-0001 (scaffold charter — "ships shapes, not contents"; this ADR refines the shape's runtime)
- ADR-0003 (canonical spec format) — unchanged by this ADR
- ADR-0004 (three-tier enforcement) — unchanged by this ADR
- ROADMAP.md — tracks v0.2 dependencies (typescript-eslint, npm-publish). (The S6.3 design-review record is an internal-process artefact and is not in the public tree.)

## What this ADR does NOT do

- Does NOT mandate adopter projects use TS. Adopters with Python / Go / Rust projects use the scaffold by invoking `npx` or pre-compiled binaries; their own code stays whatever language they use.
- Does NOT prescribe a specific templating engine for `nunjucks` features. Templates are emitter-local; switch if needed.
- Does NOT require the rules engine to be the only governance evaluator. Adopters with their own engine wire `governance.yaml` to it.
