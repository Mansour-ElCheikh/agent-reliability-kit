#!/usr/bin/env node
/**
 * Copilot agent-mode emitter — reads canonical/ and writes
 * .github/instructions/*.md + .github/copilot-instructions.md.
 *
 * Ported from emit.py (Python → TS in S6.3a per ADR-0005).
 * Contract: see canonical/emitter-contract.md.
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

const EMITTER_SLUG = 'emitters/copilot';
const EMITTER_VERSION = '1';
const TOOL = 'copilot-agent';
const TIER = 1;

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

  const resolution = resolveCapabilities(spec, toolCaps);
  if (!resolution.canEmit) {
    outcome.status = 'skipped';
    outcome.reason = resolution.skipReason ?? 'unknown';
    return outcome;
  }

  const outputPath = path.join(outputRoot, '.github', 'instructions', `${spec.frontmatter.name}.md`);

  const bodyLines = spec.body.split('\n');
  const titleLine = bodyLines[0] ?? '';
  const title = titleLine.startsWith('#') ? titleLine.replace(/^#+\s*/, '').trim() : spec.frontmatter.name;
  const bodyRest = bodyLines.slice(1).join('\n').replace(/^\n+/, '');

  const triggerPhrases = (spec.frontmatter.trigger_phrases as string[] | undefined) ?? [];
  const triggerStr = triggerPhrases.length
    ? triggerPhrases.map((t) => `\`${t}\``).join(', ')
    : 'invoke when relevant';

  const extraLines = resolution.degradations.length
    ? ['Degradations applied:', ...resolution.degradations.map(([cap, fb]) => `- ${cap} -> ${fb}`)]
    : undefined;

  const headerText = generatedHeader({
    canonicalPath: spec.path,
    emitterName: EMITTER_SLUG,
    emitterVersion: EMITTER_VERSION,
    extraLines,
  });

  const rendered = env.render('instruction.md.njk', {
    title,
    body: bodyRest,
    trigger_phrases_str: triggerStr,
    has_degradations: resolution.degradations.length > 0,
    degradations: resolution.degradations.map(([cap, fallback]) => ({ cap, fallback })),
    generated_header: headerText,
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
      process.stderr.write(`ERROR: bootstrap mode but ${outputPath} already exists\n`);
      process.exit(EXIT_MODE_CONFLICT);
    } catch {
      /* doesn't exist → OK */
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
      /* doesn't exist → first emit */
    }
  }

  await fs.writeFile(outputPath, rendered, 'utf8');
  outcome.status = resolution.degradations.length > 0 ? 'degraded' : 'emitted';
  outcome.outputPath = outputPath;
  outcome.degradations = resolution.degradations;
  return outcome;
}

interface EmitSteeringFileOptions {
  skillNames: string[];
  outputRoot: string;
  mode: EmitMode;
  dryRun: boolean;
}

async function emitSteeringFile(opts: EmitSteeringFileOptions): Promise<EmitOutcome> {
  const { skillNames, outputRoot, mode, dryRun } = opts;
  const steeringPath = path.join(outputRoot, '.github', 'copilot-instructions.md');
  const outcome = newOutcome('canonical/skills/*');

  const headerText = generatedHeader({
    canonicalPath: 'canonical/skills/',
    emitterName: EMITTER_SLUG,
    emitterVersion: EMITTER_VERSION,
  }).replace(/\n+$/, '');

  const managedLines: string[] = [
    headerText,
    '',
    '## SDLC discipline (from agent-reliability-scaffold)',
    '',
    'This project uses canonical SDLC specs. Per-skill instructions live in',
    '`.github/instructions/<name>.md`; Copilot agent mode reads them automatically',
    'on matching invocations.',
    '',
    'Active skills:',
    '',
  ];
  for (const name of skillNames) {
    managedLines.push(`- \`${name}\` — see \`.github/instructions/${name}.md\``);
  }
  managedLines.push('');
  managedLines.push('To regenerate after canonical/ changes:');
  managedLines.push('');
  managedLines.push('```sh');
  managedLines.push('node emitters/copilot/dist/cli.js --output-root . --mode=adopt');
  managedLines.push('```');

  const managedContent = managedLines.join('\n');
  await fs.mkdir(path.dirname(steeringPath), { recursive: true });
  let existing = '';
  try {
    existing = await fs.readFile(steeringPath, 'utf8');
  } catch {
    /* doesn't exist → '' */
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
    .name('emit-copilot')
    .description('Emit canonical specs to Copilot agent-mode format')
    .requiredOption('--output-root <path>', 'Target directory root')
    .requiredOption('--mode <mode>', 'bootstrap | adopt | overwrite')
    .option('--dry-run', 'Print what would be emitted; write nothing', false)
    .option('--canonical-root <path>', 'Canonical source root')
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
    const raw = await fs.readFile(path.resolve(opts.toolCapabilities), 'utf8');
    toolCaps = yaml.load(raw) as Record<string, ToolCapabilityEntry>;
  } else {
    toolCaps = await loadToolCapabilities(canonicalRoot);
  }

  const templateDir = path.resolve(path.dirname(__filename), '..', 'templates');
  const env = makeNunjucksEnv(templateDir);

  const specs = await loadAllCanonical(canonicalRoot);
  const outcomes: EmitOutcome[] = [];
  const emittedNames: string[] = [];

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

    const toolCapsForTool = toolCaps[TOOL];
    if (!toolCapsForTool) {
      process.stderr.write(`ERROR: tool-capabilities.yaml missing entry for "${TOOL}"\n`);
      return EXIT_INPUT_ERROR;
    }

    const outcome = await emitSkill({ spec, toolCaps: toolCapsForTool, env, outputRoot, mode: opts.mode, dryRun: opts.dryRun });
    outcomes.push(outcome);
    if (outcome.status === 'emitted' || outcome.status === 'degraded') {
      emittedNames.push(spec.frontmatter.name);
    }
  }

  for (const spec of specs) {
    if (spec.kind !== 'agent') continue;
    const o = newOutcome(spec.path);
    o.status = 'skipped';
    o.reason = 'Copilot agent mode has no subagent surface; agents are skipped (review checklist inlines into skills/review and skills/define)';
    outcomes.push(o);
  }

  const steering = await emitSteeringFile({
    skillNames: emittedNames,
    outputRoot,
    mode: opts.mode,
    dryRun: opts.dryRun,
  });
  outcomes.unshift(steering);

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
