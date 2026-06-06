#!/usr/bin/env node
/**
 * Rules engine CLI.
 *
 *   scaffold-engine audit   [--config <p>] [--format json|toon] [--staged]
 *   scaffold-engine hook                          (reads PreToolUse payload on stdin)
 *   scaffold-engine ratchet emit                  (write initial baseline)
 *   scaffold-engine ratchet update                (rewrite baseline to current counts)
 *   scaffold-engine predicates list
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

async function main(): Promise<void> {
  const program = new Command();
  program.name('scaffold-engine').description('Governance rules engine');

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

  await program.parseAsync();
}

main().catch((err) => {
  process.stderr.write(
    `ENGINE INTERNAL ERROR: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(ENGINE_EXIT_INTERNAL);
});
