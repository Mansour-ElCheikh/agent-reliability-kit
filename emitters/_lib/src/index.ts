/**
 * Public API for @reliability-scaffold/emit-lib.
 * Each per-tool emitter (emitters/<tool>/src/cli.ts) imports from here.
 *
 * Contract: see canonical/emitter-contract.md.
 * ADRs:     0001 (charter), 0003 (canonical spec format), 0004 (three-tier enforcement), 0005 (Node-only stack).
 * Ported:   from emitters/_lib/scaffold_emit.py (Python → TS in S6.3a).
 */

export * from './exit-codes.js';
export * from './canonical.js';
export * from './capabilities.js';
export * from './header.js';
export * from './managed-section.js';
export * from './emit-report.js';
export * from './nunjucks-env.js';
export * from './anatomy.js';
