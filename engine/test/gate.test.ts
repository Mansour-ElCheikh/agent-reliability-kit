/**
 * Unit tests for the ship gate (ADR-0013).
 *
 * The gate runs the TARGET repo's own gates (test/lint scripts + the governance audit)
 * and BLOCKS ship on red. Pure aggregation + manifest logic is tested here with injected
 * fakes (no spawned processes); the real CLI exit-code path is exercised end-to-end in the
 * dry-run. Assertions are Min-Invariants: concrete booleans, check names, counts.
 *
 * Non-tautological: a do-nothing gate (always {blocked:false}) FAILS every "red -> blocked"
 * case below; gateScripts returning [] FAILS the manifest cases.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateGate,
  detectPackageManager,
  gateScripts,
  runGate,
  renderGateReportJson,
  type CheckResult,
} from '../src/gate.js';

describe('evaluateGate', () => {
  it('blocks when any check is red', () => {
    const checks: CheckResult[] = [
      { name: 'test:unit', ok: true, detail: 'passed' },
      { name: 'governance', ok: false, detail: '2 errors' },
    ];
    expect(evaluateGate(checks).blocked).toBe(true);
  });
  it('passes only when every check is green', () => {
    const checks: CheckResult[] = [
      { name: 'test:unit', ok: true, detail: 'passed' },
      { name: 'governance', ok: true, detail: '0 errors' },
    ];
    expect(evaluateGate(checks).blocked).toBe(false);
  });
});

describe('detectPackageManager', () => {
  it('prefers pnpm when pnpm-lock.yaml is present', () => {
    expect(detectPackageManager(['package.json', 'pnpm-lock.yaml'])).toBe('pnpm');
  });
  it('uses yarn for yarn.lock', () => {
    expect(detectPackageManager(['yarn.lock'])).toBe('yarn');
  });
  it('falls back to npm', () => {
    expect(detectPackageManager(['package.json'])).toBe('npm');
  });
});

describe('gateScripts', () => {
  it('runs each testing-manifest command that is a real package script', () => {
    const manifest = { commands: { 'test:unit': {}, 'test:integration': {} } };
    const pkg = {
      'test:unit': 'vitest run unit',
      'test:integration': 'vitest run int',
      build: 'tsc',
    };
    expect(gateScripts(manifest, pkg)).toEqual(['test:unit', 'test:integration']);
  });
  it('adds lint when present', () => {
    const manifest = { commands: { 'test:unit': {} } };
    const pkg = { 'test:unit': 'vitest', lint: 'eslint .' };
    expect(gateScripts(manifest, pkg)).toEqual(['test:unit', 'lint']);
  });
  it('falls back to the test script when the manifest declares nothing runnable', () => {
    expect(gateScripts(null, { test: 'vitest run' })).toEqual(['test']);
  });
  it('returns nothing when there is no runnable script at all', () => {
    expect(gateScripts(null, { build: 'tsc' })).toEqual([]);
  });
});

describe('runGate', () => {
  const repo =
    (
      manifest: unknown,
      pkgScripts: Record<string, string>,
      rootFiles: string[] = ['package.json'],
    ) =>
    async () => ({ rootFiles, manifest, pkgScripts });

  it('blocks when a test script exits non-zero', async () => {
    const report = await runGate({
      repoRoot: '/x',
      readRepo: repo({ commands: { 'test:unit': {} } }, { 'test:unit': 'vitest' }),
      runScript: async (_pm, s) =>
        s === 'test:unit' ? { code: 1, output: '2 failed' } : { code: 0, output: '' },
      auditCounts: async () => ({ errors: 0, warnings: 0 }),
    });
    expect(report.blocked).toBe(true);
    expect(report.checks.find((c) => c.name === 'test:unit')?.ok).toBe(false);
  });

  it('passes when all scripts exit 0 and governance is clean', async () => {
    const report = await runGate({
      repoRoot: '/x',
      readRepo: repo({ commands: { 'test:unit': {} } }, { 'test:unit': 'vitest' }),
      runScript: async () => ({ code: 0, output: '' }),
      auditCounts: async () => ({ errors: 0, warnings: 0 }),
    });
    expect(report.blocked).toBe(false);
  });

  it('blocks when the governance audit reports errors even if tests pass', async () => {
    const report = await runGate({
      repoRoot: '/x',
      readRepo: repo({ commands: { 'test:unit': {} } }, { 'test:unit': 'vitest' }),
      runScript: async () => ({ code: 0, output: '' }),
      auditCounts: async () => ({ errors: 3, warnings: 0 }),
    });
    expect(report.blocked).toBe(true);
    expect(report.checks.find((c) => c.name === 'governance')?.detail).toMatch(/3 error/);
  });

  it('skips governance cleanly when there is no governance.yaml (null), still passing on green tests', async () => {
    const report = await runGate({
      repoRoot: '/x',
      readRepo: repo(null, { test: 'vitest' }),
      runScript: async () => ({ code: 0, output: '' }),
      auditCounts: async () => null,
    });
    expect(report.blocked).toBe(false);
    expect(report.checks.find((c) => c.name === 'governance')?.ok).toBe(true);
  });

  it('blocks when there is no runnable test at all (cannot ship un-gated)', async () => {
    const report = await runGate({
      repoRoot: '/x',
      readRepo: repo(null, { build: 'tsc' }),
      runScript: async () => ({ code: 0, output: '' }),
      auditCounts: async () => null,
    });
    expect(report.blocked).toBe(true);
  });
});

// Honest gate tightening (C2 / battle-test P2): the DEFAULT gate blocks on error-severity
// only and must SAY so; --strict opts into blocking on warnings too.
// Non-tautological: the SAME {errors:0, warnings:5} input is not-blocked by default and
// blocked under --strict — an errors-only gate fails the strict case; an always-strict gate
// fails the default case.
describe('runGate --strict (honest gate tightening)', () => {
  const repo =
    (
      manifest: unknown,
      pkgScripts: Record<string, string>,
      rootFiles: string[] = ['package.json'],
    ) =>
    async () => ({ rootFiles, manifest, pkgScripts });

  it('does NOT block on warn-severity findings by default, and surfaces them as advisory (C2)', async () => {
    const report = await runGate({
      repoRoot: '/x',
      readRepo: repo({ commands: { 'test:unit': {} } }, { 'test:unit': 'vitest' }),
      runScript: async () => ({ code: 0, output: '' }),
      auditCounts: async () => ({ errors: 0, warnings: 5 }),
    });
    expect(report.blocked).toBe(false);
    expect(report.checks.find((c) => c.name === 'governance')?.detail).toMatch(
      /5 warning\(s\) advisory/,
    );
  });

  it('blocks on warn-severity findings under --strict (same input that passed by default)', async () => {
    const report = await runGate(
      {
        repoRoot: '/x',
        readRepo: repo({ commands: { 'test:unit': {} } }, { 'test:unit': 'vitest' }),
        runScript: async () => ({ code: 0, output: '' }),
        auditCounts: async () => ({ errors: 0, warnings: 5 }),
      },
      { strict: true },
    );
    expect(report.blocked).toBe(true);
    expect(report.checks.find((c) => c.name === 'governance')?.detail).toMatch(
      /block under --strict/,
    );
  });

  it('strict passes when there are zero errors and zero warnings', async () => {
    const report = await runGate(
      {
        repoRoot: '/x',
        readRepo: repo({ commands: { 'test:unit': {} } }, { 'test:unit': 'vitest' }),
        runScript: async () => ({ code: 0, output: '' }),
        auditCounts: async () => ({ errors: 0, warnings: 0 }),
      },
      { strict: true },
    );
    expect(report.blocked).toBe(false);
  });
});

// epic 001-gate-json-output, task 1 (built through the /sdlc gated loop as the capstone dry-run)
describe('renderGateReportJson (gate --json)', () => {
  it('serialises a blocked report with the red check by name', () => {
    const report = evaluateGate([
      { name: 'test:unit', ok: false, detail: 'exit 1' },
      { name: 'governance', ok: true, detail: '0 errors' },
    ]);
    const parsed = JSON.parse(renderGateReportJson(report));
    expect(parsed.blocked).toBe(true);
    expect(parsed.checks.find((c: CheckResult) => !c.ok)?.name).toBe('test:unit');
  });
});
