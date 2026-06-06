/**
 * Engine self-test. Exercises the full audit path + ratchet against the
 * fixture project under test/fixtures/.
 *
 * Asserts on the returned report object (not the written file) so the test is
 * deterministic — no timestamp / path normalisation needed.
 *
 * Fixture deliberately triggers:
 *   R2_tdd_test_alignment      ×2  (src/missing.ts, src/leaky.ts: no co-located test)
 *   R3_testing_manifest_alignment ×1 (wrong/stray.test.ts outside declared scope) [error]
 *   R4_boundary_import_isolation  ×1 (src/leaky.ts imports vscode)               [error]
 *   R26_skill_size_warn           ×1 (.claude/skills/big/SKILL.md > 200 bytes)   [warn]
 */

import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGovernance, buildAuditContext, runAudit, buildReport } from '../src/audit.js';
import { PredicateRegistry } from '../src/predicates.js';
import {
  emitBaseline,
  readBaseline,
  warnCountsByRule,
  compareToBaseline,
  BASELINE_FILENAME,
} from '../src/ratchet.js';
import { formatToonReport } from '../src/toon.js';
import { evaluateHook } from '../src/hook.js';
import type { GovernanceConfig } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures');
const CONFIG = path.join(FIXTURE, 'governance.yaml');

async function audit() {
  const governance = await loadGovernance(CONFIG);
  const registry = new PredicateRegistry();
  const context = await buildAuditContext({ repoRoot: FIXTURE, governance });
  const findings = await runAudit({ context, registry, surface: 'engine' });
  const report = await buildReport(context, findings);
  return { context, findings, report };
}

afterEach(async () => {
  // Clean up any baseline / .scaffold the test wrote into the fixture.
  await fs.rm(path.join(FIXTURE, BASELINE_FILENAME), { force: true });
  await fs.rm(path.join(FIXTURE, '.scaffold'), { recursive: true, force: true });
});

describe('engine audit against fixture', () => {
  it('fires the expected predicates with expected counts', async () => {
    const { report } = await audit();
    expect(report.per_rule_counts.R2_tdd_test_alignment).toBe(2);
    expect(report.per_rule_counts.R3_testing_manifest_alignment).toBe(1);
    expect(report.per_rule_counts.R4_boundary_import_isolation).toBe(1);
    expect(report.per_rule_counts.R26_skill_size_warn).toBe(1);
  });

  it('classifies severities correctly (errors block, warns ratchet)', async () => {
    const { report } = await audit();
    expect(report.totals.errors).toBe(2); // R3 + R4
    expect(report.totals.warnings).toBe(3); // R2×2 + R26×1
    expect(report.totals.audit_only).toBe(0);
  });

  it('R4 finding carries a line number', async () => {
    const { findings } = await audit();
    const r4 = findings.find((f) => f.ruleId === 'R4_boundary_import_isolation');
    expect(r4).toBeDefined();
    expect(r4!.severity).toBe('error');
    expect(r4!.filePath).toBe('src/leaky.ts');
    expect(typeof r4!.line).toBe('number');
  });

  it('R26 warns (not errors) in the warn band', async () => {
    const { findings } = await audit();
    const r26 = findings.find((f) => f.ruleId === 'R26_skill_size_warn');
    expect(r26).toBeDefined();
    expect(r26!.severity).toBe('warn');
  });
});

describe('ratchet', () => {
  it('emits a baseline of warn counts only', async () => {
    const { findings } = await audit();
    const counts = warnCountsByRule(findings);
    expect(counts.R2_tdd_test_alignment).toBe(2);
    expect(counts.R26_skill_size_warn).toBe(1);
    expect(counts.R3_testing_manifest_alignment).toBeUndefined(); // error, not warn
    expect(counts.R4_boundary_import_isolation).toBeUndefined(); // error, not warn

    const baseline = await emitBaseline(FIXTURE, counts);
    expect(baseline.version).toBe(1);
    const reread = await readBaseline(FIXTURE);
    expect(reread?.counts).toEqual(counts);
  });

  it('does not flag exceeded when current === baseline', async () => {
    const { findings } = await audit();
    const counts = warnCountsByRule(findings);
    await emitBaseline(FIXTURE, counts);
    const baseline = await readBaseline(FIXTURE);
    const cmp = compareToBaseline(counts, baseline);
    expect(cmp.exceeded).toBe(false);
  });

  it('flags exceeded when a warn count grows past baseline', async () => {
    const { findings } = await audit();
    const counts = warnCountsByRule(findings);
    await emitBaseline(FIXTURE, counts);
    const baseline = await readBaseline(FIXTURE);
    // Simulate a new warning landing
    const grown = { ...counts, R2_tdd_test_alignment: counts.R2_tdd_test_alignment + 1 };
    const cmp = compareToBaseline(grown, baseline);
    expect(cmp.exceeded).toBe(true);
    expect(cmp.diff.R2_tdd_test_alignment.delta).toBe(1);
  });

  it('offers ratchet-down when a warn count drops', async () => {
    const { findings } = await audit();
    const counts = warnCountsByRule(findings);
    await emitBaseline(FIXTURE, counts);
    const baseline = await readBaseline(FIXTURE);
    const dropped = { ...counts, R2_tdd_test_alignment: 1 };
    const cmp = compareToBaseline(dropped, baseline);
    expect(cmp.exceeded).toBe(false);
    expect(cmp.ratchetDownAvailable).toContain('R2_tdd_test_alignment');
  });
});

describe('TOON serializer', () => {
  it('emits RepoNav-style @section / #key:value grammar', async () => {
    const { report } = await audit();
    const toon = formatToonReport(report);
    expect(toon).toMatch(/^@meta #project:engine-selftest /m);
    expect(toon).toMatch(/^@totals #errors:2 #warnings:3 #audit:0$/m);
    expect(toon).toMatch(/^@findings \[$/m);
    expect(toon).toMatch(
      /#rule:R4_boundary_import_isolation #sev:error #f:src\/leaky\.ts #L:\d+ #msg:/,
    );
    expect(toon).toMatch(/^@stats #findings:\d+ #rules:\d+$/m);
  });

  it('is materially smaller than JSON for the same report', async () => {
    const { report } = await audit();
    const toon = formatToonReport(report);
    const json = JSON.stringify(report, null, 2);
    expect(toon.length).toBeLessThan(json.length);
  });
});

describe('predicate registry', () => {
  it('lists the 11 built-in predicates (6 v0.1 + 3 ADR-0007 universal + 2 ADR-0010 Min-Invariant)', () => {
    const reg = new PredicateRegistry();
    expect(reg.list()).toEqual([
      'boundary_imports',
      'decision_keyword_without_adr',
      'doc_validity',
      'no_secrets',
      'prompt_size_warn',
      'roadmap_reference_in_commit_message',
      'scope_containment',
      'source_file_has_co_located_test',
      'tasks_min_invariant',
      'test_file_in_manifest_directory',
      'test_shape_assertions',
    ]);
  });

  it('throws a clear error for an unregistered predicate', async () => {
    const reg = new PredicateRegistry();
    await expect(
      reg.evaluate('does_not_exist', {
        filePath: 'x',
        fileContent: '',
        rule: {
          id: 'X',
          severity: 'warn',
          description: '',
          enforcement: ['engine'],
          check: 'does_not_exist',
        },
        context: {
          repoRoot: FIXTURE,
          governance: { project: 'x', rules: [] },
          headCommit: '',
          headCommitMessage: '',
          affectedFiles: [],
          allInScopeFiles: [],
        },
      }),
    ).rejects.toThrow(/predicate not registered/);
  });
});

describe('hook gate — TDD test-first write-time block (RepoNav R5 parity)', () => {
  // src/leaky.ts in the fixture has no co-located src/leaky.test.ts, so the
  // co-located-test predicate fires. The two governance configs below differ
  // ONLY in severity — proving the same check blocks at error but only
  // records at warn (S6.4 spec L3 / AC6).
  const baseRule = {
    id: 'Rx',
    description: 'co-located test',
    enforcement: ['hook'] as ('hook' | 'engine' | 'audit')[],
    check: 'source_file_has_co_located_test',
    scope: 'src/**/*.ts',
  };
  function cfg(severity: 'warn' | 'error'): GovernanceConfig {
    return {
      project: 'hook-test',
      mode: { default: 'enforce' },
      rules: [{ ...baseRule, severity }],
    };
  }
  const target = path.join(FIXTURE, 'src', 'leaky.ts');

  it('error-severity test-first → blocks (evaluateHook returns a finding → cli exit 2)', async () => {
    const blocking = await evaluateHook({
      repoRoot: FIXTURE,
      governance: cfg('error'),
      registry: new PredicateRegistry(),
      filePath: 'src/leaky.ts',
      content: await fs.readFile(target, 'utf8'),
      headCommitMessage: '',
    });
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((f) => f.severity === 'error')).toBe(true);
  });

  it('warn-severity test-first → does NOT block (evaluateHook returns nothing → cli exit 0)', async () => {
    const blocking = await evaluateHook({
      repoRoot: FIXTURE,
      governance: cfg('warn'),
      registry: new PredicateRegistry(),
      filePath: 'src/leaky.ts',
      content: await fs.readFile(target, 'utf8'),
      headCommitMessage: '',
    });
    // The finding still exists (recorded by the audit pass + ratchet) but
    // evaluateHook only returns *blocking* (error) findings; warn is filtered.
    expect(blocking.length).toBe(0);
  });

  it('advisory mode degrades even an error rule to non-blocking', async () => {
    const advisoryCfg = { ...cfg('error'), mode: { default: 'advisory' as const } };
    const blocking = await evaluateHook({
      repoRoot: FIXTURE,
      governance: advisoryCfg,
      registry: new PredicateRegistry(),
      filePath: 'src/leaky.ts',
      content: await fs.readFile(target, 'utf8'),
      headCommitMessage: '',
    });
    expect(blocking.length).toBe(0);
  });
});

describe('ADR-0007 — profile + Universal Default Set (hard acceptance)', () => {
  const reg = () => new PredicateRegistry();
  const hook = (governance: GovernanceConfig, filePath: string, content: string) =>
    evaluateHook({
      repoRoot: FIXTURE,
      governance,
      registry: reg(),
      filePath,
      content,
      headCommitMessage: '',
    });

  function universal(check: string, extra: Partial<GovernanceConfig['rules'][number]> = {}) {
    return {
      project: 'adr7',
      rules: [
        {
          id: `U_${check}`,
          severity: 'warn' as const,
          description: check,
          enforcement: ['hook', 'engine'] as ('hook' | 'engine' | 'audit')[],
          check,
          universal: true,
          ramp_to_error_on_team: true,
          ...extra,
        },
      ],
    } satisfies GovernanceConfig;
  }
  const solo = (c: GovernanceConfig): GovernanceConfig => ({ ...c, profile: 'solo' });
  const team = (c: GovernanceConfig): GovernanceConfig => ({ ...c, profile: 'team' });

  it('tdd_test_first: warn under solo (non-blocking), error under team (blocking)', async () => {
    const c = universal('source_file_has_co_located_test', { scope: 'src/**/*.ts' });
    expect((await hook(solo(c), 'src/leaky.ts', 'export const x=1;')).length).toBe(0);
    const blocked = await hook(team(c), 'src/leaky.ts', 'export const x=1;');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((f) => f.severity === 'error')).toBe(true);
  });

  it('scope_containment: protected path warn under solo, error+blocking under team', async () => {
    const c = universal('scope_containment', {
      scope: '**',
      protected_paths: ['docs/decisions/**'],
    });
    expect((await hook(solo(c), 'docs/decisions/0001-x.md', '')).length).toBe(0);
    expect((await hook(team(c), 'docs/decisions/0001-x.md', '')).length).toBeGreaterThan(0);
  });

  it('doc_validity: missing frontmatter warn under solo, error under team', async () => {
    const c = universal('doc_validity', { scope: '**/PLAN.md' });
    expect((await hook(solo(c), 'PLAN.md', '# Plan\nno frontmatter')).length).toBe(0);
    expect((await hook(team(c), 'PLAN.md', '# Plan\nno frontmatter')).length).toBeGreaterThan(0);
    // valid AND unexpired frontmatter → no finding even under team. The window
    // must stay open under the real clock (ADR-0016 expiry); a wide window keeps
    // this asserting "well-formed → no finding", not staleness (which the
    // doc_validity unit tests cover explicitly).
    const ok = '---\nvalidity: live\nas_of: 2026-05-19\nexpires_after_days: 3650\n---\n# Plan';
    expect((await hook(team(c), 'PLAN.md', ok)).length).toBe(0);
  });

  it('no_secrets is a safety rule: error+blocking under solo AND advisory (never downgraded)', async () => {
    const base: GovernanceConfig = {
      project: 'adr7',
      rules: [
        {
          id: 'no_secrets',
          severity: 'error',
          description: 'no secrets',
          enforcement: ['hook', 'engine'],
          check: 'no_secrets',
          safety: true,
          scope: '**',
        },
      ],
    };
    const leak =
      'const k = "AKIA3KGZ7Q2MNB6XW9PD";\naws_secret_access_key = "wJalrXqp9fZ2bQ8mNvK3sLpYtRdGcHa"';
    expect((await hook(solo(base), 'src/cfg.ts', leak)).length).toBeGreaterThan(0);
    expect(
      (await hook({ ...base, mode: { default: 'advisory' } }, 'src/cfg.ts', leak)).length,
    ).toBeGreaterThan(0);
  });

  it('no_secrets does NOT fire on placeholder/example values (false-positive guard)', async () => {
    const base: GovernanceConfig = {
      project: 'adr7',
      rules: [
        {
          id: 'no_secrets',
          severity: 'error',
          description: 'x',
          enforcement: ['hook'],
          check: 'no_secrets',
          safety: true,
          scope: '**',
        },
      ],
    };
    const placeholder =
      'api_key = "your-api-key-here"\npassword = "changeme123456"\ntoken = "${process.env.TOKEN}"';
    expect((await hook(solo(base), 'README.md', placeholder)).length).toBe(0);
  });

  it('profile defaults to solo when absent (universal rule stays non-blocking)', async () => {
    const c = universal('source_file_has_co_located_test', { scope: 'src/**/*.ts' });
    // no profile field set → treated as solo
    expect((await hook(c, 'src/leaky.ts', 'export const x=1;')).length).toBe(0);
  });
});
