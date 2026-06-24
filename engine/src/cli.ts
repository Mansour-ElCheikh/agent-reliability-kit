#!/usr/bin/env node
/**
 * Rules engine CLI.
 *
 *   reliability-engine audit   [--config <p>] [--format json|toon] [--staged]
 *   reliability-engine hook                          (reads PreToolUse payload on stdin)
 *   reliability-engine ratchet emit                  (write initial baseline)
 *   reliability-engine ratchet update                (rewrite baseline to current counts)
 *   reliability-engine predicates list
 *
 * Exit codes (see types.ts):
 *   0 clean | 1 errors | 2 ratchet exceeded | 3 usage | 4 internal
 */

import path from 'node:path';
import { Command } from 'commander';
import {
  ENGINE_EXIT_OK,
  ENGINE_EXIT_ERRORS_FOUND,
  ENGINE_EXIT_RATCHET_EXCEEDED,
  ENGINE_EXIT_USAGE,
  ENGINE_EXIT_INTERNAL,
} from './types.js';
import { PredicateRegistry } from './predicates.js';
import { loadExtensions } from './extensions.js';
import {
  loadGovernance,
  buildAuditContext,
  runAudit,
  buildReport,
  writeReport,
  renderHumanSummary,
  type ReportFormat,
} from './audit.js';
import { readBaseline, warnCountsByRule, emitBaseline } from './ratchet.js';
import { parseHookPayload, evaluateHook, readStdin, bestEffortHeadMessage } from './hook.js';
import { buildGateDeps, runGate, renderGateReport, renderGateReportJson } from './gate.js';

async function makeRegistry(repoRoot: string): Promise<PredicateRegistry> {
  const registry = new PredicateRegistry();
  // Adopter predicate extensions: <repo>/engine/extensions/*.predicates.{js,mjs}
  await loadExtensions(registry, path.join(repoRoot, 'engine', 'extensions'));
  return registry;
}

async function cmdAudit(options: {
  config: string;
  format: ReportFormat;
  staged?: boolean;
  repoRoot: string;
}): Promise<number> {
  const governance = await loadGovernance(options.config);
  const registry = await makeRegistry(options.repoRoot);
  const context = await buildAuditContext({
    repoRoot: options.repoRoot,
    governance,
    stagedOnly: options.staged,
  });
  const findings = await runAudit({ context, registry, surface: 'engine' });
  const report = await buildReport(context, findings);
  const reportPath = await writeReport(options.repoRoot, report, options.format);

  process.stdout.write(renderHumanSummary(report) + '\n');
  process.stdout.write(`Report: ${reportPath}\n`);

  if (report.totals.errors > 0) return ENGINE_EXIT_ERRORS_FOUND;
  if (report.ratchet.exceeded) return ENGINE_EXIT_RATCHET_EXCEEDED;
  return ENGINE_EXIT_OK;
}

async function cmdHook(options: { config: string; repoRoot: string }): Promise<number> {
  const stdin = await readStdin();
  const { filePath, content } = parseHookPayload(stdin);
  if (!filePath) return ENGINE_EXIT_OK; // nothing to evaluate; allow

  const governance = await loadGovernance(options.config);
  const registry = await makeRegistry(options.repoRoot);
  const headCommitMessage = await bestEffortHeadMessage(options.repoRoot);

  const blocking = await evaluateHook({
    repoRoot: options.repoRoot,
    governance,
    registry,
    filePath,
    content,
    headCommitMessage,
  });

  if (blocking.length === 0) return ENGINE_EXIT_OK;

  process.stderr.write('GOVERNANCE BLOCKED\n');
  for (const f of blocking) {
    const loc = f.line !== undefined ? `${f.filePath}:${f.line}` : f.filePath;
    process.stderr.write(`  - [${f.ruleId}] ${loc} — ${f.message}\n`);
  }
  // Exit 2 = block the tool call (Claude Code PreToolUse convention).
  return ENGINE_EXIT_RATCHET_EXCEEDED;
}

async function cmdRatchet(
  sub: string,
  options: { config: string; repoRoot: string },
): Promise<number> {
  const governance = await loadGovernance(options.config);
  const registry = await makeRegistry(options.repoRoot);
  const context = await buildAuditContext({ repoRoot: options.repoRoot, governance });
  const findings = await runAudit({ context, registry, surface: 'engine' });
  const counts = warnCountsByRule(findings);

  if (sub === 'emit') {
    const baseline = await emitBaseline(options.repoRoot, counts);
    process.stdout.write(
      `Baseline written: ${JSON.stringify(baseline.counts)} (ratcheted_at ${baseline.ratcheted_at})\n`,
    );
    return ENGINE_EXIT_OK;
  }
  if (sub === 'update') {
    const prev = await readBaseline(options.repoRoot);
    const baseline = await emitBaseline(options.repoRoot, counts);
    process.stdout.write(
      `Baseline updated. Previous: ${JSON.stringify(prev?.counts ?? {})} → New: ${JSON.stringify(baseline.counts)}\n`,
    );
    return ENGINE_EXIT_OK;
  }
  process.stderr.write(`Unknown ratchet subcommand: ${sub} (use 'emit' or 'update')\n`);
  return ENGINE_EXIT_USAGE;
}

async function cmdPredicates(sub: string, options: { repoRoot: string }): Promise<number> {
  if (sub !== 'list') {
    process.stderr.write(`Unknown predicates subcommand: ${sub} (use 'list')\n`);
    return ENGINE_EXIT_USAGE;
  }
  const registry = await makeRegistry(options.repoRoot);
  for (const name of registry.list()) process.stdout.write(name + '\n');
  return ENGINE_EXIT_OK;
}

async function cmdGate(options: {
  repoRoot: string;
  stopHook?: boolean;
  json?: boolean;
  strict?: boolean;
}): Promise<number> {
  const report = await runGate(buildGateDeps(options.repoRoot), { strict: options.strict });

  if (options.stopHook) {
    // Stop-hook mode: a blocked gate emits {decision:block,reason} (the harness makes the
    // agent continue and fix); a passing gate is silent. The JSON does the blocking, so the
    // process still exits 0 (Stop-hook convention).
    if (report.blocked) {
      const why = report.checks
        .filter((c) => !c.ok)
        .map((c) => `${c.name} (${c.detail})`)
        .join('; ');
      process.stdout.write(
        JSON.stringify({
          decision: 'block',
          reason: `Ship gate BLOCKED: ${why}. Fix before shipping.`,
        }),
      );
    }
    return ENGINE_EXIT_OK;
  }

  if (options.json) {
    process.stdout.write(renderGateReportJson(report) + '\n');
    return report.blocked ? ENGINE_EXIT_ERRORS_FOUND : ENGINE_EXIT_OK;
  }

  process.stdout.write(renderGateReport(report) + '\n');
  // Non-stop-hook: exit non-zero on a red gate (CI / manual / orchestrator ship step).
  return report.blocked ? ENGINE_EXIT_ERRORS_FOUND : ENGINE_EXIT_OK;
}

async function main(): Promise<void> {
  const program = new Command();
  program.name('reliability-engine').description('Governance rules engine');

  const repoRootOpt = (): string =>
    path.resolve(program.opts<{ repoRoot?: string }>().repoRoot ?? process.cwd());
  program.option('--repo-root <path>', 'Repository root (default: cwd)');

  program
    .command('audit')
    .option('--config <path>', 'governance.yaml path', 'governance.yaml')
    .option('--format <fmt>', 'json | toon', 'json')
    .option('--staged', 'evaluate only git-staged files (pre-commit use)', false)
    .action(async (opts: { config: string; format: string; staged: boolean }) => {
      const format = opts.format === 'toon' ? 'toon' : 'json';
      process.exitCode = await cmdAudit({
        config: path.resolve(opts.config),
        format,
        staged: opts.staged,
        repoRoot: repoRootOpt(),
      });
    });

  program
    .command('hook')
    .option('--config <path>', 'governance.yaml path', 'governance.yaml')
    .action(async (opts: { config: string }) => {
      process.exitCode = await cmdHook({
        config: path.resolve(opts.config),
        repoRoot: repoRootOpt(),
      });
    });

  program
    .command('ratchet <subcommand>')
    .option('--config <path>', 'governance.yaml path', 'governance.yaml')
    .action(async (subcommand: string, opts: { config: string }) => {
      process.exitCode = await cmdRatchet(subcommand, {
        config: path.resolve(opts.config),
        repoRoot: repoRootOpt(),
      });
    });

  program.command('predicates <subcommand>').action(async (subcommand: string) => {
    process.exitCode = await cmdPredicates(subcommand, { repoRoot: repoRootOpt() });
  });

  program
    .command('gate')
    .description('Run the target repo gates (tests + governance audit) and block ship on red')
    .option('--stop-hook', 'emit a Stop-hook block JSON instead of a non-zero exit', false)
    .option('--json', 'emit the gate report as JSON (for CI); exit code unchanged', false)
    .option('--strict', 'block on warn-severity findings too (default: error-severity only)', false)
    .action(async (opts: { stopHook: boolean; json: boolean; strict: boolean }) => {
      process.exitCode = await cmdGate({
        repoRoot: repoRootOpt(),
        stopHook: opts.stopHook,
        json: opts.json,
        strict: opts.strict,
      });
    });

  await program.parseAsync();
}

main().catch((err) => {
  process.stderr.write(
    `ENGINE INTERNAL ERROR: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(ENGINE_EXIT_INTERNAL);
});
