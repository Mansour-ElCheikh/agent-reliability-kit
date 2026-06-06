/**
 * Generated-file header per emitter-contract.md §3.2.
 * Placement: AFTER the closing frontmatter `---`, BEFORE the body H1.
 */

export interface GeneratedHeaderOptions {
  canonicalPath: string;
  emitterName: string;
  emitterVersion?: string;
  extraLines?: string[];
  /** Override timestamp (used by tests to produce deterministic goldens before normalisation). */
  timestamp?: string;
}

export function generatedHeader(options: GeneratedHeaderOptions): string {
  const { canonicalPath, emitterName, emitterVersion = '1', extraLines, timestamp } = options;
  const ts = timestamp ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const lines = [
    '<!--',
    `GENERATED FROM: ${canonicalPath}`,
    `EMITTER: ${emitterName} (v${emitterVersion})`,
    `GENERATED AT: ${ts}`,
    'DO NOT EDIT - changes will be overwritten on next emit.',
    'To customise: copy this file to a different name and break the canonical link.',
  ];
  if (extraLines && extraLines.length > 0) {
    lines.push('');
    lines.push(...extraLines);
  }
  lines.push('-->');
  return lines.join('\n') + '\n';
}
