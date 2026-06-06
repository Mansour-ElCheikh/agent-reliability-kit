/**
 * Public API for @reliability-scaffold/engine.
 *
 * Importable by the /scaffold wrapper + adopter tooling. The CLI (cli.ts) is the
 * primary entrypoint; this surface exists for programmatic use.
 *
 * Contract: ADR-0002 + canonical/governance-rule.schema.md.
 * Ratchet:  governance/RATCHET.md.
 * Tiers:    ADR-0004 (hook vs commit-time degradation).
 */

export * from './types.js';
export * from './predicates.js';
export * from './extensions.js';
export * from './ratchet.js';
export * from './audit.js';
export * from './hook.js';
export * from './toon.js';
