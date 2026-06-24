/**
 * Unit tests for the Min-Invariant predicates (ADR-0010).
 *
 * These restore the RepoNav R21 / R20 binding lost during extraction:
 *   - tasks_min_invariant      (R21 analogue) — tasks.md Min-Invariant column
 *   - test_shape_assertions    (R20 analogue) — shape-only test assertions
 *
 * Predicates are pure functions of PredicateInput, so they are tested directly
 * (faithful to RepoNav's src/governance/testQualityRules.test.ts structure).
 * The assertions here are themselves Min-Invariants: concrete counts, rule ids,
 * line numbers, and message substrings — never bare `toBeDefined`.
 */

import { describe, it, expect } from 'vitest';
import {
  tasks_min_invariant,
  test_shape_assertions,
  doc_validity,
  userfacing_integration_layer,
  source_file_has_test,
  BUILTIN_PREDICATES,
  PredicateRegistry,
} from '../src/predicates.js';
import type { AuditContext, GovernanceRule, PredicateInput } from '../src/types.js';

function mkInput(
  filePath: string,
  fileContent: string,
  rule: Partial<GovernanceRule> = {},
  ctx: Partial<AuditContext> = {},
): PredicateInput {
  const fullRule: GovernanceRule = {
    id: 'min_invariant_per_task',
    severity: 'warn',
    description: '',
    enforcement: ['engine'],
    check: 'tasks_min_invariant',
    ...rule,
  };
  // Min-Invariant predicates ignore context; doc_validity reads context.now for
  // a deterministic expiry clock (ADR-0025). Default stub is sufficient otherwise.
  return { filePath, fileContent, rule: fullRule, context: ctx as AuditContext };
}

const TASKS_HEADER = `| # | Spec | Task | TDD Behavior | Min-Invariant | Status |
|---|---|---|---|---|---|`;

describe('tasks_min_invariant (R21 analogue)', () => {
  it('flags a forbidden shape-only value in the Min-Invariant column', async () => {
    const md = `# Tasks\n\n${TASKS_HEADER}
| 1 | 001 | parse config | given a file when parsed then returns config | array | Pending |`;
    const findings = await tasks_min_invariant(mkInput('dev/epics/001-x/tasks.md', md));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('min_invariant_per_task');
    expect(findings[0].severity).toBe('warn');
    expect(findings[0].message).toContain('array');
  });

  it('passes a row whose Min-Invariant is a concrete value', async () => {
    const md = `${TASKS_HEADER}
| 1 | 001 | count files | given 3 files when scanned then count is 3 | === 3 | Pending |`;
    const findings = await tasks_min_invariant(mkInput('dev/epics/001-x/tasks.md', md));
    expect(findings).toHaveLength(0);
  });

  it('flags an empty / placeholder Min-Invariant cell', async () => {
    const md = `${TASKS_HEADER}
| 1 | 001 | a | given a when b then c | - | Pending |
| 2 | 001 | d | given d when e then f |  | Pending |
| 3 | 001 | g | given g when h then i | N/A | Pending |`;
    const findings = await tasks_min_invariant(mkInput('dev/epics/001-x/tasks.md', md));
    expect(findings).toHaveLength(3);
    expect(findings.every((f) => /empty/i.test(f.message))).toBe(true);
  });

  it('reports the 1-based line number of the offending row', async () => {
    const md = `# Tasks\n\n${TASKS_HEADER}
| 1 | 001 | ok | given when then | > 0 | Pending |
| 2 | 001 | bad | given when then | defined | Pending |`;
    const findings = await tasks_min_invariant(mkInput('dev/epics/001-x/tasks.md', md));
    expect(findings).toHaveLength(1);
    // header on lines 3-4, ok row line 5, bad row line 6
    expect(findings[0].line).toBe(6);
  });

  it('honours a custom forbidden_invariant_values list on the rule', async () => {
    const md = `${TASKS_HEADER}
| 1 | 001 | a | given when then | banana | Pending |`;
    const findings = await tasks_min_invariant(
      mkInput('dev/epics/001-x/tasks.md', md, { forbidden_invariant_values: ['banana'] }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('banana');
  });

  it('does not false-positive on a NON-task table that has no Min-Invariant column', async () => {
    const md = `| Name | Value |
|---|---|
| array | object |`;
    const findings = await tasks_min_invariant(mkInput('dev/epics/001-x/tasks.md', md));
    expect(findings).toHaveLength(0);
  });

  it('flags a TASK table that omits the Min-Invariant column entirely (A2 - the spec-skill default)', async () => {
    // The 4-col template the spec skill ships (no Min-Invariant column) must NOT sail through
    // governance clean - that is the compounding A1+A2 false-green the battle-test found.
    const md = `# Tasks

| # | Task | TDD Behavior | Status |
|---|---|---|---|
| 1 | parse config | given a file when parsed then config | Pending |`;
    const findings = await tasks_min_invariant(mkInput('dev/epics/001-x/tasks.md', md));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('min_invariant_per_task');
    expect(findings[0].message).toMatch(/Min-Invariant column/i);
  });
});

describe('test_shape_assertions (R20 analogue)', () => {
  it('flags an it() block whose only assertion is shape-only', async () => {
    const src = `it('returns results', () => {
  const r = scan();
  expect(r).toBeDefined();
});`;
    const findings = await test_shape_assertions(
      mkInput('src/scan.test.ts', src, { id: 'test_invariants', check: 'test_shape_assertions' }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('test_invariants');
    expect(findings[0].message).toContain('returns results');
  });

  it('passes a block that carries a domain invariant', async () => {
    const src = `it('finds three files', () => {
  const r = scan();
  expect(r.length).toBeGreaterThan(0);
});`;
    const findings = await test_shape_assertions(
      mkInput('src/scan.test.ts', src, { id: 'test_invariants', check: 'test_shape_assertions' }),
    );
    expect(findings).toHaveLength(0);
  });

  it('passes a block that mixes shape and a domain invariant', async () => {
    const src = `it('returns a populated array', () => {
  const r = scan();
  expect(Array.isArray(r)).toBe(true);
  expect(r).toContain('workspaceRoot');
});`;
    const findings = await test_shape_assertions(
      mkInput('src/scan.test.ts', src, { id: 'test_invariants', check: 'test_shape_assertions' }),
    );
    expect(findings).toHaveLength(0);
  });

  it('flags each offending block independently', async () => {
    const src = `it('a', () => { expect(x).toBeDefined(); });
it('b', () => { expect(Array.isArray(y)).toBe(true); });
it('c', () => { expect(z.length).toBe(2); });`;
    const findings = await test_shape_assertions(
      mkInput('src/m.test.ts', src, { id: 'test_invariants', check: 'test_shape_assertions' }),
    );
    expect(findings).toHaveLength(2);
  });
});

describe('test_shape_assertions — pytest style (deweld, ADR-0022)', () => {
  const rule = { id: 'test_invariants', check: 'test_shape_assertions' };

  it('flags a pytest test whose only assertion is shape-only (is not None)', async () => {
    const src = `def test_returns_results():
    result = scan()
    assert result is not None
`;
    const findings = await test_shape_assertions(mkInput('tests/test_scan.py', src, rule));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('test_invariants');
    expect(findings[0].message).toContain('test_returns_results');
  });

  it('passes a pytest test carrying a domain invariant (== 3)', async () => {
    const src = `def test_finds_three():
    result = scan()
    assert len(result) == 3
`;
    const findings = await test_shape_assertions(mkInput('tests/test_scan.py', src, rule));
    expect(findings).toHaveLength(0);
  });

  it('passes a pytest test that expects a specific exception (pytest.raises)', async () => {
    const src = `def test_rejects_none():
    with pytest.raises(ValueError):
        scan(None)
`;
    const findings = await test_shape_assertions(mkInput('tests/test_scan.py', src, rule));
    expect(findings).toHaveLength(0);
  });

  it('flags a bare-truthiness pytest assertion', async () => {
    const src = `def test_parses():
    assert parse(text)
`;
    const findings = await test_shape_assertions(mkInput('tests/test_parse.py', src, rule));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('test_parses');
  });

  it('flags each offending pytest function independently', async () => {
    const src = `def test_a():
    assert scan() is not None

def test_b():
    assert len(scan()) == 2

def test_c():
    assert isinstance(scan(), list)
`;
    const findings = await test_shape_assertions(mkInput('tests/test_multi.py', src, rule));
    // test_a (is not None) + test_c (isinstance) are shape-only; test_b has == 2
    expect(findings).toHaveLength(2);
  });

  it('honours an explicit rule.assertion_style override even on an unknown extension', async () => {
    const src = `def test_x():
    assert x is not None
`;
    const flagged = await test_shape_assertions(
      mkInput('weird.txt', src, { ...rule, assertion_style: 'pytest' }),
    );
    expect(flagged).toHaveLength(1);
    // …and without the override an unknown extension cannot be judged
    const skipped = await test_shape_assertions(mkInput('weird.txt', src, rule));
    expect(skipped).toHaveLength(0);
  });

  it('returns [] for a language it has no vocabulary for (cannot judge)', async () => {
    const src = `def test_x()\n  assert x.present?\nend\n`;
    const findings = await test_shape_assertions(mkInput('spec/scan_spec.rb', src, rule));
    expect(findings).toHaveLength(0);
  });
});

describe('doc_validity — frontmatter contract + expiry (ADR-0025)', () => {
  const NOW = new Date('2026-06-06T12:00:00Z');
  const rule = { id: 'doc_validity', check: 'doc_validity', severity: 'warn' as const };

  it('flags a doc whose as_of + expires_after_days window has elapsed', async () => {
    const md = `---\nvalidity: current\nas_of: 2026-01-01\nexpires_after_days: 30\n---\n# Plan\n`;
    const f = await doc_validity(mkInput('dev/plan.md', md, rule, { now: NOW }));
    expect(f).toHaveLength(1);
    expect(f[0].ruleId).toBe('doc_validity');
    expect(f[0].severity).toBe('warn');
    expect(f[0].message).toMatch(/expired/i);
  });

  it('passes a doc still inside its validity window', async () => {
    const md = `---\nvalidity: current\nas_of: 2026-06-01\nexpires_after_days: 90\n---\n# Roadmap\n`;
    const f = await doc_validity(mkInput('ROADMAP.md', md, rule, { now: NOW }));
    expect(f).toHaveLength(0);
  });

  it('honours an explicit expires: date — past is flagged, future is clean', async () => {
    const past = `---\nvalidity: current\nas_of: 2026-01-01\nexpires: 2026-02-01\n---\n`;
    const future = `---\nvalidity: current\nas_of: 2026-01-01\nexpires: 2099-01-01\n---\n`;
    expect(await doc_validity(mkInput('a.md', past, rule, { now: NOW }))).toHaveLength(1);
    expect(await doc_validity(mkInput('b.md', future, rule, { now: NOW }))).toHaveLength(0);
  });

  it('still flags a missing frontmatter key at rule severity (presence check intact)', async () => {
    const md = `---\nvalidity: current\nas_of: 2026-06-01\n---\n`; // no expiry key
    const f = await doc_validity(mkInput('c.md', md, { ...rule, severity: 'error' }, { now: NOW }));
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
    expect(f[0].message).toMatch(/expires_after_days/);
  });

  it('does not warn when the date is unparseable (conservative, no false positive)', async () => {
    const md = `---\nvalidity: current\nas_of: someday\nexpires_after_days: 30\n---\n`;
    const f = await doc_validity(mkInput('d.md', md, rule, { now: NOW }));
    expect(f).toHaveLength(0);
  });

  it('flags a doc with no frontmatter at all', async () => {
    const f = await doc_validity(mkInput('e.md', '# no frontmatter\n', rule, { now: NOW }));
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/no validity frontmatter/);
  });
});

describe('predicate registry', () => {
  it('registers both Min-Invariant predicates as built-ins', () => {
    expect(Object.keys(BUILTIN_PREDICATES)).toContain('tasks_min_invariant');
    expect(Object.keys(BUILTIN_PREDICATES)).toContain('test_shape_assertions');
    const list = new PredicateRegistry().list();
    expect(list).toContain('tasks_min_invariant');
    expect(list).toContain('test_shape_assertions');
    expect(list).toContain('userfacing_integration_layer');
  });
});

describe('source_file_has_test (layout-agnostic test existence, ADR-0026)', () => {
  const mkSrc = (
    filePath: string,
    allInScopeFiles: string[],
    rule: Partial<GovernanceRule> = {},
  ): PredicateInput => ({
    filePath,
    fileContent: '',
    rule: {
      id: 'tdd_test_exists',
      severity: 'warn',
      description: '',
      enforcement: ['engine'],
      check: 'source_file_has_test',
      ...rule,
    },
    context: {
      repoRoot: '/x',
      governance: { project: 'x', rules: [] },
      headCommit: '',
      headCommitMessage: '',
      affectedFiles: [],
      allInScopeFiles,
    } as AuditContext,
  });

  it('GREEN central dir: engine/src/gate.ts covered by engine/test/gate.test.ts (the case co-located could not see)', async () => {
    expect(
      await source_file_has_test(
        mkSrc('engine/src/gate.ts', ['engine/src/gate.ts', 'engine/test/gate.test.ts']),
      ),
    ).toEqual([]);
  });

  it('RED: a source file with no name-matching test anywhere in scope is flagged once', async () => {
    const f = await source_file_has_test(
      mkSrc('engine/src/orphan.ts', ['engine/src/orphan.ts', 'engine/test/gate.test.ts']),
    );
    expect(f).toHaveLength(1);
    expect(f[0].ruleId).toBe('tdd_test_exists');
    expect(f[0].message).toMatch(/no test found/);
  });

  it('GREEN co-located: subsumes the sibling case (src/foo.ts + src/foo.test.ts)', async () => {
    expect(
      await source_file_has_test(mkSrc('src/foo.ts', ['src/foo.ts', 'src/foo.test.ts'])),
    ).toEqual([]);
  });

  it('a test file itself needs no test', async () => {
    expect(
      await source_file_has_test(mkSrc('engine/test/gate.test.ts', ['engine/test/gate.test.ts'])),
    ).toEqual([]);
  });

  it('exclude_patterns suppresses (type-only / barrel files opt out)', async () => {
    expect(
      await source_file_has_test(
        mkSrc('engine/src/types.ts', ['engine/src/types.ts'], {
          exclude_patterns: ['**/types.ts', '**/index.ts'],
        }),
      ),
    ).toEqual([]);
  });

  it('multi-framework: pytest test_parse.py covers lib/parse.py', async () => {
    expect(
      await source_file_has_test(mkSrc('lib/parse.py', ['lib/parse.py', 'tests/test_parse.py'])),
    ).toEqual([]);
  });

  it('no false match on a different basename (gate.ts is NOT covered by gateway.test.ts)', async () => {
    const f = await source_file_has_test(
      mkSrc('engine/src/gate.ts', ['engine/src/gate.ts', 'engine/test/gateway.test.ts']),
    );
    expect(f).toHaveLength(1);
  });

  it('is registered as a built-in', () => {
    expect(Object.keys(BUILTIN_PREDICATES)).toContain('source_file_has_test');
    expect(new PredicateRegistry().list()).toContain('source_file_has_test');
  });
});

describe('userfacing_integration_layer (gate-bias / ADR-0016)', () => {
  const mkManifest = (
    manifest: unknown,
    allInScopeFiles: string[],
    filePath = 'testing-manifest.json',
  ): PredicateInput => ({
    filePath,
    fileContent: typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
    rule: {
      id: 'userfacing_integration_layer',
      severity: 'warn',
      description: '',
      enforcement: ['engine'],
      check: 'userfacing_integration_layer',
    },
    context: {
      repoRoot: '/x',
      governance: { project: 'x', rules: [] },
      headCommit: '',
      headCommitMessage: '',
      affectedFiles: [],
      allInScopeFiles,
    } as AuditContext,
  });
  const UNIT_ONLY = {
    version: 1,
    commands: { test: { layer: 'unit', scope: ['src/**/*.test.ts'] } },
    surfaces: { core: { minLayers: ['test'] } },
  };
  const WITH_E2E = {
    version: 1,
    commands: { test: { layer: 'unit' }, e2e: { layer: 'e2e', scope: ['e2e/**'] } },
  };

  it('RED: flags route files present but no integration/e2e layer (the WC /share case)', async () => {
    const f = await userfacing_integration_layer(
      mkManifest(UNIT_ONLY, ['app/share/route.ts', 'app/page.tsx', 'src/scoring.ts']),
    );
    expect(f).toHaveLength(1);
    expect(f[0].message).toMatch(/no integration\/e2e layer/);
  });
  it('GREEN: passes when an integration/e2e layer IS declared', () => {
    expect(userfacing_integration_layer(mkManifest(WITH_E2E, ['app/share/route.ts']))).toEqual([]);
  });
  it('SELF-SCOPE: no finding for a deterministic-core project with no route files (RepoNav shape)', () => {
    expect(
      userfacing_integration_layer(
        mkManifest(UNIT_ONLY, ['src/scoring.ts', 'src/parse.ts', 'test/parse.test.mjs']),
      ),
    ).toEqual([]);
  });
  it('evaluates only the manifest file itself, not arbitrary files', () => {
    expect(
      userfacing_integration_layer(mkManifest(UNIT_ONLY, ['app/share/route.ts'], 'src/foo.ts')),
    ).toEqual([]);
  });
});
