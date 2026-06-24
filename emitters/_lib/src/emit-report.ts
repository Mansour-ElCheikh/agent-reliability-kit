/**
 * Emit report writer per emitter-contract.md §3.3.
 * Writes <output-root>/.scaffold/emit-report.<tool>.<ts>.md.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export type EmitStatus = 'emitted' | 'skipped' | 'degraded' | 'error';

export interface EmitOutcome {
  canonicalPath: string;
  outputPath: string | null;
  status: EmitStatus;
  degradations: Array<[capability: string, degradesTo: string]>;
  reason: string;
  error: string;
}

export function newOutcome(canonicalPath: string): EmitOutcome {
  return {
    canonicalPath,
    outputPath: null,
    status: 'emitted',
    degradations: [],
    reason: '',
    error: '',
  };
}

export interface WriteEmitReportOptions {
  outputRoot: string;
  toolSlug: string;
  tier: number;
  mode: string;
  emitterPath: string;
  emitterVersion: string;
  outcomes: EmitOutcome[];
}

export async function writeEmitReport(options: WriteEmitReportOptions): Promise<string> {
  const { outputRoot, toolSlug, tier, mode, emitterPath, emitterVersion, outcomes } = options;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace(/-\d+Z$/, 'Z');
  const reportDir = path.join(outputRoot, '.scaffold');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `emit-report.${toolSlug}.${ts}.md`);

  const emitted = outcomes.filter((o) => o.status === 'emitted');
  const degraded = outcomes.filter((o) => o.status === 'degraded');
  const skipped = outcomes.filter((o) => o.status === 'skipped');
  const errored = outcomes.filter((o) => o.status === 'error');

  const lines: string[] = [
    '# Emit report',
    `**Tool:** ${toolSlug} (tier ${tier})`,
    `**Mode:** ${mode}`,
    `**Output root:** ${path.resolve(outputRoot)}`,
    `**Emitter:** ${emitterPath} v${emitterVersion}`,
    `**Run at:** ${new Date().toISOString()}`,
    '',
    `## Emitted (${emitted.length})`,
  ];
  for (const o of emitted) {
    lines.push(`- \`${o.outputPath}\` ← \`${o.canonicalPath}\``);
  }
  lines.push('', `## Degraded (${degraded.length})`);
  for (const o of degraded) {
    const degStr = o.degradations.map(([cap, fb]) => `${cap} → ${fb}`).join('; ');
    lines.push(`- \`${o.canonicalPath}\` → \`${o.outputPath}\` — ${degStr}`);
  }
  lines.push('', `## Skipped (${skipped.length})`);
  for (const o of skipped) {
    lines.push(`- \`${o.canonicalPath}\` — ${o.reason}`);
  }
  lines.push('', `## Errors (${errored.length})`);
  for (const o of errored) {
    lines.push(`- \`${o.canonicalPath}\` — ${o.error}`);
  }

  await fs.writeFile(reportPath, lines.join('\n') + '\n', 'utf8');
  return reportPath;
}
