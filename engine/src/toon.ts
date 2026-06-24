/**
 * TOON serializer for the audit report.
 *
 * TOON (Token-Oriented Object Notation) is RepoNav's compact, LLM-token-efficient
 * format: `@section [ ... ]` blocks, `#key:value` space-separated fields, `|` as
 * the within-field list separator, `+N` suffix for truncation. The repetitive
 * part of an audit report (the findings array) is where TOON's 97-99% savings
 * over JSON come from: no repeated `"ruleId":` / `"severity":` / `"filePath":`
 * keys per finding.
 *
 * This writer matches RepoNav's `formatToonReport` conventions
 * (src/analyzers/reportFormatting.ts). The canonical TOON grammar lives in
 * RepoNav; this is a faithful subset for the audit-report shape.
 *
 * Used only when the engine is invoked with `--format=toon`. Default is JSON
 * (CI ecosystem compatibility). See ADR design-review v2 Q4 / L17.
 */

import type { AuditReport } from './types.js';

function esc(s: string): string {
  // TOON fields are space-and-#-delimited; collapse newlines + tabs so a
  // message can't break the line grammar. Pipes are the list separator, so
  // escape literal pipes in free text.
  return s
    .replace(/[\n\t]+/g, ' ')
    .replace(/\|/g, '/')
    .trim();
}

export function formatToonReport(report: AuditReport): string {
  const lines: string[] = [];

  lines.push(
    `@meta #project:${esc(report.project)} #ranAt:${report.ran_at} #schema:${report.version}`,
  );
  lines.push(
    `@totals #errors:${report.totals.errors} #warnings:${report.totals.warnings} #audit:${report.totals.audit_only}`,
  );

  lines.push('@perRule [');
  for (const [ruleId, count] of Object.entries(report.per_rule_counts)) {
    lines.push(`  #rule:${esc(ruleId)} #count:${count}`);
  }
  lines.push(']');

  lines.push(`@ratchet #exceeded:${report.ratchet.exceeded}`);
  const diffEntries = Object.entries(report.ratchet.diff);
  if (diffEntries.length > 0) {
    lines.push('@ratchetDiff [');
    for (const [ruleId, d] of diffEntries) {
      lines.push(`  #rule:${esc(ruleId)} #base:${d.baseline} #cur:${d.current} #delta:${d.delta}`);
    }
    lines.push(']');
  }

  lines.push('@findings [');
  for (const f of report.findings) {
    const lineField = f.line !== undefined ? ` #L:${f.line}` : '';
    lines.push(
      `  #rule:${esc(f.ruleId)} #sev:${f.severity} #f:${esc(f.filePath)}${lineField} #msg:${esc(f.message)}`,
    );
  }
  lines.push(']');

  lines.push(
    `@stats #findings:${report.findings.length} #rules:${Object.keys(report.per_rule_counts).length}`,
  );

  return lines.join('\n') + '\n';
}
