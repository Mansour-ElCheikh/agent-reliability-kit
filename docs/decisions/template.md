# ADR-NNNN: <one-line title in sentence case>

**Status:** Proposed | Accepted | Superseded by ADR-MMMM | Deprecated
**Date:** YYYY-MM-DD
**Supersedes:** None | ADR-MMMM

## Context

What is the problem? What constraints are non-negotiable? What is the present state? Cite evidence — file paths, commit hashes, telemetry, prior ADRs — not just assertion.

Surface the trade-offs the decision will be made against. If the answer feels obvious, the context is probably under-specified.

## Decision

The single sentence that names the decision. Then a paragraph or two on what it means in concrete terms — what code or convention changes, what the new shape looks like.

If a pre-registered rule drives the decision (e.g. "format X is promoted when measured Y ≥ threshold Z with fidelity loss ≤ W"), state the rule **before** stating the outcome. The reader should see how the rule resolved, not just where it landed.

## Consequences

What changes for the next contributor? What new constraints does this place on future ADRs? What did we close off?

Include the failure mode this prevents AND the failure mode it now permits. ADRs that only list upsides are not load-bearing.

## What this ADR does *not* do

Optional but recommended. State the scope boundary explicitly. The most expensive ADR drift comes from readers assuming the decision covers cases it does not.

## Cross-reference

- Earlier ADR(s) this resolves or scopes
- File paths or modules affected
- Evidence artefacts (eval results, benchmarks, telemetry snapshots)

---

## Authoring rules

1. **One ADR per decision.** If a session lands two decisions, write two ADRs.
2. **Never reuse numbers.** Numbers are immutable. Even if you delete an ADR, the number stays retired.
3. **Supersession is explicit.** When a new ADR replaces an old one, the old one's Status changes to "Superseded by ADR-NNNN" and the new one's Supersedes field cites the old. Both files stay in the repo.
4. **No retroactive edits.** Once an ADR is Accepted, only its Status can change (to Superseded or Deprecated). The Context, Decision, and Consequences are frozen — they describe the world at decision time. Drift is captured by a new ADR, not by editing the old one.
5. **Cite evidence, not assertion.** "Profile P50 was 14 ms" is an ADR-grade claim. "Performance was fine" is not.
