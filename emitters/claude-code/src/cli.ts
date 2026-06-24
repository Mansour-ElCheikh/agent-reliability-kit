#!/usr/bin/env node
/**
 * Claude Code emitter — reads canonical/ and writes:
 *   .claude/skills/<name>/SKILL.md   (directory-per-skill)
 *   .claude/agents/<name>.md         (single file per agent)
 *   CLAUDE.md                        (scaffold-managed steering section)
 *
 * Closes F8: the hand-maintained skills/ + agents/ at scaffold root are
 * deleted; this emitter regenerates the Claude Code surface from canonical/.
 *
 * Frontmatter projection per design-review v2 L2 (skills) + L4 (agents).
 * Contract: canonical/emitter-contract.md.
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
} from '@reliability-kit/emit-lib';

const __filename = fileURLToPath(import.meta.url);

const EMITTER_SLUG = 'emitters/claude-code';
const EMITTER_VERSION = '1';
const TOOL = 'claude-code';
const TIER = 1;

/** model_preference → Claude Code model id (design-review v2 L4). Bump here when tiers ship. */
const MODEL_TABLE: Record<string, string> = {
  small: 'claude-haiku-4-5-20251001',
  medium: 'claude-sonnet-4-6',
  large: 'claude-opus-4-7',
};

/** L2: fold canonical description + trigger_phrases into one CC description. */
function projectSkillDescription(spec: CanonicalSpec): string {
  const base = (spec.frontmatter.description ?? '').trim();
  const phrases = (spec.frontmatter.trigger_phrases as string[] | undefined) ?? [];
  if (phrases.length === 0) return base;
  const slash = phrases.filter((p) => p.startsWith('/'));
  const natural = phrases.filter((p) => !p.startsWith('/'));
  let tail = '';
  if (natural.length > 0) {
    tail += ` Trigger whenever the user says ${natural.map((p) => `'${p}'`).join(', ')}`;
    tail += slash.length > 0 ? `, or invokes ${slash.join(' / ')}.` : '.';
  } else if (slash.length > 0) {
    tail += ` Trigger when the user invokes ${slash.join(' / ')}.`;
  }
  return base + tail;
}

function titleAndBody(spec: CanonicalSpec): { title: string; body: string } {
  const firstLine = spec.body.split('\n', 1)[0] ?? '';
  const title = firstLine.replace(/^#\s*/, '').trim() || spec.frontmatter.name;
  const body = spec.body.split('\n').slice(1).join('\n').replace(/^\n+/, '');
  return { title, body };
}

interface EmitOpts {
  spec: CanonicalSpec;
  env: ReturnType<typeof makeNunjucksEnv>;
  outputRoot: string;
  mode: EmitMode;
  dryRun: boolean;
}

async function writeWithMode(
  outputPath: string,
  rendered: string,
  mode: EmitMode,
  outcome: EmitOutcome,
): Promise<'written' | 'skipped'> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  if (mode === 'bootstrap') {
    try {
      await fs.access(outputPath);
      process.stderr.write(`ERROR: bootstrap mode but ${outputPath} already exists\n`);
      process.exit(EXIT_MODE_CONFLICT);
    } catch {
      /* doesn't exist; proceed */
    }
  }
  if (mode === 'adopt') {
    try {
      const existing = await fs.readFile(outputPath, 'utf8');
      if (!existing.includes('GENERATED FROM:') || !existing.includes(`EMITTER: ${EMITTER_SLUG}`)) {
        outcome.status = 'skipped';
        outcome.reason = `adopt mode: ${outputPath} exists without GENERATED marker (adopter content preserved)`;
        return 'skipped';
      }
    } catch {
      /* first emit; proceed */
    }
  }
  await fs.writeFile(outputPath, rendered, 'utf8');
  return 'written';
}

async function emitSkill(opts: EmitOpts, toolCaps: ToolCapabilityEntry): Promise<EmitOutcome> {
  const { spec, env, outputRoot, mode, dryRun } = opts;
  const outcome = newOutcome(spec.path);

  const resolution = resolveCapabilities(spec, toolCaps);
  if (!resolution.canEmit) {
    outcome.status = 'skipped';
    outcome.reason = resolution.skipReason ?? 'unknown';
    return outcome;
  }

  const { title, body } = titleAndBody(spec);
  const outputPath = path.join(outputRoot, '.claude', 'skills', spec.frontmatter.name, 'SKILL.md');
  const rendered = env.render('skill.md.njk', {
    name: spec.frontmatter.name,
    description: projectSkillDescription(spec),
    generated_header: generatedHeader({
      canonicalPath: spec.path,
      emitterName: EMITTER_SLUG,
      emitterVersion: EMITTER_VERSION,
    }),
    title,
    body,
  });

  outcome.outputPath = outputPath;
  outcome.degradations = resolution.degradations;
  if (dryRun) {
    outcome.status = resolution.degradations.length > 0 ? 'degraded' : 'emitted';
    return outcome;
  }
  const result = await writeWithMode(outputPath, rendered, mode, outcome);
  if (result === 'written') {
    outcome.status = resolution.degradations.length > 0 ? 'degraded' : 'emitted';
  }
  return outcome;
}

async function emitAgent(opts: EmitOpts): Promise<EmitOutcome> {
  const { spec, env, outputRoot, mode, dryRun } = opts;
  const outcome = newOutcome(spec.path);

  const toolsUsed = (spec.frontmatter.tools_used as string[] | undefined) ?? [];
  const modelPref = (spec.frontmatter.model_preference as string | undefined) ?? 'medium';
  const model = MODEL_TABLE[modelPref] ?? MODEL_TABLE.medium;

  const { title, body } = titleAndBody(spec);
  const outputPath = path.join(outputRoot, '.claude', 'agents', `${spec.frontmatter.name}.md`);
  const rendered = env.render('agent.md.njk', {
    name: spec.frontmatter.name,
    description: (spec.frontmatter.description ?? '').trim(),
    tools: toolsUsed.join(', '),
    model,
    generated_header: generatedHeader({
      canonicalPath: spec.path,
      emitterName: EMITTER_SLUG,
      emitterVersion: EMITTER_VERSION,
      extraLines: [`model_preference: ${modelPref} -> ${model}`],
    }),
    title,
    body,
  });

  outcome.outputPath = outputPath;
  if (dryRun) {
    outcome.status = 'emitted';
    return outcome;
  }
  const result = await writeWithMode(outputPath, rendered, mode, outcome);
  if (result === 'written') outcome.status = 'emitted';
  return outcome;
}

async function emitSteeringFile(
  skillNames: string[],
  agentNames: string[],
  outputRoot: string,
  mode: EmitMode,
  dryRun: boolean,
): Promise<EmitOutcome> {
  const steeringPath = path.join(outputRoot, 'CLAUDE.md');
  const outcome = newOutcome('canonical/skills/*');

  const header = generatedHeader({
    canonicalPath: 'canonical/',
    emitterName: EMITTER_SLUG,
    emitterVersion: EMITTER_VERSION,
  }).replace(/\n+$/, '');

  const lines: string[] = [
    header,
    '',
    '## SDLC discipline (from agent-reliability-kit)',
    '',
    'This project uses canonical SDLC specs. Claude Code reads per-skill',
    'instructions from `.claude/skills/<name>/SKILL.md` and subagents from',
    '`.claude/agents/<name>.md`. Invoke a skill by its slash form or trigger phrase.',
    '',
    'Active skills:',
    '',
  ];
  for (const n of skillNames) lines.push(`- \`/${n}\` — see \`.claude/skills/${n}/SKILL.md\``);
  if (agentNames.length > 0) {
    lines.push('');
    lines.push('Subagents:');
    lines.push('');
    for (const n of agentNames) lines.push(`- \`${n}\` — see \`.claude/agents/${n}.md\``);
  }
  lines.push('');
  lines.push('To regenerate after canonical/ changes:');
  lines.push('  node emitters/claude-code/dist/cli.js --output-root . --mode=adopt');

  const managedContent = lines.join('\n');
  let existing = '';
  try {
    existing = await fs.readFile(steeringPath, 'utf8');
  } catch {
    /* doesn't exist */
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

  outcome.outputPath = steeringPath;
  if (dryRun) {
    outcome.status = 'emitted';
    return outcome;
  }
  await fs.writeFile(steeringPath, newContent, 'utf8');
  outcome.status = 'emitted';
  return outcome;
}

async function emitSettings(
  outputRoot: string,
  mode: EmitMode,
  dryRun: boolean,
): Promise<EmitOutcome> {
  const outputPath = path.join(outputRoot, '.claude', 'settings.json');
  const outcome = newOutcome('(generated) .claude/settings.json');
  outcome.outputPath = outputPath;

  // The adopter owns settings.json (their permissions + hooks). In adopt mode, never clobber
  // an existing one - only emit when absent or in bootstrap/overwrite. This closes the
  // phantom-hook gap (B1): without an emitted settings.json the write-time co-located-test
  // hook the build/sdlc skills cite never fires in a fresh adopter repo.
  let exists = false;
  try {
    await fs.access(outputPath);
    exists = true;
  } catch {
    /* absent */
  }
  if (exists && mode === 'adopt') {
    outcome.status = 'skipped';
    outcome.reason =
      'settings.json exists (adopter-owned); add the PreToolUse governance hook manually if missing';
    return outcome;
  }

  const settings = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    _doc:
      'Emitted by the agent-reliability-kit. The PreToolUse hook wires the write-time governance ' +
      'gate (reliability-engine hook) so governance.yaml rules (co-located-test, no_secrets, ' +
      'scope-containment) fire AT WRITE TIME, not only at the ship gate. Set the command to your ' +
      "installed engine: published kit -> 'npx reliability-engine hook'; local/workspace -> " +
      "'node <path>/engine/dist/cli.js hook'. Without this hook the skills' write-time enforcement " +
      'is advisory only (the ship gate remains the backstop).',
    hooks: {
      PreToolUse: [
        {
          matcher: 'Edit|Write|NotebookEdit',
          hooks: [
            {
              type: 'command',
              command: 'npx reliability-engine hook --config governance.yaml',
              timeout: 10000,
            },
          ],
        },
      ],
    },
  };

  if (dryRun) {
    outcome.status = 'emitted';
    return outcome;
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  outcome.status = 'emitted';
  return outcome;
}

async function main(): Promise<number> {
  const program = new Command();
  program
    .name('emit-claude-code')
    .description('Emit canonical specs to Claude Code format')
    .requiredOption('--output-root <path>', 'Target directory root')
    .requiredOption('--mode <mode>', 'bootstrap | adopt | overwrite')
    .option('--dry-run', 'Print what would be emitted; write nothing', false)
    .option('--canonical-root <path>', 'Canonical source root (default: <kit>/canonical/)')
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

  let toolCaps: Record<string, ToolCapabilityEntry>;
  if (opts.toolCapabilities) {
    const yaml = (await import('js-yaml')).default;
    toolCaps = yaml.load(await fs.readFile(path.resolve(opts.toolCapabilities), 'utf8')) as Record<
      string,
      ToolCapabilityEntry
    >;
  } else {
    toolCaps = await loadToolCapabilities(canonicalRoot);
  }
  const toolCapsForTool = toolCaps[TOOL];
  if (!toolCapsForTool) {
    process.stderr.write(`ERROR: tool-capabilities.yaml missing entry for "${TOOL}"\n`);
    return EXIT_INPUT_ERROR;
  }

  const env = makeNunjucksEnv(path.resolve(path.dirname(__filename), '..', 'templates'));
  const specs = await loadAllCanonical(canonicalRoot);
  const outcomes: EmitOutcome[] = [];
  const skillNames: string[] = [];
  const agentNames: string[] = [];

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
    const anatomyErrors = validateSkillAnatomy(spec);
    if (anatomyErrors.length > 0) {
      process.stderr.write(formatAnatomyErrors(spec, anatomyErrors) + '\n');
      return EXIT_AUTHOR_BUG;
    }
    const outcome = await emitSkill(
      { spec, env, outputRoot, mode: opts.mode, dryRun: opts.dryRun },
      toolCapsForTool,
    );
    outcomes.push(outcome);
    if (outcome.status === 'emitted' || outcome.status === 'degraded') skillNames.push(spec.frontmatter.name);
  }

  for (const spec of specs) {
    if (spec.kind !== 'agent') continue;
    if (spec.frontmatter.status && spec.frontmatter.status !== 'active') {
      const o = newOutcome(spec.path);
      o.status = 'skipped';
      o.reason = `status=${spec.frontmatter.status}`;
      outcomes.push(o);
      continue;
    }
    const outcome = await emitAgent({ spec, env, outputRoot, mode: opts.mode, dryRun: opts.dryRun });
    outcomes.push(outcome);
    if (outcome.status === 'emitted') agentNames.push(spec.frontmatter.name);
  }

  const steering = await emitSteeringFile(skillNames, agentNames, outputRoot, opts.mode, opts.dryRun);
  outcomes.unshift(steering);

  // B1: ship a .claude/settings.json wiring the write-time governance hook, so the
  // co-located-test enforcement the skills cite actually fires in an adopter repo.
  const settingsOutcome = await emitSettings(outputRoot, opts.mode, opts.dryRun);
  outcomes.push(settingsOutcome);

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
