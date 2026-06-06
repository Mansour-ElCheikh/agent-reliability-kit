#!/usr/bin/env node
/**
 * Worked-example session-event-log writer.
 *
 * ADR-0001 ships shapes + worked examples, not production runtimes. This is the
 * `hook.example.sh` precedent applied to the session-event log: a copyable
 * reference that appends one JSONL record per call, conforming to the contract
 * in `canonical/session-event-log.schema.md`. The `session-harvest` skill reads
 * the log this produces (if a project emits one).
 *
 * A *production* writer is host-specific: wire `logSessionEvent()` into your
 * tool's session lifecycle (a Claude Code SessionEnd / PostToolUse hook, a
 * Cursor wrapper, your own dispatcher). This file shows the append + validation;
 * the lifecycle wiring is yours. A per-emitter wired writer is the v0.2 candidate
 * (ROADMAP.md).
 *
 * Library use:
 *   import { logSessionEvent } from './governance/session-events.writer.example.mjs';
 *   await logSessionEvent({ skill_or_phase: 'review', outcome: 'passed', duration_ms: 4310 });
 *
 * CLI use:
 *   node governance/session-events.writer.example.mjs --skill review --outcome passed --duration-ms 4310
 *
 * Env:
 *   SCAFFOLD_SESSION_LOG  log path (default .scaffold/session-events.jsonl, gitignored)
 *   SCAFFOLD_SESSION_ID   stable id grouping a session's events
 */

import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_LOG = process.env.SCAFFOLD_SESSION_LOG ?? '.scaffold/session-events.jsonl';

/** Valid `outcome` values per the schema. */
export const OUTCOMES = ['passed', 'failed', 'blocked', 'skipped', 'degraded'];

/**
 * Append one event to the session-event log (JSONL, one object per line).
 * Required fields: `skill_or_phase` (non-empty string) and `outcome` (one of
 * OUTCOMES). `ts` and `session_id` are filled if absent. Unknown fields are
 * preserved (the schema is forward-compatible). Returns the written record.
 */
export async function logSessionEvent(event, logPath = DEFAULT_LOG) {
  if (!event || typeof event.skill_or_phase !== 'string' || event.skill_or_phase.length === 0) {
    throw new Error('session-event: skill_or_phase (non-empty string) is required');
  }
  if (!OUTCOMES.includes(event.outcome)) {
    throw new Error(`session-event: outcome must be one of ${OUTCOMES.join(', ')}`);
  }
  const record = {
    ...event,
    ts: event.ts ?? new Date().toISOString(),
    session_id: event.session_id ?? process.env.SCAFFOLD_SESSION_ID ?? 'unknown',
    skill_or_phase: event.skill_or_phase,
    outcome: event.outcome,
  };
  await mkdir(path.dirname(logPath), { recursive: true });
  // One line, newline-terminated. No embedded newlines (would break JSONL).
  await appendFile(logPath, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

/** Parse `--flag value` pairs into an event object (CLI helper). */
function parseArgs(argv) {
  const ev = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '').replace(/-/g, '_');
    let val = argv[i + 1];
    if (key === 'duration_ms' || key === 'context_kb') val = Number(val);
    ev[key === 'skill' ? 'skill_or_phase' : key] = val;
  }
  return ev;
}

// CLI entry point (only runs when invoked directly, not when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  logSessionEvent(parseArgs(process.argv.slice(2)))
    .then((record) => process.stdout.write(JSON.stringify(record) + '\n'))
    .catch((err) => {
      process.stderr.write(`${err.message ?? err}\n`);
      process.exit(1);
    });
}
