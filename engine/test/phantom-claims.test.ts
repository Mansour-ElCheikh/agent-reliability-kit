/**
 * No-phantom-claims meta-check (ADR-0015).
 *
 * Non-tautological: a do-nothing check (returns []) FAILS the RED cases below (a fictional
 * predicate/rule MUST be reported); a check that flags everything FAILS the "real names" case
 * and the live guard.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_PREDICATES } from '../src/predicates.js';
import { extractCitations, phantomCitations, harvestRuleIds } from '../src/phantom-claims.js';

// engine/test/ -> repo root is two levels up.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

describe('extractCitations', () => {
  it('captures predicate- and rule-context citations and ignores plain backticks', () => {
    const md =
      'governed by `min_invariant_per_task`; the `tasks_min_invariant` predicate flags it; run `npm test`; the `build` skill.';
    const names = extractCitations(md).map((c) => c.name);
    expect(names).toContain('min_invariant_per_task'); // governed by `x`
    expect(names).toContain('tasks_min_invariant'); // `x` predicate
    expect(names).not.toContain('npm'); // `npm test` — not an enforcement context
    expect(names).not.toContain('build'); // "the `build` skill" — not an enforcement context
  });
});

describe('phantomCitations', () => {
  const preds = new Set(Object.keys(BUILTIN_PREDICATES));
  const rules = new Set(['min_invariant_per_task', 'test_invariants']);

  it('RED: flags a cited predicate that does not exist', () => {
    const md = 'the `totally_fictional_predicate` predicate enforces this.';
    expect(phantomCitations(md, preds, rules).map((c) => c.name)).toEqual([
      'totally_fictional_predicate',
    ]);
  });

  it('RED: flags a cited rule that is not shipped', () => {
    const md = 'governed by rule `no_such_rule_anywhere`.';
    expect(phantomCitations(md, preds, rules).map((c) => c.name)).toEqual([
      'no_such_rule_anywhere',
    ]);
  });

  it('GREEN: does not flag a real predicate or a real rule id', () => {
    const md =
      'the `tasks_min_invariant` predicate; governed by `min_invariant_per_task`; rule `test_invariants`.';
    expect(phantomCitations(md, preds, rules)).toEqual([]);
  });
});

describe('harvestRuleIds', () => {
  it('harvests both active and opt-in (commented) rule ids', () => {
    const yaml = [
      'rules:',
      '  - id: tdd_test_first',
      '    severity: warn',
      '  # - id: min_invariant_per_task',
    ].join('\n');
    const ids = harvestRuleIds(yaml);
    expect(ids).toContain('tdd_test_first');
    expect(ids).toContain('min_invariant_per_task'); // opt-in rules are real, shipped, citable
  });
});

describe('LIVE GUARD: canonical skills/agents cite only real predicates/rules', () => {
  it('every enforcement citation in canonical/skills + canonical/agents resolves', async () => {
    const preds = new Set(Object.keys(BUILTIN_PREDICATES));
    const govExample = await fs.readFile(
      path.join(repoRoot, 'governance/governance.yaml.example'),
      'utf8',
    );
    const rules = new Set(harvestRuleIds(govExample));
    // sanity: the harvest actually found the opt-in Min-Invariant rule the skills cite
    expect(rules.has('min_invariant_per_task')).toBe(true);

    const dirs = [
      path.join(repoRoot, 'canonical', 'skills'),
      path.join(repoRoot, 'canonical', 'agents'),
    ];
    const phantoms: string[] = [];
    for (const dir of dirs) {
      for (const file of await collectMarkdown(dir)) {
        const md = await fs.readFile(file, 'utf8');
        for (const c of phantomCitations(md, preds, rules)) {
          phantoms.push(
            `${path.relative(repoRoot, file)}: cites ${c.kind} \`${c.name}\` (no such ${c.kind})`,
          );
        }
      }
    }
    expect(phantoms).toEqual([]);
  });
});

async function collectMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectMarkdown(full)));
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}
