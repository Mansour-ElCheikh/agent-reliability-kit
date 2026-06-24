/**
 * Deweld tests (ADR-0022) — the test-file predicates must work for a non-JS/TS
 * project, not just `.test.<ext>` layouts.
 *
 *   source_file_has_co_located_test  — co-location path is manifest-templated
 *   test_file_in_manifest_directory  — test-file recognition is manifest-driven
 *
 * Both read from a real testing-manifest.json, so these run against temp repo
 * roots written to disk (faithful to how the predicates resolve paths). The
 * back-compat scenarios pin that the JS/TS defaults are unchanged.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  source_file_has_co_located_test,
  test_file_in_manifest_directory,
} from '../src/predicates.js';
import type { AuditContext, GovernanceRule, PredicateInput } from '../src/types.js';

let ROOT = '';

async function write(rel: string, content: string): Promise<void> {
  const abs = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

function input(
  repoRoot: string,
  filePath: string,
  rule: Partial<GovernanceRule> = {},
): PredicateInput {
  const context: AuditContext = {
    repoRoot,
    governance: { project: 'x', rules: [] },
    headCommit: '',
    headCommitMessage: '',
    affectedFiles: [],
    allInScopeFiles: [],
  };
  const fullRule: GovernanceRule = {
    id: 'R',
    severity: 'warn',
    description: '',
    enforcement: ['engine'],
    check: '',
    ...rule,
  };
  return { filePath, fileContent: '', context, rule: fullRule };
}

beforeAll(async () => {
  ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'deweld-'));

  // repoA — pytest project, manifest declares test-file patterns + a tests/ scope
  await write(
    'repoA/testing-manifest.json',
    JSON.stringify({
      version: 1,
      commands: { test: { scope: ['tests/**/test_*.py'] } },
      testFilePatterns: ['**/test_*.py', '**/*_test.py'],
    }),
  );
  await write('repoA/tests/test_scan.py', 'def test_scan():\n    assert scan() == 1\n');
  await write('repoA/src/test_stray.py', 'def test_stray():\n    assert True\n');

  // repoB — pytest co-location via a manifest path template
  await write(
    'repoB/testing-manifest.json',
    JSON.stringify({
      version: 1,
      testFilePatterns: ['**/test_*.py'],
      coLocation: { testPath: '{dir}/test_{name}.{ext}' },
    }),
  );
  await write('repoB/pkg/scan.py', 'def scan():\n    return 1\n');
  await write('repoB/pkg/test_scan.py', 'def test_scan():\n    assert scan() == 1\n');
  await write('repoB/pkg/lonely.py', 'def lonely():\n    return 2\n');

  // repoC — JS/TS defaults (no new manifest fields) — back-compat
  await write('repoC/testing-manifest.json', JSON.stringify({ version: 1, commands: {} }));
  await write('repoC/src/foo.ts', 'export const foo = 1;\n');
  await write('repoC/src/bar.ts', 'export const bar = 2;\n');
  await write('repoC/src/bar.test.ts', "import { bar } from './bar';\n");

  // repoD — no manifest at all
  await write('repoD/src/foo.test.ts', "import {} from './foo';\n");
});

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true });
});

describe('test_file_in_manifest_directory — manifest-driven recognition', () => {
  it('recognises a pytest test file in a declared scope (no finding)', async () => {
    const findings = await test_file_in_manifest_directory(
      input(path.join(ROOT, 'repoA'), 'tests/test_scan.py'),
    );
    expect(findings).toHaveLength(0);
  });

  it('flags a pytest test file outside any declared scope', async () => {
    const findings = await test_file_in_manifest_directory(
      input(path.join(ROOT, 'repoA'), 'src/test_stray.py'),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/declared/i);
  });

  it('back-compat: still recognises a .test.ts file (JS/TS default)', async () => {
    // repoC declares no scopes, so a recognised test file outside scope fires
    const findings = await test_file_in_manifest_directory(
      input(path.join(ROOT, 'repoC'), 'src/bar.test.ts'),
    );
    expect(findings).toHaveLength(1);
  });

  it('still reports a missing manifest for a recognised test file', async () => {
    const findings = await test_file_in_manifest_directory(
      input(path.join(ROOT, 'repoD'), 'src/foo.test.ts'),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/not found/i);
  });

  it('ignores a non-test source file', async () => {
    const findings = await test_file_in_manifest_directory(
      input(path.join(ROOT, 'repoA'), 'src/scanner.py'),
    );
    expect(findings).toHaveLength(0);
  });
});

describe('source_file_has_co_located_test — manifest-templated co-location', () => {
  it('finds a pytest co-located test via the manifest template (no finding)', async () => {
    const findings = await source_file_has_co_located_test(
      input(path.join(ROOT, 'repoB'), 'pkg/scan.py'),
    );
    expect(findings).toHaveLength(0);
  });

  it('flags a pytest source with no co-located test', async () => {
    const findings = await source_file_has_co_located_test(
      input(path.join(ROOT, 'repoB'), 'pkg/lonely.py'),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('pkg/test_lonely.py');
  });

  it('does not require a test for a test file (skip-guard recognises test_*.py)', async () => {
    const findings = await source_file_has_co_located_test(
      input(path.join(ROOT, 'repoB'), 'pkg/test_scan.py'),
    );
    expect(findings).toHaveLength(0);
  });

  it('back-compat: JS/TS default template still finds src/bar.test.ts', async () => {
    const present = await source_file_has_co_located_test(
      input(path.join(ROOT, 'repoC'), 'src/bar.ts'),
    );
    expect(present).toHaveLength(0);
    const missing = await source_file_has_co_located_test(
      input(path.join(ROOT, 'repoC'), 'src/foo.ts'),
    );
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('src/foo.test.ts');
  });
});
