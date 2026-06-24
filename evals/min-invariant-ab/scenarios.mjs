/**
 * Eval B fixtures — Min-Invariant A/B false-green slip-through.
 *
 * Each scenario ships a CORRECT and a BROKEN implementation, plus two assertion
 * arms: `shape` (shape-only) and `min` (concrete Min-Invariant). Arms take
 * (expect, value) and use real vitest matchers. `value` is whatever
 * correct()/broken() return (a value, or a function for the validator case).
 *
 * klass:
 *   'shape-preserving' — broken impl returns right shape, wrong content (the
 *      dangerous false-green class Min-Invariant targets).
 *   'shape-changing'   — broken impl returns undefined/wrong type (negative
 *      control: shape-only already catches it).
 *
 * Design + acceptance bar: docs/findings/eval-min-invariant-ab-2026-06.md
 */

export const scenarios = [
  {
    id: 'deadcode-count',
    klass: 'shape-preserving',
    name: 'analyzer returns dead-code findings',
    source: 'RepoNav epic 010 dead-code R21 (strengthened to toBeGreaterThan(0))',
    correct: () => ['unusedHelper', 'deadBranch'],
    broken: () => [], // broken analyzer silently returns empty
    shape: (expect, v) => expect(Array.isArray(v)).toBe(true),
    min: (expect, v) => expect(v.length).toBeGreaterThan(0),
  },
  {
    id: 'exact-sum',
    klass: 'shape-preserving',
    name: 'aggregate sum of [10,20,30]',
    source: 'arithmetic aggregate (returns first element instead of sum)',
    correct: () => 60,
    broken: () => 10,
    shape: (expect, v) => expect(typeof v).toBe('number'),
    min: (expect, v) => expect(v).toBe(60),
  },
  {
    id: 'status-contains',
    klass: 'shape-preserving',
    name: 'status line contains OK',
    source: 'string-builder that drops the status token',
    correct: () => 'build status: OK (6/6)',
    broken: () => 'build status:  (0/6)',
    shape: (expect, v) => expect(typeof v).toBe('string'),
    min: (expect, v) => expect(v).toContain('OK'),
  },
  {
    id: 'named-field-value',
    klass: 'shape-preserving',
    name: 'config carries workspaceRoot value',
    source: 'RepoNav context-stub (key present, value empty)',
    correct: () => ({ workspaceRoot: '/repo', files: 3 }),
    broken: () => ({ workspaceRoot: '', files: 0 }),
    shape: (expect, v) => expect(v).toHaveProperty('workspaceRoot'), // key presence only
    min: (expect, v) => expect(v.workspaceRoot).toBe('/repo'),
  },
  {
    id: 'discriminating-validator',
    klass: 'shape-preserving',
    name: 'isValidName rejects empty input',
    source: 'validator tested only on the happy path',
    correct: () => (x) => x.trim().length > 0,
    broken: () => () => true, // always-true validator
    shape: (expect, fn) => expect(fn('alice')).toBe(true), // happy path passes both
    min: (expect, fn) => expect(fn('')).toBe(false), // discriminating case
  },
  {
    id: 'sorted-order',
    klass: 'shape-preserving',
    name: 'results returned in sorted order',
    source: 'sort step skipped (right elements, wrong order)',
    correct: () => [1, 2, 3],
    broken: () => [3, 1, 2],
    shape: (expect, v) => expect(Array.isArray(v)).toBe(true),
    min: (expect, v) => expect(v).toEqual([1, 2, 3]),
  },
  {
    id: 'nonempty-map',
    klass: 'shape-preserving',
    name: 'rule-count map is populated',
    source: 'governance summary returns empty record',
    correct: () => ({ R2: 2, R4: 1 }),
    broken: () => ({}),
    shape: (expect, v) => expect(v).toBeDefined(),
    min: (expect, v) => expect(Object.keys(v).length).toBeGreaterThan(0),
  },
  {
    id: 'coverage-threshold',
    klass: 'shape-preserving',
    name: 'coverage meets 0.8 threshold',
    source: 'RepoNav R20 audit B4 (coverage >= 0.8 shape-risk assertion)',
    correct: () => 0.86,
    broken: () => 0.0,
    shape: (expect, v) => expect(typeof v).toBe('number'),
    min: (expect, v) => expect(v).toBeGreaterThanOrEqual(0.8),
  },
  {
    id: 'id-format',
    klass: 'shape-preserving',
    name: 'id matches user-<digits>',
    source: 'id builder drops the numeric suffix',
    correct: () => 'user-123',
    broken: () => 'user-',
    shape: (expect, v) => expect(v).toBeTruthy(),
    min: (expect, v) => expect(v).toMatch(/^user-\d+$/),
  },
  {
    id: 'shape-changing-control',
    klass: 'shape-changing',
    name: 'NEGATIVE CONTROL: broken returns undefined',
    source: 'control — shape-only should ALSO catch this',
    correct: () => ['x'],
    broken: () => undefined,
    shape: (expect, v) => expect(Array.isArray(v)).toBe(true),
    min: (expect, v) => expect(Array.isArray(v) ? v.length : 0).toBeGreaterThan(0),
  },
];
