#!/usr/bin/env node
/**
 * Cursor emitter — reads canonical/ and writes .cursor/rules/*.mdc + .cursorrules.
 * Ported from emit.py (Python → TS in S6.3a per ADR-0005).
 *
 * Contract: see canonical/emitter-contract.md.
 * Phase-to-globs heuristic: see README.md § "Phase-to-globs heuristic".
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import {
  type CanonicalSpec,
  type ToolCapabilityEntry,
  type EmitOutcome,
  type EmitMode,
  EXIT_OK,
  EXIT_INVOCATION_ERROR,
  EXIT_INPUT_ERROR,
  EXIT_MODE_CONFLICT,
  EXIT_AUTHOR_BUG,
  ManagedSectionError,
  applyManagedSection,
  generatedHeader,
  loadAllCanonical,
  loadToolCapabilities,
  makeNunjucksEnv,
  newOutcome,
  resolveCapabilities,
  validateSkillAnatomy,
  formatAnatomyErrors,
  writeEmitReport,
} from '@reliability-scaffold/emit-lib';

const __filename = fileURLToPath(import.meta.url);

const EMITTER_SLUG = 'emitters/cursor';
const EMITTER_VERSION = '1';
const TOOL = 'cursor';
const TIER = 2;

/** Phase → glob heuristic (per F9 + README.md "Phase-to-globs heuristic"). */
const PHASE_GLOBS: Record<string, string[]> = {
  define: ['dev/epics/*/epic.md', 'dev/epics/*/tasks.md'],
  plan: ['dev/epics/*/plan.md', 'dev/epics/*/tasks.md'],
  review: ['dev/epics/*/review.md', 'src/**', 'tests/**'],
  refactor: ['src/**'],
  audit: [], // invoked-only; degraded to inline-in-steering
  'session-close': [],
  'cross-phase': ['dev/epics/**', 'src/**', 'docs/**'],
};

function globsForSkill(spec: CanonicalSpec): string[] | null {
  const phases = (spec.frontmatter.applicable_phases as string[] | undefined) ?? ['cross-phase'];
  const globs: string[] = [];
  for (const phase of phases) {
    const mapped = PHASE_GLOBS[phase];
    if (mapped === undefined) {
      return null; // unknown phase; emitter author should add to table
    }
    globs.push(...mapped);
  }
  if (globs.length === 0) return null;
  const seen = new Set<string>();
  return globs.filter((g) => {
    if (seen.has(g)) return false;
    seen.add(g);
    return true;
  });
}

interface EmitSkillOptions {
  spec: CanonicalSpec;
  toolCaps: ToolCapabilityEntry;
  env: ReturnType<typeof makeNunjucksEnv>;
  outputRoot: string;
  mode: EmitMode;
  dryRun: boolean;
}

async function emitSkill(opts: EmitSkillOptions): Promise<EmitOutcome> {
  const { spec, toolCaps, env, outputRoot, mode, dryRun } = opts;
  const outcome = newOutcome(spec.path);

  // Capability resolution
  const resolution = resolveCapabilities(spec, toolCaps);
  if (!resolution.canEmit) {
    outcome.status = 'skipped';
    outcome.reason = resolution.skipReason ?? 'unknown';
    return outcome;
  }

  // Glob mapping
  const globs = globsForSkill(spec);
  if (globs === null) {
    // No glob-applicable phase (audit, session-close). Degrade to inline-in-steering.
    outcome.status = 'degraded';
    outcome.outputPath = path.join(outputRoot, '.cursorrules');
    outcome.degradations = [
      ...resolution.degradations,
      ['llm_inline_invocation', 'inline_in_steering'],
    ];
    outcome.reason = 'invocation-only phase; listed in steering file, no .mdc rule emitted';
    return outcome;
  }

  // Render
  const outputPath = path.join(outputRoot, '.cursor', 'rules', `${spec.frontmatter.name}.mdc`);
  const titleLine = spec.body.split('\n', 1)[0] ?? '';
  const title = titleLine.replace(/^#\s*/, '').trim() || spec.frontmatter.name;
  const bodyAfterH1 = spec.body.split('\n').slice(1).join('\n').replace(/^\n+/, '');

  const extraLines = resolution.degradations.length
    ? ['Degradations applied:', ...resolution.degradations.map(([cap, fb]) => `- ${cap} -> ${fb}`)]
    : undefined;

  const headerText = generatedHeader({
    canonicalPath: spec.path,
    emitterName: EMITTER_SLUG,
    emitterVersion: EMITTER_VERSION,
    extraLines,
  });

  const rendered = env.render('skill.mdc.njk', {
    description: spec.frontmatter.description ?? '',
    globs_json: JSON.stringify(globs),
    always_apply: 'false',
    generated_header: headerText,
    has_degradations: resolution.degradations.length > 0,
    degradations: resolution.degradations.map(([cap, fallback]) => ({ cap, fallback })),
    title,
    body: bodyAfterH1,
  });

  if (dryRun) {
    outcome.status = resolution.degradations.length > 0 ? 'degraded' : 'emitted';
    outcome.outputPath = outputPath;
    outcome.degradations = resolution.degradations;
    return outcome;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (mode === 'bootstrap') {
    try {
      await fs.access(outputPath);
      // exists → bail
      process.stderr.write(`ERROR: bootstrap mode but ${outputPath} already exists\n`);
      process.exit(EXIT_MODE_CONFLICT);
    } catch {
      // doesn't exist → OK
    }
  }
  if (mode === 'adopt') {
    try {
      const existing = await fs.readFile(outputPath, 'utf8');
      if (!existing.includes('GENERATED FROM:') || !existing.includes(`EMITTER: ${EMITTER_SLUG}`)) {
        outcome.status = 'skipped';
        outcome.reason = `adopt mode: ${outputPath} exists without GENERATED marker (adopter content preserved)`;
        return outcome;
      }
    } catch {
      // file doesn't exist → first emit; proceed
    }
  }

  await fs.writeFile(outputPath, rendered, 'utf8');
  outcome.status = resolution.degradations.length > 0 ? 'degraded' : 'emitted';
  outcome.outputPath = outputPath;
  outcome.degradations = resolution.degradations;
  return outcome;
}

interface EmitSteeringFileOptions {
  ruleSkills: string[];
  invocationOnlySkills: string[];
  outputRoot: string;
  mode: EmitMode;
  dryRun: boolean;
}

async function emitSteeringFile(opts: EmitSteeringFileOptions): Promise<EmitOutcome> {
  const { ruleSkills, invocationOnlySkills, outputRoot, mode, dryRun } = opts;
  const steeringPath = path.join(outputRoot, '.cursorrules');
  const outcome = newOutcome('canonical/skills/*');

  const headerText = generatedHeader({
    canonicalPath: 'canonical/skills/',
    emitterName: EMITTER_SLUG,
    emitterVersion: EMITTER_VERSION,
  }).replace(/\n+$/, '');

  const managedLines: string[] = [
    headerText,
    '',
    'This project uses the agent-reliability-scaffold canonical specs.',
    'Cursor reads these conventions as ambient guidance + per-rule files.',
    '',
    'Active skills (emitted as Cursor MDC rules):',
    '',
  ];
  for (const name of ruleSkills) {
    managedLines.push(`- \`${name}\` — see \`.cursor/rules/${name}.mdc\``);
  }
  if (invocationOnlySkills.length > 0) {
    managedLines.push('');
    managedLines.push('Invocation-only skills (documented here; not glob-applied):');
    managedLines.push('');
    for (const name of invocationOnlySkills) {
      managedLines.push(`- \`${name}\` — invoke manually when needed; Cursor does not support named-skill dispatch`);
    }
  }
  managedLines.push('');
  managedLines.push('To regenerate after canonical/ changes:');
  managedLines.push('  node emitters/cursor/dist/cli.js --output-root . --mode=adopt');

  const managedContent = managedLines.join('\n');
  let existing = '';
  try {
    existing = await fs.readFile(steeringPath, 'utf8');
  } catch {
    // doesn't exist → ''
  }

  let newContent: string;
  try {
    newContent = applyManagedSection({ existing, managedContent, emitterSlug: EMITTER_SLUG, mode });
  } catch (e) {
    if (e instanceof ManagedSectionError) {
      process.stderr.write(`ERROR: ${e.message}\n`);
      process.exit(e.exitCode);
    }
    throw e;
  }

  if (dryRun) {
    outcome.status = 'emitted';
    outcome.outputPath = steeringPath;
    return outcome;
  }

  await fs.writeFile(steeringPath, newContent, 'utf8');
  outcome.status = 'emitted';
  outcome.outputPath = steeringPath;
  return outcome;
}

async function main(): Promise<number> {
  const program = new Command();
  program
    .name('emit-cursor')
    .description('Emit canonical specs to Cursor format')
    .requiredOption('--output-root <path>', 'Target directory root')
    .requiredOption('--mode <mode>', 'bootstrap | adopt | overwrite')
    .option('--dry-run', 'Print what would be emitted; write nothing', false)
    .option('--canonical-root <path>', 'Canonical source root (default: <scaffold>/canonical/)')
    .option('--tool-capabilities <path>', 'Override tool-capabilities.yaml path (for tests)')
    .parse();

  const opts = program.opts<{
    outputRoot: string;
    mode: EmitMode;
    dryRun: boolean;
    canonicalRoot?: string;
    toolCapabilities?: string;
  }>();

  if (!['bootstrap', 'adopt', 'overwrite'].includes(opts.mode)) {
    process.stderr.write(`ERROR: --mode must be bootstrap|adopt|overwrite (got ${opts.mode})\n`);
    return EXIT_INVOCATION_ERROR;
  }

  // Scaffold root inferred from compiled location: emitters/cursor/dist/cli.js → up 3
  const scaffoldRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
  const canonicalRoot = opts.canonicalRoot
    ? path.resolve(opts.canonicalRoot)
    : path.join(scaffoldRoot, 'canonical');
  const outputRoot = path.resolve(opts.outputRoot);

  try {
    await fs.access(outputRoot);
  } catch {
    process.stderr.write(`ERROR: output-root does not exist: ${outputRoot}\n`);
    return EXIT_INVOCATION_ERROR;
  }

  try {
    await fs.access(canonicalRoot);
  } catch {
    process.stderr.write(`ERROR: canonical root not found: ${canonicalRoot}\n`);
    return EXIT_INPUT_ERROR;
  }

  // tool-capabilities path
  let toolCaps: Record<string, ToolCapabilityEntry>;
  if (opts.toolCapabilities) {
    const yaml = (await import('js-yaml')).default;
    const raw = await fs.readFile(path.resolve(opts.toolCapabilities), 'utf8');
    toolCaps = yaml.load(raw) as Record<string, ToolCapabilityEntry>;
  } else {
    toolCaps = await loadToolCapabilities(canonicalRoot);
  }

  const templateDir = path.resolve(path.dirname(__filename), '..', 'templates');
  const env = makeNunjucksEnv(templateDir);

  const specs = await loadAllCanonical(canonicalRoot);
  const outcomes: EmitOutcome[] = [];
  const ruleSkillNames: string[] = [];
  const invocationOnlyNames: string[] = [];

  // Skills first
  for (const spec of specs) {
    if (spec.kind !== 'skill') continue;
    if (spec.frontmatter.status && spec.frontmatter.status !== 'active') {
      const o = newOutcome(spec.path);
      o.status = 'skipped';
      o.reason = `status=${spec.frontmatter.status}`;
      outcomes.push(o);
      continue;
    }
    if (spec.frontmatter.emit_to && !spec.frontmatter.emit_to.includes(TOOL)) {
      const o = newOutcome(spec.path);
      o.status = 'skipped';
      o.reason = `emit_to restricts to ${JSON.stringify(spec.frontmatter.emit_to)}`;
      outcomes.push(o);
      continue;
    }

    // ADR-0036 anatomy gate
    const anatomyErrors = validateSkillAnatomy(spec);
    if (anatomyErrors.length > 0) {
      process.stderr.write(formatAnatomyErrors(spec, anatomyErrors) + '\n');
      return EXIT_AUTHOR_BUG;
    }

    const toolCapsForTool = toolCaps[TOOL];
    if (!toolCapsForTool) {
      process.stderr.write(`ERROR: tool-capabilities.yaml missing entry for "${TOOL}"\n`);
      return EXIT_INPUT_ERROR;
    }

    const outcome = await emitSkill({ spec, toolCaps: toolCapsForTool, env, outputRoot, mode: opts.mode, dryRun: opts.dryRun });
    outcomes.push(outcome);
    if (outcome.status === 'emitted') {
      ruleSkillNames.push(spec.frontmatter.name);
    } else if (outcome.status === 'degraded') {
      if (outcome.outputPath && outcome.outputPath.endsWith('.mdc')) {
        ruleSkillNames.push(spec.frontmatter.name);
      } else {
        invocationOnlyNames.push(spec.frontmatter.name);
      }
    }
  }

  // Agents — Cursor has no subagent surface; record as skipped
  for (const spec of specs) {
    if (spec.kind !== 'agent') continue;
    const o = newOutcome(spec.path);
    o.status = 'skipped';
    o.reason = 'Cursor has no subagent surface; agents are skipped';
    outcomes.push(o);
  }

  // Steering file (insert at position 0 so it leads in the report)
  const steering = await emitSteeringFile({
    ruleSkills: ruleSkillNames,
    invocationOnlySkills: invocationOnlyNames,
    outputRoot,
    mode: opts.mode,
    dryRun: opts.dryRun,
  });
  outcomes.unshift(steering);

  // Report
  if (!opts.dryRun) {
    const reportPath = await writeEmitReport({
      outputRoot,
      toolSlug: TOOL,
      tier: TIER,
      mode: opts.mode,
      emitterPath: EMITTER_SLUG,
      emitterVersion: EMITTER_VERSION,
      outcomes,
    });
    process.stdout.write(`Emit report: ${reportPath}\n`);
  } else {
    process.stdout.write('DRY RUN — no files written. Outcomes:\n');
    for (const o of outcomes) {
      process.stdout.write(`  [${o.status}] ${path.basename(o.canonicalPath)} → ${o.outputPath}\n`);
    }
  }

  return EXIT_OK;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(err.stack + '\n');
    process.exit(EXIT_AUTHOR_BUG);
  });
