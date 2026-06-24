/**
 * Skill-anatomy validation per ADR-0020 (adapted from RepoNav, 2026-04-30).
 *
 * Every canonical skill MUST contain (in this order):
 *   1. YAML frontmatter (name, description ≤1024 chars, spec_version)
 *   2. # H1 title
 *   3. ## Overview
 *   4. ## When to Use (with **When NOT to use:** clause)
 *   5. Workflow body
 *   6. ## Common Rationalizations
 *   7. ## Red Flags
 *   8. ## Verification
 *
 * Emitters call validateSkillAnatomy() before rendering. Non-empty errors → exit 4 (author bug).
 * This gate ensures the S6 v0.1.0 anatomy gaps don't reappear via canonical drift.
 */

import type { CanonicalSpec } from './canonical.js';

export type AnatomyErrorKind =
  | 'missing_section'
  | 'missing_clause'
  | 'description_too_long'
  | 'missing_h1';

export interface AnatomyError {
  kind: AnatomyErrorKind;
  detail: string;
}

const REQUIRED_SECTIONS = [
  '## Overview',
  '## When to Use',
  '## Common Rationalizations',
  '## Red Flags',
  '## Verification',
];

const REQUIRED_CLAUSE = /\*\*When NOT to use:?\*\*/;
const H1_RE = /^# .+/m;
const DESCRIPTION_MAX = 1024;

export function validateSkillAnatomy(spec: CanonicalSpec): AnatomyError[] {
  // Agents follow their own contract; only skills get the anatomy gate.
  if (spec.kind !== 'skill') return [];

  const errors: AnatomyError[] = [];

  if (!H1_RE.test(spec.body)) {
    errors.push({ kind: 'missing_h1', detail: 'body lacks an H1 (# <Title>)' });
  }

  for (const section of REQUIRED_SECTIONS) {
    // Match the section heading anywhere in the body (line-start, exact text)
    const pattern = new RegExp(`^${escapeRegExp(section)}$`, 'm');
    if (!pattern.test(spec.body)) {
      errors.push({ kind: 'missing_section', detail: section });
    }
  }

  if (!REQUIRED_CLAUSE.test(spec.body)) {
    errors.push({ kind: 'missing_clause', detail: '**When NOT to use:** clause inside "## When to Use" section' });
  }

  const description = spec.frontmatter.description ?? '';
  if (description.length > DESCRIPTION_MAX) {
    errors.push({
      kind: 'description_too_long',
      detail: `description is ${description.length} chars; max ${DESCRIPTION_MAX} per ADR-0020`,
    });
  }

  return errors;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatAnatomyErrors(spec: CanonicalSpec, errors: AnatomyError[]): string {
  if (errors.length === 0) return '';
  const lines = [`Canonical skill ${spec.path} fails ADR-0020 anatomy gate:`];
  for (const err of errors) {
    lines.push(`  - ${err.kind}: ${err.detail}`);
  }
  return lines.join('\n');
}
