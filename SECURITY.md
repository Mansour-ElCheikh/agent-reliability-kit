# Security

## Scope

This repository ships documents, conventions, shell scripts, and a small TypeScript rules engine. It is not a runtime, an SDK, or a network service. The attack surface is narrow by design:

- The engine runs locally against a local repository tree. It makes no network calls.
- The governance hook example is shell that intercepts agentic tool calls and evaluates rules. It executes only inside your dev environment.
- The scaffold wrapper writes files into a target directory you nominate. It does not modify state outside the target.

What the kit installs into an adopter's repo is also documents and configuration: canonical skill files, ADR templates, governance rule contracts, conventions, and a starter CI workflow. The kit does not bundle binaries, dependencies, or runtime components.

## Reporting a vulnerability

If you believe you have found a security issue:

- **Preferred**: open a [GitHub Security Advisory](https://github.com/Mansour-ElCheikh/agent-reliability-kit/security/advisories/new) on this repository. The advisory channel is private until the issue is resolved.
- **Alternative**: open a GitHub issue marked `[SECURITY]` if (and only if) the issue does not itself require confidentiality.

Please include:

- The exact file path(s) involved.
- The minimal reproduction (commands, fixture, expected vs actual behavior).
- The version (commit SHA) you ran against.
- Your assessment of impact and exploitability.

## Response SLA

There is no formal SLA in v0.1.x. The maintainer commits to a best-effort acknowledgement within seven days for any reported issue. Fix windows depend on the severity, the complexity of the change, and the maintainer's availability. Critical issues are prioritized.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |
| < 0.1 | No (no public releases) |

## Known patterns that look like security issues but are not

The following are intentional and documented; please do not file these as vulnerabilities:

- **Canary credentials in test fixtures.** `engine/test/audit.test.ts` contains synthetic strings shaped like AWS access keys and other secrets. These are test inputs that exist precisely so the `no_secrets` predicate's own tests can assert it fires correctly. They are not real credentials. See `conventions/public-flip-hygiene.md` for the convention's worked example of why these are necessary.
- **`AKIAIOSFODNN7EXAMPLE` in docs.** This is AWS's documented public example key (used throughout AWS's own documentation). It is referenced in `conventions/public-flip-hygiene.md` as a canary example.
- **The `eval_pillar1-base-151eba5` branch reference in evidence docs.** This is the recorded RepoNav branch name pinned in the public evals manifest. It is provenance metadata, not a credential.

GitHub's secret scanning may surface notifications for the patterns above after the repository flipped public. Those are expected.

## What is out of scope for this advisory channel

- Functional bugs (those go to regular issues).
- Feature requests.
- Style or wording disagreements on public surfaces (those go to regular issues, optionally with a proposed diff).
- Security issues in third-party tools the kit integrates with (Claude Code, Cursor, Copilot agent mode). Report those to the relevant vendor.

## A note on agentic tool exposure

When you adopt this kit, an agentic coding tool (Claude Code, Cursor, Copilot) will read the emitted skill files and may call the governance hook. The hook is shell that you wire into your local environment. Review `governance/hook.example.sh` before installing it. The kit does not require any agentic tool to have elevated permissions; the discipline is enforced at the rule layer, not the OS layer.
