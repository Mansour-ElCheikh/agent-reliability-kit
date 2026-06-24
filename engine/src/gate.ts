/**
 * Ship gate (ADR-0013) — runs the TARGET repo's own gates (its test/lint scripts + the
 * governance audit) and BLOCKS ship on red. It is the deterministic enforcement layer the
 * dry-run proved the loop needed: TDD-first and green-test were self-imposed before this.
 *
 * Composes existing pieces — the test command(s) from testing-manifest.json / package.json,
 * the governance audit (runAudit), an optional editorial/lint script — and never re-implements
 * them. The pure aggregation + manifest logic is unit-tested with injected fakes; the CLI
 * (`reliability-engine gate`) builds the real deps and turns the report into an exit code (or a
 * Stop-hook block JSON). Charter-legal: a local CLI invoked on demand (ADR-0001/0008), not a
 * daemon.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import { PredicateRegistry } from './predicates.js';
import { loadExtensions } from './extensions.js';
import { buildAuditContext, runAudit } from './audit.js';
import type { GovernanceConfig } from './types.js';

const execFileAsync = promisify(execFile);

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}
export interface GateReport {
  checks: CheckResult[];
  blocked: boolean;
}

/** A gate is blocked iff any check is red. Pure. */
export function evaluateGate(checks: CheckResult[]): GateReport {
  return { checks, blocked: checks.some((c) => !c.ok) };
}

/** The package manager implied by the lockfiles at the repo root. Pure. */
export function detectPackageManager(rootFiles: string[]): 'pnpm' | 'yarn' | 'npm' {
  if (rootFiles.includes('pnpm-lock.yaml')) return 'pnpm';
  if (rootFiles.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

/**
 * The package.json script names the gate runs as its test+lint layer. Pure.
 * Order: every testing-manifest command that is a real script, then `lint`, then a `test`
 * fallback when the manifest declared nothing runnable.
 */
export function gateScripts(
  manifest: { commands?: Record<string, unknown> } | null | undefined,
  pkgScripts: Record<string, string>,
): string[] {
  const out: string[] = [];
  const cmds = (manifest && manifest.commands) || {};
  for (const key of Object.keys(cmds)) {
    if (pkgScripts && key in pkgScripts) out.push(key);
  }
  if (pkgScripts && 'lint' in pkgScripts && !out.includes('lint')) out.push('lint');
  if (out.length === 0 && pkgScripts && 'test' in pkgScripts) out.push('test');
  return out;
}

export interface RunGateDeps {
  repoRoot: string;
  /** Read the repo's gate inputs. Injected so tests pass fixtures without filesystem access. */
  readRepo: () => Promise<{
    rootFiles: string[];
    manifest: { commands?: Record<string, unknown> } | null;
    pkgScripts: Record<string, string>;
  }>;
  /** Run one package script. Injected so tests don't spawn processes. */
  runScript: (pm: string, script: string) => Promise<{ code: number; output: string }>;
  /**
   * Governance audit finding counts split by severity, or null when the repo has no
   * governance.yaml. Injected. `errors` always block the gate; `warnings` block ONLY under
   * `--strict`. This split is the honest C2 framing: under `profile: solo` almost every
   * universal rule is `warn` (only `no_secrets` is `error`), so the default gate vouches for
   * "tests green + no error-severity finding" — NOT "every governance rule satisfied".
   */
  auditCounts: () => Promise<{ errors: number; warnings: number } | null>;
}

/** Gate tightening knobs. `strict` opts into blocking on warn-severity findings too. */
export interface GateOptions {
  strict?: boolean;
}

/** Run every gate check and aggregate. The pure orchestration; deps are injected. */
export async function runGate(deps: RunGateDeps, opts: GateOptions = {}): Promise<GateReport> {
  const checks: CheckResult[] = [];
  const { rootFiles, manifest, pkgScripts } = await deps.readRepo();
  const pm = detectPackageManager(rootFiles);
  const scripts = gateScripts(manifest, pkgScripts);

  if (scripts.length === 0) {
    checks.push({
      name: 'tests',
      ok: false,
      detail:
        'no test/lint script found in package.json or testing-manifest.json - a ship gate needs at least one green check (add a test, or run the gate against a repo that has one)',
    });
  }
  for (const s of scripts) {
    const { code, output } = await deps.runScript(pm, s);
    checks.push({
      name: s,
      ok: code === 0,
      detail: code === 0 ? 'passed' : `exit ${code}: ${output.trim().slice(-240) || '(no output)'}`,
    });
  }

  const counts = await deps.auditCounts();
  if (counts === null) {
    checks.push({ name: 'governance', ok: true, detail: 'no governance.yaml (skipped)' });
  } else {
    const blocking = opts.strict ? counts.errors + counts.warnings : counts.errors;
    let detail: string;
    if (opts.strict) {
      detail =
        blocking === 0
          ? '0 errors, 0 warnings (strict)'
          : `${counts.errors} error(s) + ${counts.warnings} warning(s) block under --strict`;
    } else if (counts.errors > 0) {
      detail = `${counts.errors} error(s)`;
    } else if (counts.warnings > 0) {
      // Honest C2 framing: warnings are real findings the DEFAULT gate does not block on.
      // Surface them so an adopter sees what is being waved through (and can run --strict).
      detail = `0 errors (${counts.warnings} warning(s) advisory — not blocked; run --strict to block)`;
    } else {
      detail = '0 errors';
    }
    checks.push({ name: 'governance', ok: blocking === 0, detail });
  }

  return evaluateGate(checks);
}

// ---------------------------------------------------------------------------
// Real deps for the CLI (not exercised by the unit tests; covered by the dry-run).
// ---------------------------------------------------------------------------

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Build the real gate deps for a repo: real fs reads, real script spawns, the real audit. */
export function buildGateDeps(repoRoot: string): RunGateDeps {
  return {
    repoRoot,
    readRepo: async () => {
      let rootFiles: string[] = [];
      try {
        rootFiles = await fs.readdir(repoRoot);
      } catch {
        /* empty */
      }
      const manifest = await readJson<{ commands?: Record<string, unknown> }>(
        path.join(repoRoot, 'testing-manifest.json'),
      );
      const pkg = await readJson<{ scripts?: Record<string, string> }>(
        path.join(repoRoot, 'package.json'),
      );
      return { rootFiles, manifest, pkgScripts: (pkg && pkg.scripts) || {} };
    },
    runScript: async (pm, script) => {
      try {
        const { stdout, stderr } = await execFileAsync(pm, ['run', script], {
          cwd: repoRoot,
          maxBuffer: 16 * 1024 * 1024,
        });
        return { code: 0, output: stdout + stderr };
      } catch (err: unknown) {
        const e = err as { code?: number; stdout?: string; stderr?: string };
        return {
          code: typeof e.code === 'number' ? e.code : 1,
          output: (e.stdout ?? '') + (e.stderr ?? ''),
        };
      }
    },
    auditCounts: async () => {
      const cfgPath = path.join(repoRoot, 'governance.yaml');
      const raw = await fs.readFile(cfgPath, 'utf8').catch(() => null);
      if (raw === null) return null;
      const governance = yaml.load(raw) as GovernanceConfig;
      if (!governance || !Array.isArray(governance.rules)) return null;
      const registry = new PredicateRegistry();
      await loadExtensions(registry, path.join(repoRoot, 'engine', 'extensions'));
      const context = await buildAuditContext({ repoRoot, governance });
      const findings = await runAudit({ context, registry, surface: 'engine' });
      return {
        errors: findings.filter((f) => f.severity === 'error').length,
        warnings: findings.filter((f) => f.severity === 'warn').length,
      };
    },
  };
}

/** Human-readable gate report. */
export function renderGateReport(report: GateReport): string {
  const lines: string[] = [];
  lines.push(report.blocked ? 'SHIP GATE: BLOCKED (red)' : 'SHIP GATE: PASS (green)');
  for (const c of report.checks) {
    lines.push(`  [${c.ok ? 'ok' : 'XX'}] ${c.name} - ${c.detail}`);
  }
  return lines.join('\n');
}

/** Machine-readable gate report (`gate --json`) so CI can branch on which checks failed. */
export function renderGateReportJson(report: GateReport): string {
  return JSON.stringify(report);
}
