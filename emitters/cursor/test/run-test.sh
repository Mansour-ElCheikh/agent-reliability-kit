#!/usr/bin/env bash
# Cursor emitter self-test.
#
# Emits golden-input/canonical/ into a fresh temp dir, normalises the non-deterministic
# bits (timestamps, absolute paths in canonical path refs), and diffs against
# golden-output/. Non-zero exit on any mismatch.

set -euo pipefail

EMITTER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$EMITTER_DIR/test"
SCRATCH="$(mktemp -d)"
GOLDEN="$TEST_DIR/golden-output"

trap 'rm -rf "$SCRATCH"' EXIT

# Requires a built dist. CI runs `pnpm run build` before self-tests; for local
# runs do the same first. Fail loud if the build artifact is missing rather
# than testing stale output. (ADR-0005: Node-only stack, pnpm workspaces.)
if [ ! -f "$EMITTER_DIR/dist/cli.js" ]; then
  echo "ERROR: $EMITTER_DIR/dist/cli.js not found. Run 'pnpm run build' first." >&2
  exit 1
fi

# Emit
node "$EMITTER_DIR/dist/cli.js" \
  --canonical-root "$TEST_DIR/golden-input/canonical" \
  --tool-capabilities "$TEST_DIR/golden-input/canonical/tool-capabilities.yaml" \
  --output-root "$SCRATCH" \
  --mode bootstrap >/dev/null

# Normalise non-deterministic bits in the emitted files:
#  - GENERATED AT timestamps
#  - Absolute paths in the GENERATED FROM line (replace with the canonical-relative path)
#  - Absolute paths in emit report (Output root + Emitted line)
#  - Report filename includes a timestamp; rename to a stable name

# Rename report
shopt -s nullglob
for f in "$SCRATCH"/.scaffold/emit-report.cursor.*.md; do
  mv "$f" "$SCRATCH/.scaffold/emit-report.cursor.NORMALISED.md"
done

# Normalise content
find "$SCRATCH" -type f -name '*.mdc' -o -name '*.md' -o -name '.cursorrules' | while read -r f; do
  python3 -c "
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
t = p.read_text()
t = re.sub(r'GENERATED AT: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', 'GENERATED AT: NORMALISED', t)
# Strip the absolute path prefix from canonical refs so the golden is portable
t = re.sub(r'GENERATED FROM: .*?canonical/skills/', 'GENERATED FROM: canonical/skills/', t)
t = re.sub(r'GENERATED FROM: .*?canonical/agents/', 'GENERATED FROM: canonical/agents/', t)
t = re.sub(r'GENERATED FROM: .*?canonical/skills$', 'GENERATED FROM: canonical/skills', t, flags=re.MULTILINE)
# Strip absolute paths in emit report
t = re.sub(r'\*\*Output root:\*\* .*', '**Output root:** NORMALISED', t)
t = re.sub(r'\*\*Run at:\*\* .*', '**Run at:** NORMALISED', t)
# Strip macOS / Linux temp dir prefixes in report Emitted/Degraded lines
t = re.sub(r'/private/var/folders/[^/]+/[^/]+/[^/]+/tmp\.[A-Za-z0-9]+', 'OUTPUT_ROOT', t)
t = re.sub(r'/var/folders/[^/]+/[^/]+/[^/]+/tmp\.[A-Za-z0-9]+', 'OUTPUT_ROOT', t)
t = re.sub(r'/tmp/tmp\.[A-Za-z0-9]+', 'OUTPUT_ROOT', t)
t = re.sub(r'/tmp/[^/\s]+/_scratch', 'OUTPUT_ROOT', t)
t = re.sub(r'/private/tmp/[^/\s]+/_scratch', 'OUTPUT_ROOT', t)
# Strip absolute scratch prefix from canonical refs in report
t = re.sub(r'.*?golden-input/canonical/', 'canonical/', t)
p.write_text(t)
" "$f"
done

# Compare. If goldens don't exist, copy scratch into golden and report.
if [ ! -d "$GOLDEN" ] || [ -z "$(ls -A "$GOLDEN" 2>/dev/null)" ]; then
  echo "No goldens yet. Copying current output to $GOLDEN..."
  rm -rf "$GOLDEN"
  mkdir -p "$GOLDEN"
  cp -R "$SCRATCH"/. "$GOLDEN/"
  echo "Goldens created. Review the diff in PR. Re-run to verify."
  exit 0
fi

# Diff
if diff -r "$SCRATCH" "$GOLDEN" >/dev/null 2>&1; then
  echo "Cursor emitter self-test: PASS"
  exit 0
else
  echo "Cursor emitter self-test: FAIL"
  echo "Diff:"
  diff -r "$SCRATCH" "$GOLDEN" | head -50
  exit 1
fi
