#!/usr/bin/env node
/**
 * Worked-example plan-next context-stub refresher.
 *
 * ADR-0001 ships shapes + worked examples, not production runtimes. This is the
 * `hook.example.sh` / `session-events.writer.example.mjs` precedent applied to
 * the plan-next stub: a copyable reference that regenerates the ≤40-line stub
 * (`canonical/plan-next-stub.schema.md`) that `plan-next` and `sdlc` read.
 *
 * `## Epic status` is scanned from `dev/epics/*​/epic.md` and is the authoritative
 * routing source (ADR-0011); the status→phase mapping itself lives in
 * `canonical/phases.md`. Everything else (milestone, next items, seams) is
 * advisory and host-shaped.
 *
 * A *production* refresher wires this into a host lifecycle (a git post-commit
 * hook, a CI step, a session-start hook); that wiring is yours.
 *
 *   Library:  import { refreshStub } from './governance/plan-next-stub.refresher.example.mjs'
 *             await refreshStub({ repoRoot: '.', out: '.scaffold/plan-next.md' })
 *   CLI:      node governance/plan-next-stub.refresher.example.mjs [--repo .] [--out .scaffold/plan-next.md]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function git(repoRoot, args) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return '';
  }
}

/** Scan dev/epics/<NNN-name>/epic.md for the `**Status:**` line. Authoritative (ADR-0011). */
export async function scanEpicStatuses(repoRoot) {
  const epicsDir = path.join(repoRoot, 'dev', 'epics');
  let entries;
  try {
    entries = (await fs.readdir(epicsDir, { withFileTypes: true })).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    let body = '';
    try {
      body = await fs.readFile(path.join(epicsDir, e.name, 'epic.md'), 'utf8');
    } catch {
      continue;
    }
    const m = body.match(/^\*\*Status:\*\*\s*(.+?)\s*$/m);
    out.push({ name: e.name, status: m ? m[1].trim() : 'Unknown' });
  }
  return out;
}

/** Read the most recent engine audit report if one was written, for the governance line. */
async function governanceSummary(repoRoot) {
  const dir = path.join(repoRoot, '.scaffold');
  try {
    const reports = (await fs.readdir(dir)).filter((f) => /^audit-report\..*\.json$/.test(f)).sort();
    if (reports.length === 0) return 'not run';
    const report = JSON.parse(await fs.readFile(path.join(dir, reports[reports.length - 1]), 'utf8'));
    const t = report.totals ?? {};
    return `${t.errors ?? 0} errors, ${t.warnings ?? 0} warnings`;
  } catch {
    return 'not run';
  }
}

/**
 * Regenerate the plan-next stub. Returns the stub text (also written to `out`).
 * `milestone` + `nextItems` are advisory and project-shaped — pass them in, or
 * adapt this function to read your roadmap format.
 */
export async function refreshStub({ repoRoot = '.', out = '.scaffold/plan-next.md', milestone, nextItems } = {}) {
  const epics = await scanEpicStatuses(repoRoot);
  const head = (await git(repoRoot, ['rev-parse', '--short', 'HEAD'])) || 'none';
  const ts = new Date().toISOString();
  const gov = await governanceSummary(repoRoot);

  const epicLines = epics.length
    ? epics.map((e) => `- ${e.name}: ${e.status}`).join('\n')
    : '- (no dev/epics/ found)';
  const nextLines = (nextItems && nextItems.length ? nextItems : ['(populate from your roadmap; advisory)'])
    .map((i) => `- ${i}`)
    .join('\n');

  const stub = `# Plan-next — ${path.basename(path.resolve(repoRoot))}
_Refreshed ${ts} from ${epics.length} epics, HEAD ${head}_

## Milestone
${milestone ?? '(set from your roadmap)'}

## Epic status
${epicLines}

## Next unstarted items
${nextLines}

## Seam advisories
none (wire your analyser to populate)

## Governance
${gov}
`;

  const outPath = path.join(repoRoot, out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, stub, 'utf8');
  return stub;
}

// CLI entry (runs only when invoked directly).
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : def;
  };
  refreshStub({ repoRoot: opt('--repo', '.'), out: opt('--out', '.scaffold/plan-next.md') })
    .then((stub) => process.stdout.write(stub))
    .catch((err) => {
      process.stderr.write(`${err.message ?? err}\n`);
      process.exit(1);
    });
}
