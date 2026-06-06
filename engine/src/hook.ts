/**
 * PreToolUse hook backend. Reads a tool-call payload from stdin, evaluates the
 * proposed change against `enforcement: [hook]` rules, exits 0 (allow) or 2
 * (block) with a reason on stderr.
 *
 * Tier 1 (Claude Code, Copilot agent): wired as a PreToolUse hook on Write/Edit.
 * Tier 2/3 (Cursor/Codex/Aider/Continue): the engine's `audit --staged` runs at
 * git pre-commit instead; this hook backend isn't used there. See ADR-0004.
 *
 * Payload shape (Claude Code PreToolUse, tolerant of Copilot's variants):
 *   { tool_name, tool_input: { file_path|filePath, content|new_string } }
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import type { AuditContext, Finding, GovernanceConfig, GovernanceRule } from './types.js';
import { PredicateRegistry } from './predicates.js';
import { resolveEffectiveSeverity } from './audit.js';

interface HookPayload {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    filePath?: string;
    content?: string;
    new_string?: string;
  };
}

export function parseHookPayload(stdin: string): { filePath: string | null; content: string } {
  let payload: HookPayload;
  try {
    payload = JSON.parse(stdin) as HookPayload;
  } catch {
    return { filePath: null, content: '' };
  }
  const ti = payload.tool_input ?? {};
  const filePath = ti.file_path ?? ti.filePath ?? null;
  const content = ti.content ?? ti.new_string ?? '';
  return { filePath, content };
}

function hookRules(governance: GovernanceConfig): GovernanceRule[] {
  return governance.rules.filter(
    (r) => r.status !== 'deprecated' && r.enforcement.includes('hook'),
  );
}

export interface EvaluateHookOptions {
  repoRoot: string;
  governance: GovernanceConfig;
  registry: PredicateRegistry;
  filePath: string;
  content: string;
  headCommitMessage: string;
}

/** Returns blocking findings (severity error) for a single proposed write. */
export async function evaluateHook(opts: EvaluateHookOptions): Promise<Finding[]> {
  const { repoRoot, governance, registry, filePath, content, headCommitMessage } = opts;

  const context: AuditContext = {
    repoRoot,
    governance,
    headCommit: '',
    headCommitMessage,
    affectedFiles: [filePath],
    allInScopeFiles: [filePath],
  };

  const findings: Finding[] = [];
  for (const rule of hookRules(governance)) {
    const scope = rule.scope ?? rule.file_patterns;
    if (scope) {
      const patterns = Array.isArray(scope) ? scope : [scope];
      if (!picomatch(patterns)(filePath)) continue;
    }
    if (rule.exclude_patterns && picomatch(rule.exclude_patterns)(filePath)) continue;

    const raw = await registry.evaluate(rule.check, {
      filePath,
      fileContent: content,
      rule,
      context,
    });
    for (const f of raw) {
      findings.push({ ...f, severity: resolveEffectiveSeverity(f.severity, rule, governance) });
    }
  }
  // Only error-severity findings block a write at hook time. warn/audit are
  // recorded by the engine's audit pass + ratchet, not the write-time gate.
  // Under profile=solo a universal rule stays warn (non-blocking); under
  // profile=team it ramped to error above (blocking); safety rules are
  // always error (block even in solo/advisory).
  return findings.filter((f) => f.severity === 'error');
}

/** Read all of stdin (hook payload). */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** Best-effort HEAD commit message for predicates that read it (decision/roadmap rules). */
export async function bestEffortHeadMessage(repoRoot: string): Promise<string> {
  try {
    const p = path.join(repoRoot, '.git', 'COMMIT_EDITMSG');
    return await fs.readFile(p, 'utf8');
  } catch {
    return '';
  }
}
