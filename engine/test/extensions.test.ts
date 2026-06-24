/**
 * Unit tests for the adopter predicate loader (engine/src/extensions.ts).
 *
 * This module was extracted as its own unit but its tests never were — it was
 * exercised by NO test (surfaced 2026-06-23 while answering "what's actually
 * covered?"). It is a pure function of a directory on disk, so it is tested
 * directly against real temp dirs containing real `*.predicates.{js,mjs}`
 * files that the loader dynamically imports.
 *
 * Assertions are Min-Invariants: concrete names, counts, undefined-checks, and
 * message substrings — never bare `toBeDefined`.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadExtensions } from '../src/extensions.js';
import { PredicateRegistry } from '../src/predicates.js';
import type { AuditContext, PredicateInput } from '../src/types.js';

const tmpDirs: string[] = [];

/**
 * Create an isolated temp dir holding the given files. A `package.json` with
 * `type: module` is written so both `.js` and `.mjs` files load as ESM under
 * native Node (the loader's documented "drop .mjs OR compiled .js" contract).
 */
async function makeExtDir(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-ext-'));
  tmpDirs.push(dir);
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content);
  }
  return dir;
}

function mkInput(filePath: string): PredicateInput {
  return {
    filePath,
    fileContent: '',
    rule: {
      id: 'R_custom',
      severity: 'warn',
      description: '',
      enforcement: ['engine'],
      check: 'ext_flag_one',
    },
    context: {
      repoRoot: '/x',
      governance: { project: 'x', rules: [] },
      headCommit: '',
      headCommitMessage: '',
      affectedFiles: [],
      allInScopeFiles: [],
    } as AuditContext,
  };
}

afterEach(async () => {
  for (const dir of tmpDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('loadExtensions (adopter predicate loader)', () => {
  it('registers every exported function under its name, skipping non-function exports', async () => {
    const dir = await makeExtDir({
      'custom.predicates.mjs': [
        'export function ext_always_clean() { return []; }',
        'export function ext_flag_one(input) {',
        "  return [{ ruleId: input.rule.id, severity: 'warn', filePath: input.filePath, message: 'flagged by extension' }];",
        '}',
        'export const NOT_A_PREDICATE = 42;',
      ].join('\n'),
    });
    const registry = new PredicateRegistry();
    const baseline = new PredicateRegistry().list().length;

    const loaded = await loadExtensions(registry, dir);

    expect([...loaded].sort()).toEqual(['ext_always_clean', 'ext_flag_one']);
    expect(loaded).not.toContain('NOT_A_PREDICATE');
    expect(typeof registry.get('ext_always_clean')).toBe('function');
    expect(typeof registry.get('ext_flag_one')).toBe('function');
    expect(registry.get('NOT_A_PREDICATE')).toBeUndefined();
    // Additive: built-ins survive, registry grew by exactly the two functions.
    expect(typeof registry.get('no_secrets')).toBe('function');
    expect(registry.list().length).toBe(baseline + 2);
  });

  it('wires a loaded function as a real predicate evaluable through the registry', async () => {
    const dir = await makeExtDir({
      'flag.predicates.mjs': [
        'export function ext_flag_one(input) {',
        "  return [{ ruleId: input.rule.id, severity: 'warn', filePath: input.filePath, message: 'flagged by extension' }];",
        '}',
      ].join('\n'),
    });
    const registry = new PredicateRegistry();
    await loadExtensions(registry, dir);

    const findings = await registry.evaluate('ext_flag_one', mkInput('src/widget.ts'));

    expect(findings).toEqual([
      {
        ruleId: 'R_custom',
        severity: 'warn',
        filePath: 'src/widget.ts',
        message: 'flagged by extension',
      },
    ]);
  });

  it('loads .predicates.mjs and .predicates.js, ignoring every other filename', async () => {
    const dir = await makeExtDir({
      'a.predicates.mjs': 'export function ext_from_mjs() { return []; }',
      'b.predicates.js': 'export function ext_from_js() { return []; }',
      'util.predicates.ts': 'export function ext_from_ts() { return []; }', // .ts is not m?js
      'helper.js': 'export function ext_plain_js() { return []; }', // lacks the .predicates segment
      'notes.txt': 'not code at all',
    });
    const registry = new PredicateRegistry();

    const loaded = await loadExtensions(registry, dir);

    expect([...loaded].sort()).toEqual(['ext_from_js', 'ext_from_mjs']);
    expect(registry.get('ext_from_ts')).toBeUndefined();
    expect(registry.get('ext_plain_js')).toBeUndefined();
  });

  it('returns [] and leaves the registry untouched when the directory does not exist', async () => {
    const registry = new PredicateRegistry();
    const baseline = new PredicateRegistry().list().length;

    const loaded = await loadExtensions(
      registry,
      path.join(os.tmpdir(), 'kit-ext-does-not-exist-zzz'),
    );

    expect(loaded).toEqual([]);
    expect(registry.list().length).toBe(baseline);
  });

  it('throws a wrapped error naming the file when an extension fails to import', async () => {
    const dir = await makeExtDir({
      'broken.predicates.mjs': [
        "throw new Error('boom in extension');",
        'export function never_reached() { return []; }',
      ].join('\n'),
    });
    const registry = new PredicateRegistry();

    const err = await loadExtensions(registry, dir).catch((e) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Failed to import predicate extension/);
    expect(err.message).toContain('broken.predicates.mjs');
    // the original module-evaluation error is chained as `cause`, not flattened into the string
    expect(err.cause).toBeInstanceOf(Error);
    expect((err.cause as Error).message).toContain('boom in extension');
  });
});
