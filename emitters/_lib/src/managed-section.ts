/**
 * Steering-file managed-section pattern per emitter-contract.md §3.4.
 * Adopter content outside markers preserved; content between markers replaced.
 */

import { EXIT_MODE_CONFLICT, EXIT_AUTHOR_BUG } from './exit-codes.js';

export type EmitMode = 'bootstrap' | 'adopt' | 'overwrite';

export function steeringMarkers(emitterSlug: string): { begin: string; end: string } {
  return {
    begin: `<!-- BEGIN scaffold-managed: ${emitterSlug} -->`,
    end: `<!-- END scaffold-managed: ${emitterSlug} -->`,
  };
}

export class ManagedSectionError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(message);
    this.name = 'ManagedSectionError';
  }
}

function indexAll(haystack: string, needle: string): number[] {
  const positions: number[] = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    positions.push(i);
    i = haystack.indexOf(needle, i + needle.length);
  }
  return positions;
}

export interface ApplyManagedSectionOptions {
  existing: string;
  managedContent: string;
  emitterSlug: string;
  mode: EmitMode;
}

export function applyManagedSection(options: ApplyManagedSectionOptions): string {
  const { existing, managedContent, emitterSlug, mode } = options;
  const { begin, end } = steeringMarkers(emitterSlug);

  const beginPositions = indexAll(existing, begin);
  const endPositions = indexAll(existing, end);

  // E14: malformed marker nesting
  if (beginPositions.length > 1 || endPositions.length > 1) {
    throw new ManagedSectionError(
      `multiple BEGIN/END markers in steering file (found ${beginPositions.length} BEGIN, ${endPositions.length} END; expected at most one of each)`,
      EXIT_AUTHOR_BUG,
    );
  }
  if ((beginPositions.length === 1) !== (endPositions.length === 1)) {
    throw new ManagedSectionError(
      `unmatched BEGIN/END markers in steering file (expected matched pair)`,
      EXIT_AUTHOR_BUG,
    );
  }
  if (beginPositions.length === 1 && endPositions.length === 1 && endPositions[0] < beginPositions[0]) {
    throw new ManagedSectionError(`END marker before BEGIN marker in steering file`, EXIT_AUTHOR_BUG);
  }

  const hasMarkers = beginPositions.length === 1;
  const managedBlock = `${begin}\n${managedContent}\n${end}`;

  if (mode === 'overwrite') {
    return managedBlock + '\n';
  }

  if (mode === 'bootstrap') {
    if (existing.trim() !== '' || hasMarkers) {
      throw new ManagedSectionError(
        `bootstrap mode requires absent or empty steering file (found ${existing.length} bytes; existing markers: ${hasMarkers})`,
        EXIT_MODE_CONFLICT,
      );
    }
    return managedBlock + '\n';
  }

  if (mode === 'adopt') {
    if (existing.trim() === '') {
      return managedBlock + '\n';
    }
    if (hasMarkers) {
      // Replace content between markers
      return (
        existing.slice(0, beginPositions[0]) +
        managedBlock +
        existing.slice(endPositions[0] + end.length)
      );
    } else {
      // Append markers at file end; preserve everything that was there
      const sep = existing.endsWith('\n') ? '' : '\n';
      return existing + sep + '\n' + managedBlock + '\n';
    }
  }

  throw new ManagedSectionError(`unknown mode: ${mode}`, EXIT_AUTHOR_BUG);
}
