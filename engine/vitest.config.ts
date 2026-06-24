import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the engine's own suites — NOT the fixture *.test.ts files, which
    // are intentionally-malformed inputs the audit predicates evaluate.
    include: ['test/*.test.ts'],
    exclude: ['test/fixtures/**'],
    // The engine shells out to git; keep tests serial + give them room.
    testTimeout: 20_000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      // Files with no unit-test surface (documented, mirrors the test-existence
      // predicate's exempt set): a re-export barrel, the CLI entrypoint
      // (integration-tested via audit-smoke + emit-against-self in CI, not unit),
      // and a type-only declaration file with no runtime code.
      exclude: ['src/index.ts', 'src/cli.ts', 'src/types.ts'],
      // A reachability FLOOR, not a quality target — set as a ratchet just below
      // the measured level (86.2% lines / 81.7% branches as of 2026-06-23), so it
      // catches regressions (a deleted test, a new unexercised module) without
      // forcing assertion-free "coverage theatre". Raise deliberately, never auto.
      // Test-assertion QUALITY is enforced separately by test_shape_assertions /
      // the Min-Invariant rule (ADR-0010), not by this number.
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 80,
        lines: 85,
      },
    },
  },
});
