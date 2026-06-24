#!/usr/bin/env node
// ADR-0018 ADR-number-integrity gate, runnable standalone.
// Enforces the docs/decisions/ numbering rules that were prose-only in
// docs/decisions/template.md (authoring rule #2, "Never reuse numbers"):
//   (1) every ADR filename number (NNNN-*.md) is unique;
//   (2) each ADR's "# ADR-NNNN:" title matches its filename number.
// Catches the parallel-work collision where two branches grab the same next
// number independently (the duplicate ADR-0012 reconciled 2026-06-09).
//
// Invocation:
//   node scripts/check-adr-numbers.mjs [<decisions-dir>]   (default ./docs/decisions)

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADR_FILE = /^(\d{4})-.+\.md$/; // NNNN-slug.md — excludes template.md, README.md
const TITLE_NUM = /^#\s*ADR-(\d{4})\b/m; // "# ADR-NNNN: ..."

/** Numbers that appear on more than one ADR filename. Pure. */
export function findDuplicateNumbers(filenames) {
  const counts = new Map();
  for (const name of filenames) {
    const m = ADR_FILE.exec(name);
    if (!m) continue;
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([num]) => num).sort();
}

/** ADRs whose "# ADR-NNNN:" title number differs from (or is missing vs) the filename. Pure. */
export function findTitleMismatches(files) {
  const out = [];
  for (const { name, text } of files) {
    const fm = ADR_FILE.exec(name);
    if (!fm) continue;
    const tm = TITLE_NUM.exec(text);
    const titleNum = tm ? tm[1] : null;
    if (titleNum !== fm[1]) out.push({ name, fileNum: fm[1], titleNum });
  }
  return out;
}

/** Read a decisions dir and run both checks. */
export function checkAdrDir(dir) {
  const names = readdirSync(dir).filter((n) => n.endsWith('.md'));
  const files = names
    .filter((n) => ADR_FILE.test(n))
    .map((n) => ({ name: n, text: readFileSync(join(dir, n), 'utf8') }));
  return {
    dups: findDuplicateNumbers(names),
    mismatches: findTitleMismatches(files),
    count: files.length,
  };
}

function isDirectInvocation() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  const dir = process.argv[2] ?? './docs/decisions';
  const { dups, mismatches, count } = checkAdrDir(dir);
  let fail = 0;
  const emit = (msg) => {
    process.stderr.write('::error::' + msg.replace(/\n/g, '%0A') + '\n');
    process.stderr.write(msg + '\n');
    fail = 1;
  };
  if (dups.length) {
    emit(
      `Duplicate ADR number(s) in ${dir}: ${dups.join(', ')}. ` +
        'ADR numbers are immutable and unique (docs/decisions/template.md authoring rule #2).',
    );
  }
  for (const m of mismatches) {
    emit(
      `ADR title/filename mismatch in ${dir}: ${m.name} has title number ` +
        `${m.titleNum ?? '(none)'} (expected ${m.fileNum}).`,
    );
  }
  if (fail) process.exit(1);
  process.stdout.write(`All ${count} ADRs have unique, title-consistent numbers (ADR-0018 gate)\n`);
}
