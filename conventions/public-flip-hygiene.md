# Public-flip hygiene: scan gates the first public push

Flipping a repository (or any code surface) from private to public is
irreversible the moment a third party — or a crawler, or a fork — reads
it. A scan is cheap; a leaked credential is not. This file names the gate
once so it can be cited rather than reinvented at flip time.

## The rule

**Before any repository becomes public for the first time, or has its
visibility broadened: a full-history secret / PII / absolute-path /
internal-host scan must return clean — or exposed material must be
surgically removed *and* rotated.** This is a precondition, not a nicety.
If the scanner fires:

- Surgically excise the offending blob from history (`git filter-repo` or
  BFG), **and** rotate the secret at its source. Hiding is not fixing.
- A clean rescan against the rewritten history is the gate's pass
  condition. "Looks clean" is the state *before* the scan, not a
  termination (see `verification.md`).
- Only *this* — genuine harmful content — justifies a history rewrite at
  flip time. The same shape extends to *claims*: a quantitative claim ships
  only if it is pinned to a public artefact and measured; unpinned or
  unmeasured numbers do not ship (the kit's claims-integrity discipline,
  visible in the README's honest-scoping and CONTRIBUTING's
  no-unverifiable-claims rule).

## Why (the failure mode this prevents)

A repo's first public read is irreversible. A buried key in commit 40 is
not "private" again the moment you notice; rotation is the only remedy
and it is always more expensive than the scan would have been. The gate
exists because absence-of-tool is not absence-of-need: a robust grep over
`git rev-list --all` blobs (keys, PEM, `/Users/`·`/home/`, emails,
internal hosts) is the floor when `gitleaks`/`trufflehog` are not
available, and takes minutes.

## Worked example (this kit's own canaries)

This scaffold ships a no-secrets governance rule. To prove the rule
fires, `engine/test/audit.test.ts` contains intentional canary strings —
including an AWS-shaped access-key fixture and `password = "changeme..."`
— that the engine's own tests assert against. A full-history scan **must**
find those, because the engine cannot be tested without inputs that look
like real secrets. This is the standard pattern (`gitleaks`, `trufflehog`,
and `semgrep` all ship the same shape in their own test corpora).

The transferable lesson: **a scan is a pointer to evidence, not a
substitute for it.** When the scanner fires, read *where* it fires before
deciding. Canary in a test directory whose explicit job is to prove the
no-secrets rule catches secrets → expected. The same string in `.env`, a
shipped runtime config, or a deployment manifest → rotate and excise.
Location and context decide; the matcher does not.

(For projects whose providers offer documented test-only credentials —
e.g. AWS's `AKIAIOSFODNN7EXAMPLE`, Stripe's `sk_test_…` — prefer those
for canary fixtures; many secret scanners explicitly ignore them, which
reduces false-positive alerts once the repo is public.)

## Private dev-context vs the published surface

Secrets are not the only thing that must not ride the first public push: a
repo's private *working context* — calibration notes, internal pins, "do not
share" provenance — is the same irreversibility on a different axis. The
recurring failure is handling it **manually** (scrub a file just before flip):
a manual scrub misses a line, or a new private note lands and nobody
re-scrubs. Make the boundary structural and machine-enforced instead.

1. **Ship `.example` artefacts and conventions, never your own live contents.**
   This kit publishes `governance.yaml.example`, `testing-manifest.json.example`,
   `hook.example.sh`, `*.writer.example.mjs`, and the `memory-protocol.md`
   convention — never its own live `governance.yaml`, `.scaffold/` run state, or
   `memory/` working notes. Apply the same to anything you author: ship the
   *shape*, keep the *contents* private.
2. **Gitignore live working directories.** `memory/` (the kit's own working
   memory, including provenance pins) and `.scaffold/` (run artefacts) are
   gitignored — they stay in your working tree but never publish. Adopters
   create + track their *own* `memory/` per the protocol; the kit does not ship
   its own.
3. **Mark stray never-publish lines with a `SCAFFOLD-PRIVATE` sentinel** — for
   content that must live outside those directories (a calibration constant in a
   doc, an internal host in a comment).
4. **A CI gate enforces 1–3.** The build fails if a private working directory is
   tracked, or if a `SCAFFOLD-PRIVATE` sentinel appears in a tracked file.
   Vigilance is replaced by a red build — the only thing that survives a busy
   week. (This kit's own gate: the *Private-surface leak gate* step in
   `.github/workflows/ci.yml`.)

The durable lesson: **the private/public boundary is a build gate, not a
pre-flip chore.** A chore you have to remember is a chore you eventually forget;
a gate fails the same way every time.

## How this composes with the rest of the kit

- **`conventions/verification.md`** — same spine: a gate is "done" only
  when a skeptic-checkable artefact says so. The scan is that artefact.
- **`no-secrets` / universal governance rules (ADR-0007)** — the same
  defect surface at *write* time. The scan is the historical sweep that
  catches what was committed before the rule landed.
- **Claims-integrity discipline** — a quantitative claim ships only pinned +
  measured (README honest-scoping; CONTRIBUTING's no-unverifiable-claims rule);
  history is scanned + rotated-on-find. Same shape, different axis.

## When you are tempted to skip it

| "..." | Reality |
|---|---|
| "It's been private, surely no secrets" | Surely is not scanned. One buried key is irreversible on first public read; 60 seconds vs. a rotation scramble. |
| "Found a key — I'll just squash history to hide it" | Squashing is not removal and not rotation. Surgically excise the blob *and* rotate the secret at its source. |
| "Test fixtures triggered the scanner — looks dirty" | Read where it fires. A canary in a test directory proving the no-secrets rule works is expected; the same shape in `.env` or shipped runtime config is not. Location decides. |
| "No scanner installed" | Robust grep over `git rev-list --all` blobs (keys/PEM, `/Users/`·`/home/`, emails, internal hosts) is the floor. Absence of a tool is not absence of the gate. |
