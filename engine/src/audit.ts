/**
 * Audit run: load governance.yaml, build the AuditContext, evaluate every
 * in-scope file against every applicable rule's predicate, aggregate findings,
 * compare warn-counts to the ratchet baseline, write the report (JSON or TOON).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import yaml from 'js-yaml';
import picomatch from 'picomatch';
import type {
  AuditContext,
  AuditReport,
  Finding,
  GovernanceConfig,
  GovernanceRule,
  Severity,
} from './types.js';
import { PredicateRegistry } from './predicates.js';
import { readBaseline, warnCountsByRule, compareToBaseline } from './ratchet.js';
import { formatToonReport } from './toon.js';

const execFileAsync = promisify(execFile);

export async function loadGovernance(configPath: string): Promise<GovernanceConfig> {
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = yaml.load(raw) as GovernanceConfig;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rules)) {
    throw new Error(`${configPath}: not a valid governance config (missing rules array)`);
  }
  return parsed;
}

async function git(repoRoot: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Filesystem fallback for file discovery when git is unavailable (fresh
 * checkout before first commit, non-git adopter tree, or test fixtures).
 * Walks repoRoot, skipping node_modules / .git / dist / .scaffold.
 */
async function walkFiles(repoRoot: string): Promise<string[]> {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.scaffold', 'coverage']);
  const out: string[] = [];
  async function recurse(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        await recurse(path.join(dir, e.name));
      } else if (e.isFile()) {
        out.push(path.relative(repoRoot, path.join(dir, e.name)));
      }
    }
  }
  await recurse(repoRoot);
  return out.sort();
}

export interface BuildContextOptions {
  repoRoot: string;
  governance: GovernanceConfig;
  /** When true, restrict affectedFiles to git staged files (pre-commit / hook). */
  stagedOnly?: boolean;
}

export async function buildAuditContext(opts: BuildContextOptions): Promise<AuditContext> {
  const { repoRoot, governance, stagedOnly } = opts;
  const headCommit = await git(repoRoot, ['rev-parse', 'HEAD']);
  const headCommitMessage = headCommit ? await git(repoRoot, ['log', '-1', '--format=%B']) : '';

  const include = governance.scope?.include ?? ['**'];
  const exclude = governance.scope?.exclude ?? [];
  const isIncluded = picomatch(include);
  const isExcluded = exclude.length > 0 ? picomatch(exclude) : () => false;

  // All tracked files (git ls-files), or a filesystem walk when git is
  // unavailable (fresh checkout / non-git tree / test fixtures).
  let tracked = (await git(repoRoot, ['ls-files'])).split('\n').filter(Boolean);
  if (tracked.length === 0) {
    tracked = await walkFiles(repoRoot);
  }
  const allInScopeFiles = tracked.filter((f) => isIncluded(f) && !isExcluded(f));

  let affectedFiles: string[];
  if (stagedOnly) {
    const staged = (await git(repoRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']))
      .split('\n')
      .filter(Boolean);
    affectedFiles = staged.filter((f) => isIncluded(f) && !isExcluded(f));
  } else if (headCommit) {
    const changed = (
      await git(repoRoot, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])
    )
      .split('\n')
      .filter(Boolean);
    affectedFiles = changed.filter((f) => isIncluded(f) && !isExcluded(f));
  } else {
    affectedFiles = allInScopeFiles;
  }

  return { repoRoot, governance, headCommit, headCommitMessage, affectedFiles, allInScopeFiles };
}

function ruleApplies(rule: GovernanceRule, surface: 'engine' | 'hook'): boolean {
  if (rule.status === 'deprecated') return false;
  return rule.enforcement.includes(surface);
}

function filesForRule(
  rule: GovernanceRule,
  context: AuditContext,
  surface: 'engine' | 'hook',
): string[] {
  // hook surface evaluates only the affected (staged/changed) files; engine
  // evaluates the full in-scope set.
  const universe = surface === 'hook' ? context.affectedFiles : context.allInScopeFiles;
  const scope = rule.scope ?? rule.file_patterns;
  if (!scope) return universe;
  const patterns = Array.isArray(scope) ? scope : [scope];
  const match = picomatch(patterns);
  const excl =
    rule.exclude_patterns && rule.exclude_patterns.length > 0
      ? picomatch(rule.exclude_patterns)
      : () => false;
  return universe.filter((f) => match(f) && !excl(f));
}

/**
 * ADR-0007 severity resolution. Order of precedence:
 *   1. safety rule (e.g. no_secrets)      → always `error` (ignores advisory + profile)
 *   2. legacy advisory mode               → `audit` (unchanged behaviour)
 *   3. profile=team + ramp_to_error_on_team + base warn → `error` (the soft-start ramp)
 *   4. otherwise                          → the predicate's own severity
 * No-op for any rule lacking the ADR-0007 markers, so existing configs are
 * unaffected (profile defaults to 'solo').
 */
export function resolveEffectiveSeverity(
  base: Severity,
  rule: GovernanceRule,
  governance: GovernanceConfig,
): Severity {
  if (rule.safety === true) return 'error';
  if (governance.mode?.default === 'advisory') return 'audit';
  const profile = governance.profile ?? 'solo';
  if (profile === 'team' && rule.ramp_to_error_on_team === true && base === 'warn') {
    return 'error';
  }
  return base;
}

export interface RunAuditOptions {
  context: AuditContext;
  registry: PredicateRegistry;
  surface: 'engine' | 'hook';
}

export async function runAudit(opts: RunAuditOptions): Promise<Finding[]> {
  const { context, registry, surface } = opts;
  const findings: Finding[] = [];

  for (const rule of context.governance.rules) {
    if (!ruleApplies(rule, surface)) continue;
    const files = filesForRule(rule, context, surface);
    for (const filePath of files) {
      let fileContent = '';
      try {
        fileContent = await fs.readFile(path.join(context.repoRoot, filePath), 'utf8');
      } catch {
        // file may be deleted/renamed; predicate decides how to handle empty content
      }
      const raw = await registry.evaluate(rule.check, { filePath, fileContent, rule, context });
      for (const f of raw) {
        findings.push({
          ...f,
          severity: resolveEffectiveSeverity(f.severity, rule, context.governance),
        });
      }
    }
  }
  return findings;
}

export type ReportFormat = 'json' | 'toon';

export async function buildReport(
  context: AuditContext,
  findings: Finding[],
): Promise<AuditReport> {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warn').length;
  const auditOnly = findings.filter((f) => f.severity === 'audit').length;

  const perRule: Record<string, number> = {};
  for (const f of findings) perRule[f.ruleId] = (perRule[f.ruleId] ?? 0) + 1;

  const baseline = await readBaseline(context.repoRoot);
  const warnCounts = warnCountsByRule(findings);
  const comparison = compareToBaseline(warnCounts, baseline);

  return {
    version: 1,
    ran_at: new Date().toISOString(),
    project: context.governance.project,
    scope: {
      include: context.governance.scope?.include ?? ['**'],
      exclude: context.governance.scope?.exclude ?? [],
    },
    totals: { errors, warnings, audit_only: auditOnly },
    per_rule_counts: perRule,
    ratchet: {
      baseline,
      diff: comparison.diff,
      exceeded: comparison.exceeded,
    },
    findings,
  };
}

export async function writeReport(
  repoRoot: string,
  report: AuditReport,
  format: ReportFormat,
): Promise<string> {
  const scaffoldDir = path.join(repoRoot, '.scaffold');
  await fs.mkdir(scaffoldDir, { recursive: true });
  const ts = report.ran_at.replace(/[:.]/g, '-');
  const ext = format === 'toon' ? 'toon' : 'json';
  const reportPath = path.join(scaffoldDir, `audit-report.${ts}.${ext}`);
  const body =
    format === 'toon' ? formatToonReport(report) : JSON.stringify(report, null, 2) + '\n';
  await fs.writeFile(reportPath, body, 'utf8');
  return reportPath;
}

export function renderHumanSummary(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`Governance audit — ${report.project}`);
  lines.push(
    `  ${report.totals.errors} error(s), ${report.totals.warnings} warning(s), ${report.totals.audit_only} audit-only`,
  );
  if (Object.keys(report.per_rule_counts).length > 0) {
    lines.push('  Per-rule:');
    for (const [ruleId, count] of Object.entries(report.per_rule_counts)) {
      lines.push(`    ${ruleId}: ${count}`);
    }
  }
  if (report.ratchet.exceeded) {
    lines.push('  RATCHET EXCEEDED — these rules grew past baseline:');
    for (const [ruleId, d] of Object.entries(report.ratchet.diff)) {
      if (d.delta > 0) lines.push(`    ${ruleId}: ${d.baseline} → ${d.current} (+${d.delta})`);
    }
  } else if (report.ratchet.baseline) {
    lines.push('  Ratchet: within baseline.');
  } else {
    lines.push('  Ratchet: no baseline set (run `ratchet emit` to establish one).');
  }
  const topErrors = report.findings.filter((f) => f.severity === 'error').slice(0, 10);
  if (topErrors.length > 0) {
    lines.push('  Errors:');
    for (const f of topErrors) {
      const loc = f.line !== undefined ? `${f.filePath}:${f.line}` : f.filePath;
      lines.push(`    [${f.ruleId}] ${loc} — ${f.message}`);
    }
  }
  return lines.join('\n');
}
