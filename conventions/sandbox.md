# Blast-radius and sandboxing

**Blast radius** is how much damage one wrong agent move can do before something stops it. There are four layers. This kit owns the three it can enforce from inside the repo and the tool layer; the fourth, the sandbox runtime itself, is the adopter's infrastructure, and this convention is the contract for wiring the kit's layers into it.

The kit is **environment-agnostic** the same way it is analyser-agnostic (ADR-0001): it does not bundle a sandbox, a container, or a VM. It ships the write-time discipline and the composition contract; you bring the isolation runtime.

---

## Layer 1: write-time prevention (the hook)

The governance `hook` subcommand intercepts an Edit/Write **before it touches disk**. An `error`-severity rule exits 2 and the write never happens; `no_secrets` blocks under every profile. This is prevention, not containment: the bad write is refused, not cleaned up afterward.

Because the hook runs in the agent's tool layer (a Claude Code PreToolUse hook, a commit-time gate for Tier 2/3), it works **inside whatever environment you run the agent in**. Wiring: [`governance/hook.example.sh`](../governance/hook.example.sh).

## Layer 2: path-scope containment (`scope_containment`)

`scope_containment` fences writes to protected paths: an agent cannot touch a declared path without an explicit acknowledgement. This is a write-time *blast-radius* limit, the agent's reach is bounded by config, not trust. Worked rule:

```yaml
- id: blast_radius_protected_paths
  severity: error          # team profile blocks; solo warns
  enforcement: [hook, engine]
  check: scope_containment
  scope: "**"
  protected_paths:
    - ".github/workflows/**"   # CI config: a poisoned workflow is a supply-chain blast
    - "infra/**"               # IaC: a wrong apply is a production blast
    - ".env*"                  # secrets surface
```

## Layer 3: destructive-op safety (the test guard)

A test (or script) that wipes or writes real infrastructure must not be able to reach production however the environment is misconfigured: physical isolation + a fail-fast refusal on production-pointed config + assert-the-target-before-the-destructive-op. The principle and its rationale live in [`testing.md`](./testing.md) §4. This is the runtime-side blast-radius limit the hook cannot see from a diff.

## Layer 4: environment isolation (yours, with this contract)

The sandbox runtime, a devcontainer, a microVM (Firecracker), a syscall sandbox (gVisor), or a restricted shell, is **your choice and your infrastructure**. The kit does not ship one; it composes with whatever you run. The contract for composing cleanly:

- **Install the Layer-1 hook inside the sandbox.** The hook gates writes in the agent's tool layer, so it must be present in the environment the agent actually runs in, not only on the host. A sandbox without the hook loses Layer 1.
- **Mount narrow.** Give the agent's environment the repo read-write and as little else as possible, no host home, no cloud-credential files, no docker socket. The narrower the mount, the smaller the Layer-4 blast radius. Illustrative (one option, not a kit dependency):

  ```jsonc
  // .devcontainer/devcontainer.json — minimal reach
  {
    "workspaceMount": "source=${localWorkspaceFolder},target=/work,type=bind",
    "workspaceFolder": "/work",
    "mounts": [],                       // nothing else from the host
    "containerEnv": { "AWS_PROFILE": "", "GITHUB_TOKEN": "" },  // no inherited creds
    "postCreateCommand": "corepack enable && pnpm install && pnpm run build"
  }
  ```

- **Keep network egress off by default** for build/test agents; allow-list the few hosts a task genuinely needs. A read-only-credential or no-credential environment turns a leaked secret into a non-event.
- **Treat the sandbox as the *outer* gate, the hook as the *inner* gate.** They compose: the sandbox bounds what is reachable at all; the hook + scope rules bound what is writable within it; the test guard bounds what is destroyable at runtime. Defence in depth, not either/or.

---

## The honest boundary

The kit provides Layers 1–3 (write-time prevention, path-scope containment, destructive-op safety) and the contract above for wiring Layer 4. It does **not** provide the sandbox runtime, that is adopter infrastructure, deliberately, the same boundary the kit draws around the analyser. A team that runs no sandbox still gets Layers 1–3; a team that adds one gets defence in depth. What the kit will not do is pretend a markdown convention is a kernel isolation boundary.

## Cross-reference

- [ADR-0015](../docs/decisions/0015-blast-radius-and-sandboxing.md) — the blast-radius boundary this convention draws.
- [`governance/hook.example.sh`](../governance/hook.example.sh) — Layer 1, the write-time gate.
- [`governance/governance.yaml.example`](../governance/governance.yaml.example) — `scope_containment` (Layer 2), `no_secrets` (safety).
- [`testing.md`](./testing.md) §4 — Layer 3, the destructive-test safety principle.
- [ADR-0001](../docs/decisions/0001-scaffold-charter.md) — why the sandbox runtime stays adopter-supplied (ships shapes, not contents).
- [ADR-0007](../docs/decisions/0007-universal-rules-ship-enabled.md) — the profile ramp that decides whether Layer 1/2 warn or block.
