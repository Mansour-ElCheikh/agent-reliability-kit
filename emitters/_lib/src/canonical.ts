/**
 * Canonical spec loading (canonical/skills/<name>.md, canonical/agents/<name>.md).
 * Ported from emitters/_lib/scaffold_emit.py (Python → TS for S6.3a per ADR-0005).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export type CanonicalKind = 'skill' | 'agent';

export interface CanonicalFrontmatter {
  name: string;
  description: string;
  spec_version: number;
  status?: string;
  purpose?: string;
  applicable_phases?: string[];
  requires?: Record<string, { level?: string; degrades_to?: string }>;
  reads?: string[];
  writes?: string[];
  invokes_skills?: string[];
  invokes_agents?: string[];
  trigger_phrases?: string[];
  emit_to?: string[];
  [key: string]: unknown;
}

export interface CanonicalSpec {
  kind: CanonicalKind;
  path: string;
  frontmatter: CanonicalFrontmatter;
  body: string;
}

export async function loadCanonicalSpec(specPath: string): Promise<CanonicalSpec> {
  const text = await fs.readFile(specPath, 'utf8');
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`${specPath}: no YAML frontmatter found`);
  }
  const frontmatter = yaml.load(match[1]) as CanonicalFrontmatter;
  const body = match[2].replace(/^\n+/, '').replace(/\n+$/, '');

  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error(`${specPath}: frontmatter did not parse to an object`);
  }
  if (!('name' in frontmatter)) {
    throw new Error(`${specPath}: frontmatter missing required field "name"`);
  }
  if (!('spec_version' in frontmatter)) {
    throw new Error(`${specPath}: frontmatter missing required field "spec_version"`);
  }

  const parent = path.basename(path.dirname(specPath));
  let kind: CanonicalKind;
  if (parent === 'skills') kind = 'skill';
  else if (parent === 'agents') kind = 'agent';
  else throw new Error(`${specPath}: unknown canonical kind (parent dir "${parent}")`);

  return { kind, path: specPath, frontmatter, body };
}

export async function loadAllCanonical(canonicalRoot: string): Promise<CanonicalSpec[]> {
  const specs: CanonicalSpec[] = [];
  for (const sub of ['skills', 'agents']) {
    const dir = path.join(canonicalRoot, sub);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    const mdFiles = entries.filter((e) => e.endsWith('.md') && e !== '.gitkeep').sort();
    for (const name of mdFiles) {
      specs.push(await loadCanonicalSpec(path.join(dir, name)));
    }
  }
  return specs;
}

export async function loadToolCapabilities(canonicalRoot: string): Promise<Record<string, ToolCapabilityEntry>> {
  const p = path.join(canonicalRoot, 'tool-capabilities.yaml');
  const raw = await fs.readFile(p, 'utf8');
  const parsed = yaml.load(raw) as Record<string, ToolCapabilityEntry>;
  return parsed;
}

export interface ToolCapabilityEntry {
  tier?: number;
  as_of?: string;
  hook_intercept?: { supports?: boolean | 'partial'; [key: string]: unknown };
  subagent_invocation?: { supports?: boolean | 'partial'; [key: string]: unknown };
  session_lifecycle_hooks?: { supports?: boolean | 'partial'; [key: string]: unknown };
  llm_inline_invocation?: { supports?: boolean | 'partial'; [key: string]: unknown };
  filesystem_writes?: { supports?: boolean | 'partial'; [key: string]: unknown };
  read_only_tools?: { supports?: boolean | 'partial'; [key: string]: unknown };
  bash_invocation?: { supports?: boolean | 'partial'; [key: string]: unknown };
  [key: string]: unknown;
}

export function getSpecRequires(spec: CanonicalSpec, capability: string): { level?: string; degrades_to?: string } {
  return spec.frontmatter.requires?.[capability] ?? {};
}
