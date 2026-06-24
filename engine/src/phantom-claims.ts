/**
 * No-phantom-claims meta-check (ADR-0015 / battle-test honesty pass).
 *
 * Guards the kit's OWN integrity: every predicate or rule a canonical skill/agent cites BY
 * NAME as an enforcement mechanism must actually exist. This closes the CITATION-DRIFT slice
 * of the phantom-enforcement class — e.g. a predicate/rule renamed in the engine but still
 * cited under its old name in skill prose (the ADR-0010 rename was exactly this risk).
 *
 * Honest scope (NOT oversold — an overselling meta-check would itself be a phantom):
 *   - CATCHES: a skill/agent that names a predicate/rule that does not exist anywhere shipped.
 *   - DOES NOT catch the other phantom-enforcement flavors, each guarded elsewhere:
 *       A1 template-shape  -> the emitter anatomy test
 *       A2 predicate-logic -> the predicate unit tests (predicates.test.ts)
 *       B1 hook-emission   -> the emitter golden self-test (.claude/settings.json)
 *       A4 enablement      -> the gate's honest advisory-count framing + conventions/ship-gate.md
 *
 * Pure functions only; the live guard (engine/test/phantom-claims.test.ts) feeds them the real
 * canonical/ files and the shipped governance.yaml.example.
 */

/** A predicate/rule name cited in an enforcement context in markdown prose. */
export interface Citation {
  name: string;
  kind: 'predicate' | 'rule';
}

const IDENT = '([A-Za-z_][A-Za-z0-9_]*)';

// Tight enforcement-context patterns ONLY. A bare `x` (e.g. "the `build` skill", "run `npm
// test`") is deliberately NOT a citation — only predicate/rule-context backticks count.
const PREDICATE_PATTERNS: RegExp[] = [
  new RegExp(`\\bpredicate\\s+\`${IDENT}\``, 'gi'),
  new RegExp(`\`${IDENT}\`\\s+(?:engine\\s+)?predicate`, 'gi'),
];
const RULE_PATTERNS: RegExp[] = [
  new RegExp(`\\brule\\s+\`${IDENT}\``, 'gi'),
  new RegExp(`\`${IDENT}\`\\s+rule\\b`, 'gi'),
  new RegExp(`\\bgoverned by(?:\\s+rule)?\\s+\`${IDENT}\``, 'gi'),
  new RegExp(`\\bviolates\\s+\`${IDENT}\``, 'gi'),
  new RegExp(`\\bflagged by(?:\\s+the)?\\s+\`${IDENT}\``, 'gi'),
];

/**
 * Extract every enforcement-context predicate/rule citation from markdown, deduped by
 * kind+name (overlapping patterns — e.g. "governed by rule `x`" matches both the "governed
 * by" and the "rule" forms — must not double-count). Pure.
 */
export function extractCitations(markdown: string): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  const scan = (patterns: RegExp[], kind: Citation['kind']): void => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(markdown)) !== null) {
        const key = `${kind}:${m[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: m[1], kind });
      }
    }
  };
  scan(PREDICATE_PATTERNS, 'predicate');
  scan(RULE_PATTERNS, 'rule');
  return out;
}

/**
 * Citations whose name resolves to NO known predicate or rule id = phantoms. Pure.
 * `knownPredicates` is definitive (BUILTIN_PREDICATES). `knownRuleIds` is harvested from the
 * shipped governance.yaml.example (including opt-in / commented ids). A predicate-context
 * citation must name a real predicate; a rule-context citation must name a known rule id OR a
 * real predicate (skills sometimes name the predicate directly in a rule context).
 */
export function phantomCitations(
  markdown: string,
  knownPredicates: Set<string>,
  knownRuleIds: Set<string>,
): Citation[] {
  return extractCitations(markdown).filter((c) => {
    if (c.kind === 'predicate') return !knownPredicates.has(c.name);
    return !knownRuleIds.has(c.name) && !knownPredicates.has(c.name);
  });
}

/**
 * Harvest rule ids from a governance.yaml text, INCLUDING opt-in rules shipped commented-out
 * (`# - id: x`) — those are real, shipped-but-advisory rules a skill may legitimately cite.
 * Pure.
 */
export function harvestRuleIds(governanceYaml: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(`^\\s*#?\\s*-?\\s*id:\\s*["']?${IDENT}`, 'gim');
  let m: RegExpExecArray | null;
  while ((m = re.exec(governanceYaml)) !== null) ids.push(m[1]);
  return ids;
}
