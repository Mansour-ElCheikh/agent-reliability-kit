/**
 * Predicate registry — the built-in predicates plus a registry for
 * adopter-extension predicates loaded from engine/extensions/.
 *
 * Each predicate takes (PredicateInput) and returns Finding[]. Predicates are
 * pure functions of their inputs (the AuditContext provides any global state
 * like HEAD commit message + affected files).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import type { Finding, Predicate, PredicateInput, TestingManifest } from './types.js';

// ───────────────────────────────────────────────────────────────────────────
// Shared test-file resolution (ADR-0022 deweld — manifest-driven, multi-framework)
// ───────────────────────────────────────────────────────────────────────────

/** Globs that identify a test file when the manifest declares none. JS/TS + pytest + Go. */
const DEFAULT_TEST_FILE_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/test_*.py',
  '**/*_test.py',
  '**/*_test.go',
];

/** Source→test path template when the manifest declares no co-location strategy. */
const DEFAULT_COLOCATION_TEST_PATH = '{dir}/{name}.test.{ext}';

async function loadTestingManifest(repoRoot: string | undefined): Promise<TestingManifest | null> {
  if (!repoRoot) return null;
  try {
    const raw = await fs.readFile(path.join(repoRoot, 'testing-manifest.json'), 'utf8');
    return JSON.parse(raw) as TestingManifest;
  } catch {
    return null;
  }
}

function testFilePatterns(manifest: TestingManifest | null): string[] {
  return manifest?.testFilePatterns?.length
    ? manifest.testFilePatterns
    : DEFAULT_TEST_FILE_PATTERNS;
}

function isTestFile(filePath: string, patterns: string[]): boolean {
  return patterns.some((p) => picomatch(p)(filePath));
}

/** Fill a co-location template ({dir}/{name}.test.{ext}) for a source file path. */
function coLocatedTestPath(filePath: string, template: string): string {
  const extWithDot = path.extname(filePath);
  const ext = extWithDot.replace(/^\./, '');
  const dir = path.dirname(filePath);
  const name = path.basename(filePath, extWithDot);
  const rel = template.replace('{dir}', dir).replace('{name}', name).replace('{ext}', ext);
  return path.normalize(rel);
}

/** R1 — commits touching public surfaces should reference a roadmap item or ADR. */
export const roadmap_reference_in_commit_message: Predicate = (input) => {
  const { rule, context, filePath } = input;
  // Audit-time only: check HEAD commit message once per rule, not per file.
  // Use the first affected file as a sentinel so we don't emit one finding per file.
  if (context.affectedFiles.length === 0 || filePath !== context.affectedFiles[0]) {
    return [];
  }
  const msg = context.headCommitMessage;
  if (/(roadmap:|Refs:\s*\w|ADR-\d{4})/i.test(msg)) return [];
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath: 'HEAD',
      message: `commit message lacks 'roadmap:' / 'Refs:' / 'ADR-NNNN' reference (matches against files in scope: ${rule.scope ?? '**'})`,
    },
  ];
};

/**
 * R2 — a source file requires a test discoverable from the manifest's
 * co-location template. ADR-0022: the test-file recognition and the source→test
 * path template both come from testing-manifest.json, defaulting to the JS/TS
 * `.test.<ext>` sibling layout so existing projects are unchanged.
 */
export const source_file_has_co_located_test: Predicate = async (input) => {
  const { rule, filePath, context } = input;
  const manifest = await loadTestingManifest(context?.repoRoot);
  // A test file does not itself need a co-located test.
  if (isTestFile(filePath, testFilePatterns(manifest))) return [];
  if (rule.exclude_patterns) {
    for (const pat of rule.exclude_patterns) {
      if (picomatch(pat)(filePath)) return [];
    }
  }
  const template = manifest?.coLocation?.testPath ?? DEFAULT_COLOCATION_TEST_PATH;
  const testPath = coLocatedTestPath(filePath, template);
  const absPath = path.join(context.repoRoot, testPath);
  try {
    await fs.access(absPath);
    return [];
  } catch {
    return [
      {
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        message: `no co-located test file found at ${testPath}`,
      },
    ];
  }
};

/**
 * R3 — test files must live in directories declared in testing-manifest.json.
 * ADR-0022: a "test file" is recognised by the manifest's `testFilePatterns`
 * (default: JS/TS + pytest + Go), so a `test_*.py` file is no longer invisible.
 */
export const test_file_in_manifest_directory: Predicate = async (input) => {
  const { rule, filePath, context } = input;
  const manifest = await loadTestingManifest(context?.repoRoot);
  if (!isTestFile(filePath, testFilePatterns(manifest))) return [];
  if (manifest === null) {
    return [
      {
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        message: 'testing-manifest.json not found; cannot verify test layout',
      },
    ];
  }
  const declaredScopes: string[] = [];
  for (const cmd of Object.values(manifest?.commands ?? {})) {
    if (cmd.scope) declaredScopes.push(...cmd.scope);
  }
  for (const pat of declaredScopes) {
    if (picomatch(pat)(filePath)) return [];
  }
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath,
      message: `test file outside any declared layer scope (declared scopes: ${declaredScopes.join(', ') || 'none'})`,
    },
  ];
};

/**
 * source_file_has_test — layout-agnostic test existence. A source file in scope
 * must have a test discoverable BY NAME among the in-scope test files, wherever
 * they live: co-located (foo.ts + foo.test.ts), a central dir (engine/src/gate.ts
 * + engine/test/gate.test.ts), pytest (test_foo.py), or Go (foo_test.go). This is
 * the case source_file_has_co_located_test cannot express: it fills a
 * {dir}/{name}.test template anchored to the SOURCE directory, so it can never
 * match a test that lives under a different root (the central layout most TS/JS
 * projects actually use). Pairs with test_file_in_manifest_directory (which checks
 * test LOCATION): together they give "every source has a test" + "tests live where
 * declared". ADR-0026.
 */
export const source_file_has_test: Predicate = async (input) => {
  const { rule, filePath, context } = input;
  const manifest = await loadTestingManifest(context?.repoRoot);
  const patterns = testFilePatterns(manifest);
  // A test file does not itself need a test.
  if (isTestFile(filePath, patterns)) return [];
  if (rule.exclude_patterns) {
    for (const pat of rule.exclude_patterns) if (picomatch(pat)(filePath)) return [];
  }
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext).toLowerCase();
  const found = (context.allInScopeFiles ?? []).some((f) => {
    if (f === filePath) return false;
    if (!isTestFile(f, patterns)) return false;
    const fb = path.basename(f).toLowerCase();
    return (
      fb.startsWith(`${base}.`) || // gate.test.ts / gate.spec.ts (co-located or central)
      fb === `test_${base}${ext}`.toLowerCase() || // test_gate.py (pytest)
      fb.startsWith(`${base}_test.`) // gate_test.go (Go)
    );
  });
  if (found) return [];
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath,
      message: `no test found for this source file; expected an in-scope test named like ${base}.test${ext} / test_${base}${ext} / ${base}_test.<ext> (co-located or in a central test dir)`,
    },
  ];
};

/** R4 — platform-specific imports allowed only in approved boundary files. */
export const boundary_imports: Predicate = (input) => {
  const { rule, filePath, fileContent } = input;
  const forbidden = rule.forbidden_import_patterns ?? [];
  const approved = rule.approved_files ?? [];
  if (approved.includes(filePath)) return [];
  if (rule.exclude_patterns) {
    for (const pat of rule.exclude_patterns) {
      if (picomatch(pat)(filePath)) return [];
    }
  }
  const findings: Finding[] = [];
  const lines = fileContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const importMatch = line.match(/(?:from\s+['"]|require\s*\(\s*['"])([^'"]+)['"]/);
    if (!importMatch) continue;
    const importPath = importMatch[1];
    for (const pattern of forbidden) {
      if (new RegExp(pattern).test(importPath)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          filePath,
          line: i + 1,
          message: `forbidden import "${importPath}" in non-approved file (pattern: ${pattern})`,
        });
      }
    }
  }
  return findings;
};

/** R5 — decision-language commits should accompany a new ADR file. */
export const decision_keyword_without_adr: Predicate = (input) => {
  const { rule, context, filePath } = input;
  if (context.affectedFiles.length === 0 || filePath !== context.affectedFiles[0]) {
    return [];
  }
  const msg = context.headCommitMessage;
  if (!/\b(decided|chose|going with|opted for|picked)\b/i.test(msg)) return [];
  const hasNewAdr = context.affectedFiles.some((f) =>
    /^docs\/decisions\/\d{4}-[\w-]+\.md$/.test(f),
  );
  if (hasNewAdr) return [];
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath: 'HEAD',
      message: `commit message uses decision language but no new ADR was added under docs/decisions/`,
    },
  ];
};

/** R26 — SKILL.md size soft warn (per ADR-0020). */
export const prompt_size_warn: Predicate = (input) => {
  const { rule, filePath, fileContent } = input;
  const warnBytes = rule.warn_bytes ?? 16_000;
  const maxBytes = rule.max_bytes ?? 32_000;
  const bytes = Buffer.byteLength(fileContent, 'utf8');
  if (bytes <= warnBytes) return [];
  if (bytes >= maxBytes) {
    return [
      {
        ruleId: rule.id,
        // promote to error when over hard cap
        severity: 'error',
        filePath,
        message: `${bytes} bytes exceeds hard cap (${maxBytes}); split this skill into siblings or extract reference files`,
      },
    ];
  }
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath,
      message: `${bytes} bytes exceeds soft warn (${warnBytes}); consider splitting before it grows further`,
    },
  ];
};

// ───────────────────────────────────────────────────────────────────────────
// ADR-0007 Universal Default Set — net-new predicates
// ───────────────────────────────────────────────────────────────────────────

const SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'private key block' },
  { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, label: 'Slack token' },
  { re: /\bghp_[0-9A-Za-z]{36}\b/, label: 'GitHub PAT' },
  {
    // keyword may be embedded in a longer identifier (aws_secret_key,
    // AWS_SECRET_ACCESS_KEY, clientSecret) — no leading \b, trailing \w* —
    // the strong signal is the quoted 12+ non-space value + placeholder guard.
    re: /(?:secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\w*\s*[:=]\s*['"]([^'"\s]{12,})['"]/i,
    label: 'assigned secret',
  },
];
// Values that are obviously not real secrets (docs/examples/tests).
const PLACEHOLDER =
  /(your[_-]?|example|placeholder|changeme|x{4,}|<[^>]+>|\.\.\.|dummy|fake|sample|redacted|\$\{|process\.env)/i;

/**
 * no_secrets — high-confidence credential leak detection. Safety rule:
 * ships severity:error and `safety:true` (never downgraded by advisory/solo).
 * Conservative by design — placeholder/example values are excluded to keep
 * the false-positive rate near zero (a noisy safety rule gets disabled).
 */
export const no_secrets: Predicate = (input) => {
  const { rule, filePath, fileContent } = input;
  if (rule.exclude_patterns) {
    for (const pat of rule.exclude_patterns) if (picomatch(pat)(filePath)) return [];
  }
  const findings: Finding[] = [];
  const lines = fileContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { re, label } of SECRET_PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      const value = m[2] ?? m[0];
      if (PLACEHOLDER.test(value)) continue;
      findings.push({
        ruleId: rule.id,
        severity: 'error',
        filePath,
        line: i + 1,
        message: `possible ${label} committed; remove it and rotate the credential (safety rule, never advisory)`,
      });
      break; // one finding per line is enough
    }
  }
  return findings;
};

/**
 * scope_containment — touching a declared protected path is a finding. The
 * universal instance of "change only what you were asked to". `protected_paths`
 * globs are adopter-configurable (defaults guard ADRs + the governance config
 * + the ratchet baseline from silent drift).
 */
export const scope_containment: Predicate = (input) => {
  const { rule, filePath } = input;
  const protectedPaths = rule.protected_paths ?? [];
  if (protectedPaths.length === 0) return [];
  if (!picomatch(protectedPaths)(filePath)) return [];
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath,
      message: `protected path modified (matches ${protectedPaths.join(', ')}); requires an explicit out-of-scope acknowledgement or ADR`,
    },
  ];
};

/**
 * doc_validity — planning / decision documents in scope must carry the
 * validity frontmatter contract (validity + as_of + an expiry). The universal
 * instance of "a plan that can't say whether it's still true misleads the
 * next session" (the document-validity discipline this kit dogfoods).
 */
export const doc_validity: Predicate = (input) => {
  const { rule, filePath, fileContent } = input;
  const fm = fileContent.match(/^---\n([\s\S]*?)\n---/);
  const missing: string[] = [];
  if (!fm) {
    return [
      {
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        message:
          'no validity frontmatter; planning/decision docs need validity + as_of + an expiry',
      },
    ];
  }
  const block = fm[1];
  if (!/^validity:\s*\S/m.test(block)) missing.push('validity');
  if (!/^as_of:\s*\S/m.test(block)) missing.push('as_of');
  if (!/^(expires_after_days|expires):\s*\S/m.test(block))
    missing.push('expires_after_days|expires');
  if (missing.length > 0) {
    return [
      {
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        message: `validity frontmatter missing key(s): ${missing.join(', ')}`,
      },
    ];
  }

  // ADR-0025: the contract is satisfied, so compute whether the window has
  // elapsed. Staleness is advisory (always `warn`), distinct from the
  // missing-contract finding (which uses `rule.severity`): the doc followed the
  // discipline; time simply passed. Unparseable dates are skipped rather than
  // flagged, to keep the false-positive rate at zero (the same conservative
  // posture as the CI tool-capabilities staleness check). The clock is
  // injectable via context.now for deterministic audits, defaulting to real time.
  const asOf = block.match(/^as_of:\s*(\S+)/m)?.[1];
  const expiresAt = block.match(/^expires:\s*(\S+)/m)?.[1];
  const expiresAfterDays = block.match(/^expires_after_days:\s*(\d+)/m)?.[1];
  let expiryMs: number | null = null;
  if (expiresAt) {
    const t = Date.parse(expiresAt);
    if (!Number.isNaN(t)) expiryMs = t;
  } else if (asOf && expiresAfterDays) {
    const asOfMs = Date.parse(asOf);
    if (!Number.isNaN(asOfMs)) expiryMs = asOfMs + Number(expiresAfterDays) * 86_400_000;
  }
  const now = input.context.now ?? new Date();
  if (expiryMs !== null && now.getTime() > expiryMs) {
    const expiredOn = new Date(expiryMs).toISOString().slice(0, 10);
    return [
      {
        ruleId: rule.id,
        severity: 'warn',
        filePath,
        message: `validity expired (as_of ${asOf ?? '?'}; window closed ${expiredOn}); refresh as_of or extend the expiry`,
      },
    ];
  }
  return [];
};

// ───────────────────────────────────────────────────────────────────────────
// ADR-0010 Min-Invariant binding — restores the RepoNav R21 / R20 governance
// ids that were dropped during extraction. The skill rule (plan/build/review)
// and the mechanical check now share an id, so Min-Invariant is a governed
// rule, not a floating convention.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Shape-only values that indicate a vacuous Min-Invariant. A test asserting
 * one of these passes against empty / wrong-shape data — the false green this
 * rule exists to catch. (Faithful to RepoNav R21's FORBIDDEN_INVARIANT_VALUES.)
 */
const DEFAULT_FORBIDDEN_INVARIANT_VALUES = [
  'array',
  'object',
  'defined',
  'not empty',
  'truthy',
  'valid json',
  'exists',
  'non-empty',
  'present',
];

/**
 * min_invariant_per_task (check: tasks_min_invariant) — R21 analogue. Every
 * task row in a tasks.md table must carry a concrete Min-Invariant (a count,
 * threshold, named fact, or file path), never an empty cell or a shape word.
 * Enforced at Plan time by the `plan` skill; audited here for drift.
 */
export const tasks_min_invariant: Predicate = (input) => {
  const { rule, filePath, fileContent } = input;
  const forbidden = (rule.forbidden_invariant_values ?? DEFAULT_FORBIDDEN_INVARIANT_VALUES).map(
    (s) => s.toLowerCase().trim(),
  );
  const findings: Finding[] = [];
  const lines = fileContent.split('\n');
  let minCol = -1;
  let state: 'outside' | 'scanning' | 'skip' = 'outside';

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].trim();
    if (!line.startsWith('|')) {
      state = 'outside';
      minCol = -1;
      continue;
    }
    const raw = line.split('|');
    const cols = raw.slice(1, raw.length - 1).map((c) => c.trim());
    const isSeparator = cols.length > 0 && cols.every((c) => /^[-:]+$/.test(c));

    if (state === 'outside') {
      // The first row of a table block is its header; decide how to treat the table.
      if (isSeparator) {
        state = 'skip';
        continue;
      }
      const minIdx = cols.findIndex((c) => /min[\s-]?invariant/i.test(c));
      if (minIdx >= 0) {
        state = 'scanning';
        minCol = minIdx;
        continue;
      }
      // A TASK table (has a "Task" column) with NO Min-Invariant column is the more likely
      // adopter error than an empty cell - flag the absent column itself, not just bad cells.
      const taskIdx = cols.findIndex((c) => /\btask\b/i.test(c));
      if (taskIdx >= 0) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          filePath,
          line: ln + 1,
          message: `task table is missing the Min-Invariant column (header: "${cols.join(' | ')}"); add a Min-Invariant column carrying a concrete fact per task row`,
        });
      }
      // Either a flagged task table or a non-task table: skip its body rows either way.
      state = 'skip';
      continue;
    }

    if (state === 'skip') continue;

    // state === 'scanning': the Min-Invariant column exists; check each row's cell.
    if (isSeparator) continue;
    // A row narrower than the column index is malformed for this table; skip.
    if (cols.length <= minCol) continue;

    const value = (cols[minCol] ?? '').trim();
    if (!value || value === '-' || value.toLowerCase() === 'n/a') {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        line: ln + 1,
        message: `task row has an empty Min-Invariant; specify a concrete threshold, count, named fact, or file path`,
      });
      continue;
    }

    const normalised = value
      .toLowerCase()
      .replace(/^['"`]|['"`]$/g, '')
      .trim();
    if (forbidden.includes(normalised)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        line: ln + 1,
        message: `shape-only Min-Invariant "${value}"; use a concrete value (e.g. "> 0", "=== 3", "contains 'workspaceRoot'")`,
      });
    }
  }
  return findings;
};

// ── Assertion vocabularies (ADR-0022: style inferred from extension) ─────────

/** vitest/jest — shape-only matchers that don't validate a domain invariant. */
const VITEST_SHAPE_ONLY = [
  /Array\.isArray\(/,
  /\.toBeDefined\(\)/,
  /\.toHaveProperty\(/,
  /\.toBeTruthy\(\)/,
  /\.not\.toBeNull\(\)/,
];
/** vitest/jest — matchers that validate a concrete value. */
const VITEST_DOMAIN_INVARIANT = [
  /\.toBeGreaterThan(?:OrEqual)?\(/,
  /\.toBeLessThan(?:OrEqual)?\(/,
  /\.toEqual\([^)]+\)/,
  /\.toStrictEqual\(/,
  /\.toBe\((?!true\)|false\)|null\)|undefined\))[^)]+\)/,
  /\.toContain(?:Equal)?\(/,
  /\.toMatchObject\(/,
  /\.toMatch\(/,
  /\.toHaveLength\(\d+\)/,
];
/** pytest — vacuous truthiness / presence-only assertions. Conservative (low FP). */
const PYTEST_SHAPE_ONLY = [
  /\bassert\s+[\w.]+(?:\([^)]*\))?\s+is\s+not\s+None\b/,
  /\bassert\s+[\w.]+(?:\([^)]*\))?\s+is\s+None\b/,
  /\bassert\s+isinstance\s*\(/,
  /^\s*assert\s+[\w.]+\s*(?:#.*)?$/m, // bare `assert x` / `assert obj.attr`
  /^\s*assert\s+[\w.]+\([^)]*\)\s*(?:#.*)?$/m, // bare `assert foo()`
];
/** pytest — assertions that pin a concrete value, bound, membership, or error. */
const PYTEST_DOMAIN_INVARIANT = [
  /\bassert\s+.+[=!]=.+/,
  /\bassert\s+.+[<>]=?\s*\S+/,
  /\bpytest\.raises\s*\(/,
  /\bassert\s+.+\bin\b\s*[[({].+[\])}]/,
  /\bassert\s+.+\bnot\s+in\b/,
];

interface AssertionStyleDef {
  /** Split a test file into { title, body } blocks, one per test case. */
  splitBlocks: (content: string) => { title: string; body: string }[];
  /** Does a block contain any assertion worth judging? */
  hasAssertion: (body: string) => boolean;
  shapeOnly: RegExp[];
  domainInvariant: RegExp[];
}

const VITEST_JEST_STYLE: AssertionStyleDef = {
  // Each block runs from one it()/test( delimiter to just before the next.
  splitBlocks(content) {
    const parts = content.split(/\b(?:it|test)\s*\(/);
    const blocks: { title: string; body: string }[] = [];
    for (let i = 1; i < parts.length; i++) {
      const body = parts[i];
      const m = body.match(/^\s*['"`](.*?)['"`]/);
      blocks.push({ title: m?.[1] ?? 'unnamed', body });
    }
    return blocks;
  },
  hasAssertion: (b) => /\bexpect\s*\(/.test(b),
  shapeOnly: VITEST_SHAPE_ONLY,
  domainInvariant: VITEST_DOMAIN_INVARIANT,
};

const PYTEST_STYLE: AssertionStyleDef = {
  // Each block runs from one `def test...(` to just before the next.
  splitBlocks(content) {
    const re = /(?:^|\n)[ \t]*def[ \t]+(test\w*)[ \t]*\([^)]*\)[ \t]*:/g;
    const ms = [...content.matchAll(re)];
    const blocks: { title: string; body: string }[] = [];
    for (let i = 0; i < ms.length; i++) {
      const start = ms[i].index ?? 0;
      const end = i + 1 < ms.length ? (ms[i + 1].index ?? content.length) : content.length;
      blocks.push({ title: ms[i][1], body: content.slice(start, end) });
    }
    return blocks;
  },
  hasAssertion: (b) => /\bassert\b|\bpytest\.raises\b|\bself\.assert\w+\s*\(/.test(b),
  shapeOnly: PYTEST_SHAPE_ONLY,
  domainInvariant: PYTEST_DOMAIN_INVARIANT,
};

const ASSERTION_STYLES: Record<string, AssertionStyleDef> = {
  'vitest-jest': VITEST_JEST_STYLE,
  pytest: PYTEST_STYLE,
};

/** Infer the assertion vocabulary from a test file's extension. */
function inferAssertionStyle(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'vitest-jest';
  if (ext === '.py') return 'pytest';
  return null;
}

/**
 * test_invariants (check: test_shape_assertions) — R20 analogue. A test block
 * that asserts but carries only shape-only assertions (presence / truthiness /
 * type) with no concrete domain invariant is a false-green risk. The assertion
 * vocabulary is chosen per file: vitest/jest for .ts/.js, pytest for .py, or an
 * explicit `rule.assertion_style` override (ADR-0022) — an unrecognised language
 * is skipped rather than mis-judged. Conservative by design (fires only when a
 * block asserts AND every assertion is shape-only) to keep the FP rate low.
 * Opt-in / advisory; scope it via `scope` / `file_patterns` to the test dirs
 * where false greens actually bite.
 */
export const test_shape_assertions: Predicate = (input) => {
  const { rule, filePath, fileContent } = input;
  const styleKey = rule.assertion_style ?? inferAssertionStyle(filePath);
  const style = styleKey ? ASSERTION_STYLES[styleKey] : undefined;
  if (!style) return []; // no vocabulary for this language → cannot judge
  const findings: Finding[] = [];
  for (const { title, body } of style.splitBlocks(fileContent)) {
    if (!style.hasAssertion(body)) continue; // no assertions → nothing to judge
    const hasShapeOnly = style.shapeOnly.some((re) => re.test(body));
    if (!hasShapeOnly) continue;
    const hasDomainInvariant = style.domainInvariant.some((re) => re.test(body));
    if (hasDomainInvariant) continue;
    findings.push({
      ruleId: rule.id,
      severity: rule.severity,
      filePath,
      message: `test "${title}" has only shape-only assertions; add a concrete domain invariant (a value, count, threshold, or expected error)`,
    });
  }
  return findings;
};

/**
 * userfacing_integration_layer (battle-test gate-bias / ADR-0016) — a SELF-SCOPING check:
 * if the repo has user-facing route/page files but the testing-manifest declares no
 * integration/e2e layer, the ship gate boots none of them, so route-composition /
 * realm-isolation bugs ship green (the WC `/share` 404). Fires ONLY when route files exist,
 * so deterministic-core projects (CLIs, libraries, analyzers like RepoNav) with no user-facing
 * surface are exempt — the gate-bias finding's own boundary. It gates that an integration layer
 * is DECLARED (so the gate runs it); it never tries to gate UX/taste (no deterministic invariant).
 */
export const userfacing_integration_layer: Predicate = (input) => {
  const { rule, filePath, fileContent, context } = input;
  if (!/(^|\/)testing-manifest\.json$/.test(filePath)) return []; // evaluate only the manifest
  const globs =
    rule.file_patterns && rule.file_patterns.length
      ? rule.file_patterns
      : [
          'app/**/route.{ts,js,tsx}',
          'app/**/page.{tsx,jsx,js}',
          'src/app/**/route.{ts,js,tsx}',
          'src/app/**/page.{tsx,jsx,js}',
          'pages/**/*.{tsx,jsx}',
          'pages/api/**/*.{ts,js}',
        ];
  const isRoute = picomatch(globs);
  const routeFiles = (context.allInScopeFiles || []).filter((f) => isRoute(f));
  if (routeFiles.length === 0) return []; // no user-facing surface — analyzers/CLIs/libs are exempt

  let layers: string[] = [];
  try {
    const manifest = JSON.parse(fileContent) as { commands?: Record<string, { layer?: string }> };
    layers = Object.values(manifest.commands || {})
      .map((c) => c && c.layer)
      .filter((l): l is string => typeof l === 'string');
  } catch {
    return []; // an unparseable manifest is a different rule's concern
  }
  const integration = new Set(['integration', 'e2e']);
  if (layers.some((l) => integration.has(l))) return [];

  const eg = routeFiles.slice(0, 2).join(', ');
  return [
    {
      ruleId: rule.id,
      severity: rule.severity,
      filePath,
      message: `${routeFiles.length} user-facing route/page file(s) exist (e.g. ${eg}) but testing-manifest declares no integration/e2e layer — the ship gate boots none of them, so route-composition / realm-isolation bugs ship green. Declare a userFacing surface with an integration or e2e layer (conventions/test-layers.md).`,
    },
  ];
};

// ───────────────────────────────────────────────────────────────────────────
// Registry
// ───────────────────────────────────────────────────────────────────────────

export const BUILTIN_PREDICATES: Record<string, Predicate> = {
  roadmap_reference_in_commit_message,
  source_file_has_co_located_test,
  source_file_has_test,
  test_file_in_manifest_directory,
  boundary_imports,
  decision_keyword_without_adr,
  prompt_size_warn,
  no_secrets,
  scope_containment,
  doc_validity,
  tasks_min_invariant,
  test_shape_assertions,
  userfacing_integration_layer,
};

export class PredicateRegistry {
  private predicates: Map<string, Predicate>;

  constructor() {
    this.predicates = new Map(Object.entries(BUILTIN_PREDICATES));
  }

  register(name: string, predicate: Predicate): void {
    this.predicates.set(name, predicate);
  }

  get(name: string): Predicate | undefined {
    return this.predicates.get(name);
  }

  list(): string[] {
    return [...this.predicates.keys()].sort();
  }

  async evaluate(name: string, input: PredicateInput): Promise<Finding[]> {
    const predicate = this.get(name);
    if (!predicate) {
      throw new Error(`predicate not registered: ${name}`);
    }
    const result = await predicate(input);
    return result;
  }
}
