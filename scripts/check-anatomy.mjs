#!/usr/bin/env node
// ADR-0036 skill-anatomy gate, runnable standalone.
// Used by CI and adoptable for adopters who want to run it locally
// outside an emit-time invocation (e.g. before opening a PR).
//
// Invocation:
//   node scripts/check-anatomy.mjs [<canonical-root>]
//
// Default canonical root: ./canonical.

import { loadAllCanonical, validateSkillAnatomy, formatAnatomyErrors } from '../emitters/_lib/dist/index.js';

const canonicalRoot = process.argv[2] ?? './canonical';

const specs = await loadAllCanonical(canonicalRoot);
let fail = 0;
for (const spec of specs) {
  const errors = validateSkillAnatomy(spec);
  if (errors.length > 0) {
    process.stderr.write('::error::' + formatAnatomyErrors(spec, errors).replace(/\n/g, '%0A') + '\n');
    process.stderr.write(formatAnatomyErrors(spec, errors) + '\n');
    fail = 1;
  }
}
if (fail) process.exit(1);
process.stdout.write(`All ${specs.length} canonical specs PASS ADR-0036 anatomy gate\n`);
