#!/usr/bin/env node
/**
 * /scaffold wrapper. The user-facing front door to the kit.
 *
 * Detects Bootstrap vs Adopt mode + which tools the target uses, dispatches
 * every applicable emitter in sequence, seeds team-shared files in Bootstrap
 * mode, and prompts (never silently) before establishing the ratchet baseline.
 *
 * Non-atomic by design: an emitter failure halts; recovery is an
 * idempotent re-run with --mode=adopt.
 *
 * Vault-compose (--integrate-vault): option delta decision #5 + vault
 * decision 2026-03-21. Composable siblings: per-user state to the vault,
 * team-shared discipline to the repo. Neither depends on the other; the
 * kit stays standalone-capable when no vault is present.
 */

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
// scripts/dist/scaffold.js → scaffold repo root is two levels up.
const SCAFFOLD_ROOT = path.resolve(path.dirname(__filename), '..', '..');

type Mode = 'bootstrap' | 'adopt';

interface ToolSpec {
  slug: string;
  /** emitter dist entrypoint relative to scaffold root */
  emitter: string;
  /** detection: any of these paths existing under target → tool in use */
  detect: string[];
  deferred?: boolean;
}

const TOOLS: ToolSpec[] = [
  {
    slug: 'claude-code',
    emitter: 'emitters/claude-code/dist/cli.js',
    detect: ['.claude', 'CLAUDE.md'],
  },
  {
    slug: 'cursor',
    emitter: 'emitters/cursor/dist/cli.js',
    detect: ['.cursor', '.cursorrules'],
  },
  {
    slug: 'copilot-agent',
    emitter: 'emitters/copilot/dist/cli.js',
    detect: ['.github/copilot-instructions.md', '.github/instructions'],
  },
  // v0.2 emitters — detected + reported, but not run (ROADMAP.md).
  { slug: 'codex', emitter: '', detect: ['AGENTS.md'], deferred: true },
  { slug: 'aider', emitter: '', detect: ['CONVENTIONS.md'], deferred: true },
  { slug: 'continue', emitter: '', detect: ['.continuerc.json'], deferred: true },
];

/** Bootstrap-only seed files no emitter owns (design L24). [from, to] under target. */
const SEED_FILES: Array<[string, string]> = [
  ['governance/governance.yaml.example', 'governance.yaml'],
  ['docs/decisions/template.md', 'docs/decisions/template.md'],
  ['conventions/testing-manifest.json.example', 'testing-manifest.json'],
  ['conventions/test-layers.md', 'conventions/test-layers.md'],
  ['conventions/memory-protocol.md', 'conventions/memory-protocol.md'],
  ['conventions/session-harvest.md', 'conventions/session-harvest.md'],
  ['conventions/verification.md', 'conventions/verification.md'],
  // D3 (ADR-0007): the lint/format reference + the adopter CI workflow —
  // the commit-time half of the three-tier model. Never clobbers an
  // adopter's existing config (copySeeds skips if the target exists).
  ['eslint.config.mjs', 'eslint.config.mjs'],
  ['.prettierrc.json', '.prettierrc.json'],
  ['.prettierignore', '.prettierignore'],
  ['conventions/reliability.workflow.yml.example', '.github/workflows/reliability.yml'],
];

const ADOPT_MARKERS = ['.scaffold', 'canonical', '.governance-baseline.json'];

function pathExists(p: string): boolean {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}

async function detectMode(target: string): Promise<Mode> {
  for (const m of ADOPT_MARKERS) {
    if (pathExists(path.join(target, m))) return 'adopt';
  }
  // Any scaffold-managed marker anywhere in a steering file → adopt
  for (const f of ['CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md', 'AGENTS.md', 'CONVENTIONS.md']) {
    const fp = path.join(target, f);
    if (pathExists(fp)) {
      try {
        const txt = await fs.readFile(fp, 'utf8');
        if (txt.includes('scaffold-managed:')) return 'adopt';
      } catch {
        /* ignore */
      }
    }
  }
  return 'bootstrap';
}

function detectTools(target: string): { active: ToolSpec[]; deferred: ToolSpec[] } {
  const active: ToolSpec[] = [];
  const deferred: ToolSpec[] = [];
  for (const t of TOOLS) {
    const present = t.detect.some((d) => pathExists(path.join(target, d)));
    if (!present) continue;
    if (t.deferred) deferred.push(t);
    else active.push(t);
  }
  return { active, deferred };
}

function runEmitter(emitterPath: string, target: string, mode: Mode, dryRun: boolean): Promise<number> {
  return new Promise((resolve) => {
    const args = [
      path.join(SCAFFOLD_ROOT, emitterPath),
      '--output-root',
      target,
      '--mode',
      mode,
    ];
    if (dryRun) args.push('--dry-run');
    const child = spawn('node', args, { stdio: 'inherit' });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

async function copySeeds(target: string, dryRun: boolean): Promise<string[]> {
  const written: string[] = [];
  for (const [from, to] of SEED_FILES) {
    const src = path.join(SCAFFOLD_ROOT, from);
    const dst = path.join(target, to);
    if (pathExists(dst)) continue; // never clobber adopter files
    if (!pathExists(src)) continue;
    if (!dryRun) {
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
    }
    written.push(to);
  }
  return written;
}

function detectVault(): string | null {
  const envVault = process.env.VAULT_PATH;
  if (envVault && pathExists(envVault)) return envVault;
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home && pathExists(path.join(home, 'vault'))) return path.join(home, 'vault');
  return null;
}

const VAULT_LINK = '.scaffold/vault-link.json';

/**
 * Records the per-user vault link so emitted skills + session-harvest route
 * per-user state to the vault and team-shared discipline to the repo. Written
 * under .scaffold/ (gitignored): per-user state never enters the team repo.
 * Idempotent: overwrites any prior link on re-run.
 */
async function integrateVault(target: string, vault: string, dryRun: boolean): Promise<string> {
  const linkPath = path.join(target, VAULT_LINK);
  if (!dryRun) {
    await fs.mkdir(path.dirname(linkPath), { recursive: true });
    await fs.writeFile(
      linkPath,
      JSON.stringify(
        {
          vaultPath: vault,
          integratedAt: new Date().toISOString(),
          contract: 'per-user state -> vault; team-shared discipline -> repo',
          note: 'Composable siblings: kit and vault are independent; this file only records the link.',
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  }
  return linkPath;
}

async function promptYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false; // non-interactive: never auto-confirm
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (ans) => {
      rl.close();
      resolve(/^y(es)?$/i.test(ans.trim()));
    });
  });
}

async function main(): Promise<number> {
  const program = new Command();
  program
    .name('scaffold')
    .description('Bootstrap or adopt the agent-reliability-kit into a project')
    .option('--target <path>', 'Target project root', process.cwd())
    .option('--mode <mode>', 'Force bootstrap|adopt (default: auto-detect)')
    .option('--tools <list>', 'Comma-separated tool slugs to limit emit to')
    .option('--dry-run', 'Show the plan; write nothing', false)
    .option('--integrate-vault', 'Compose with a per-user vault (VAULT_PATH or ~/vault)', false)
    .parse();

  const opts = program.opts<{
    target: string;
    mode?: Mode;
    tools?: string;
    dryRun: boolean;
    integrateVault: boolean;
  }>();

  const target = path.resolve(opts.target);
  if (!pathExists(target)) {
    process.stderr.write(`ERROR: target does not exist: ${target}\n`);
    return 1;
  }

  const mode: Mode = opts.mode ?? (await detectMode(target));
  const { active, deferred } = detectTools(target);

  let selected = active;
  if (opts.tools) {
    const want = new Set(opts.tools.split(',').map((s) => s.trim()));
    selected = active.filter((t) => want.has(t.slug));
  }
  if (selected.length === 0) {
    // No tool detected: default to claude-code if running inside it, else ask.
    if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) {
      selected = TOOLS.filter((t) => t.slug === 'claude-code');
    } else {
      process.stderr.write(
        'No supported tool detected (.claude/.cursor/.github). ' +
          'Re-run with --tools=claude-code|cursor|copilot-agent.\n',
      );
      return 1;
    }
  }

  // ── Dispatch plan ───────────────────────────────────────────────────────
  process.stdout.write(`Scaffold ${opts.dryRun ? '(DRY RUN) ' : ''}— target: ${target}\n`);
  process.stdout.write(`  Mode: ${mode}\n`);
  process.stdout.write(`  Emitters: ${selected.map((t) => t.slug).join(', ')}\n`);
  if (deferred.length > 0) {
    process.stdout.write(
      `  Detected but deferred to v0.2 (ROADMAP.md): ${deferred.map((t) => t.slug).join(', ')}\n`,
    );
  }

  const vault = detectVault();
  if (opts.integrateVault && !vault) {
    process.stderr.write(
      'ERROR: --integrate-vault requested but no vault found ' +
        '(set VAULT_PATH or create ~/vault). The kit works standalone; ' +
        're-run without --integrate-vault for a vault-less setup.\n',
    );
    return 1;
  }
  if (vault && !opts.integrateVault) {
    process.stdout.write(
      `  Vault detected at ${vault}. Re-run with --integrate-vault to compose ` +
        `per-user captures (vault) with team discipline (repo).\n`,
    );
  }

  if (opts.dryRun) {
    process.stdout.write('\nDRY RUN — running each emitter with --dry-run:\n');
  }

  // ── Dispatch (non-atomic; halt on failure) ──────────────────────────────
  for (const tool of selected) {
    process.stdout.write(`\n→ ${tool.slug}\n`);
    const code = await runEmitter(tool.emitter, target, mode, opts.dryRun);
    if (code !== 0) {
      process.stderr.write(
        `\nEmitter ${tool.slug} exited ${code}. Halting (non-atomic). ` +
          `Fix the cause and re-run with --mode=adopt (idempotent).\n`,
      );
      return code;
    }
  }

  // ── Bootstrap seeds ─────────────────────────────────────────────────────
  let seeded: string[] = [];
  if (mode === 'bootstrap') {
    seeded = await copySeeds(target, opts.dryRun);
    if (seeded.length > 0) {
      const verb = opts.dryRun ? 'Would seed' : 'Seeded';
      process.stdout.write(`\n${verb} team-shared files: ${seeded.join(', ')}\n`);
    }
  }

  // ── Ratchet baseline (prompted; never silent) ───────────────────────────
  const baselinePath = path.join(target, '.governance-baseline.json');
  if (!opts.dryRun && !pathExists(baselinePath)) {
    const enginePath = path.join(SCAFFOLD_ROOT, 'engine', 'dist', 'cli.js');
    const govPath = path.join(target, 'governance.yaml');
    if (pathExists(enginePath) && pathExists(govPath)) {
      process.stdout.write('\nThe governance engine is installed but the ratchet baseline is not set.\n');
      const yes = await promptYesNo('Establish the current findings as the initial baseline?');
      if (yes) {
        const code = await new Promise<number>((resolve) => {
          const c = spawn('node', [enginePath, 'ratchet', 'emit', '--repo-root', target, '--config', govPath], {
            stdio: 'inherit',
          });
          c.on('close', (x) => resolve(x ?? 0));
        });
        process.stdout.write(code === 0 ? 'Baseline established.\n' : 'Baseline emit failed; set it manually.\n');
      } else {
        process.stdout.write(
          'Skipped. When ready: node <kit>/engine/dist/cli.js ratchet emit --repo-root .\n',
        );
      }
    }
  }

  // ── Vault compose (opt-in; composable siblings) ─────────────────────────
  if (opts.integrateVault && vault) {
    const linkPath = await integrateVault(target, vault, opts.dryRun);
    const verb = opts.dryRun ? 'Would link' : 'Linked';
    process.stdout.write(
      `\n${verb} vault for compose: ${path.relative(target, linkPath)} (gitignored, per-user).\n` +
        `  Per-user captures + session-harvest -> vault (${vault}).\n` +
        `  Team decisions (docs/decisions/) + team memory (memory/) -> this repo.\n` +
        `  The kit stays standalone-capable; the vault is not a dependency.\n`,
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  process.stdout.write('\nScaffold complete.\n');
  process.stdout.write(`  Mode: ${mode} | Emitters run: ${selected.map((t) => t.slug).join(', ')}\n`);
  process.stdout.write('  Review emit reports under .scaffold/ (gitignored).\n');
  if (!opts.dryRun) {
    const toCommit = ['.claude/', '.cursor/', '.github/', ...seeded].filter(Boolean);
    process.stdout.write(`  Commit: git add ${toCommit.join(' ')} (skip .scaffold/)\n`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`SCAFFOLD FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
