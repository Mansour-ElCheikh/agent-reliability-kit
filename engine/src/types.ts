/**
 * Shared types for the rules engine.
 * Implements the contract in ADR-0002 + canonical/governance-rule.schema.md.
 */

export type Severity = 'error' | 'warn' | 'audit';
export type EnforcementSurface = 'hook' | 'engine' | 'audit';

export type GovernanceProfile = 'solo' | 'team';

export interface GovernanceRule {
  id: string;
  severity: Severity;
  description: string;
  enforcement: EnforcementSurface[];
  check: string;
  scope?: string;
  status?: 'active' | 'experimental' | 'deprecated';
  spec_version?: number;
  approved_files?: string[];
  exclude_patterns?: string[];
  // ADR-0007 universal-set markers:
  /** Part of the Universal Default Set (informational + ties to the profile ramp). */
  universal?: boolean;
  /** Under profile=team this rule's warn severity ramps to error (the soft-start ramp). */
  ramp_to_error_on_team?: boolean;
  /** Safety rule (e.g. no_secrets): always error; never downgraded by advisory mode or solo profile. */
  safety?: boolean;
  // predicate-specific:
  forbidden_import_patterns?: string[];
  warn_bytes?: number;
  max_bytes?: number;
  file_patterns?: string[];
  /** scope_containment: globs that may not be touched without explicit acknowledgement. */
  protected_paths?: string[];
  /** tasks_min_invariant (ADR-0010): shape-only Min-Invariant cell values to reject. */
  forbidden_invariant_values?: string[];
  /**
   * test_shape_assertions (ADR-0022): force an assertion vocabulary instead of
   * inferring from the file extension. Built-in styles: 'vitest-jest', 'pytest'.
   * Absent: inferred from the extension (.ts/.js to vitest-jest, .py to pytest).
   */
  assertion_style?: string;
}

/**
 * testing-manifest.json shape (the fields the engine reads). ADR-0022 added
 * `testFilePatterns` (multi-framework test-file recognition) and `coLocation`
 * (the source-to-test path template), both optional with framework-neutral
 * defaults so a non-JS/TS project is recognised without hand-config.
 */
export interface TestingManifest {
  version?: number;
  commands?: Record<string, { layer?: string; style?: string; purpose?: string; scope?: string[] }>;
  surfaces?: Record<string, { minLayers?: string[] }>;
  /** Globs that identify a test file. Default: DEFAULT_TEST_FILE_PATTERNS (JS/TS + pytest + Go). */
  testFilePatterns?: string[];
  /** Source-to-test path template for the co-location predicate. Default: '{dir}/{name}.test.{ext}'. */
  coLocation?: { testPath?: string };
}

export interface GovernanceConfig {
  schema_version?: number;
  version?: string;
  project: string;
  /**
   * ADR-0007 coordination/severity profile. `solo` (default): universal rules
   * stay warn, non-blocking. `team`: universal rules ramp warn→error, blocking.
   * Safety rules ignore this. Absent → 'solo' (eased default for new adopters).
   */
  profile?: GovernanceProfile;
  mode?: { default?: 'enforce' | 'advisory' };
  scope?: {
    include?: string[];
    exclude?: string[];
  };
  rules: GovernanceRule[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  filePath: string;
  line?: number;
  message: string;
}

export interface AuditContext {
  repoRoot: string;
  governance: GovernanceConfig;
  /** HEAD commit SHA (or empty string if not in a repo) */
  headCommit: string;
  /** HEAD commit message (full body) */
  headCommitMessage: string;
  /** Files staged or modified in HEAD's diff (for audit + hook); subset of in-scope paths */
  affectedFiles: string[];
  /** All files matching scope.include / scope.exclude in the repo (for predicates that scan everything) */
  allInScopeFiles: string[];
  /**
   * Wall-clock "now" for time-relative predicates (doc_validity expiry, ADR-0025).
   * Optional and injectable so audits stay deterministic under test; production
   * leaves it unset and the predicate falls back to the real clock (`new Date()`).
   */
  now?: Date;
}

export interface PredicateInput {
  filePath: string;
  /** UTF-8 contents of filePath, or empty string for predicates that don't read content */
  fileContent: string;
  rule: GovernanceRule;
  context: AuditContext;
}

export type Predicate = (input: PredicateInput) => Finding[] | Promise<Finding[]>;

/** Ratchet baseline file shape — committed at repo root as .governance-baseline.json. */
export interface RatchetBaseline {
  version: number;
  ratcheted_at: string;
  counts: Record<string, number>;
}

/** Audit run result — written to .scaffold/audit-report.<ts>.<json|toon>. */
export interface AuditReport {
  version: 1;
  ran_at: string;
  project: string;
  scope: { include: string[]; exclude: string[] };
  totals: {
    errors: number;
    warnings: number;
    audit_only: number;
  };
  per_rule_counts: Record<string, number>;
  ratchet: {
    baseline: RatchetBaseline | null;
    diff: Record<string, { baseline: number; current: number; delta: number }>;
    exceeded: boolean;
  };
  findings: Finding[];
}

/** Exit codes used by the engine CLI. */
export const ENGINE_EXIT_OK = 0;
export const ENGINE_EXIT_ERRORS_FOUND = 1;
export const ENGINE_EXIT_RATCHET_EXCEEDED = 2;
export const ENGINE_EXIT_USAGE = 3;
export const ENGINE_EXIT_INTERNAL = 4;
