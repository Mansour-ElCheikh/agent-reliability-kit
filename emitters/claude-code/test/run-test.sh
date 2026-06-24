#!/usr/bin/env bash
# Claude Code emitter self-test. Same shape as Cursor / Copilot.
#
# Emits the golden-input canonical/ into a temp dir, normalises the
# non-deterministic bits (timestamps, absolute GENERATED FROM paths,
# temp-dir paths in the report), diffs against golden-output/.

set -euo pipefail

EMITTER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$EMITTER_DIR/test"
SCRATCH="$(mktemp -d)"
GOLDEN="$TEST_DIR/golden-output"

trap 'rm -rf "$SCRATCH"' EXIT

# Requires a built dist. CI runs `pnpm run build` before self-tests; for local
# runs do the same first. Fail loud if the build artifact is missing.
if [ ! -f "$EMITTER_DIR/dist/cli.js" ]; then
  echo "ERROR: $EMITTER_DIR/dist/cli.js not found. Run 'pnpm run build' first." >&2
  exit 1
fi

node "$EMITTER_DIR/dist/cli.js" \
  --canonical-root "$TEST_DIR/golden-input/canonical" \
  --tool-capabilities "$TEST_DIR/golden-input/canonical/tool-capabilities.yaml" \
  --output-root "$SCRATCH" \
  --mode bootstrap >/dev/null

# Rename the timestamped report to a stable name
shopt -s nullglob
for f in "$SCRATCH"/.scaffold/emit-report.claude-code.*.md; do
  mv "$f" "$SCRATCH/.scaffold/emit-report.claude-code.NORMALISED.md"
done

# Normalise non-deterministic content
find "$SCRATCH" -type f \( -name '*.md' -o -name 'CLAUDE.md' \) | while read -r f; do
  python3 -c "
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
t = p.read_text()
t = re.sub(r'GENERATED AT: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', 'GENERATED AT: NORMALISED', t)
t = re.sub(r'GENERATED FROM: .*?canonical/skills/', 'GENERATED FROM: canonical/skills/', t)
t = re.sub(r'GENERATED FROM: .*?canonical/agents/', 'GENERATED FROM: canonical/agents/', t)
t = re.sub(r'GENERATED FROM: .*?canonical/', 'GENERATED FROM: canonical/', t)
t = re.sub(r'\*\*Output root:\*\* .*', '**Output root:** NORMALISED', t)
t = re.sub(r'\*\*Run at:\*\* .*', '**Run at:** NORMALISED', t)
t = re.sub(r'/private/var/folders/[^/]+/[^/]+/[^/]+/tmp\.[A-Za-z0-9]+', 'OUTPUT_ROOT', t)
t = re.sub(r'/var/folders/[^/]+/[^/]+/[^/]+/tmp\.[A-Za-z0-9]+', 'OUTPUT_ROOT', t)
t = re.sub(r'/tmp/tmp\.[A-Za-z0-9]+', 'OUTPUT_ROOT', t)
t = re.sub(r'.*?golden-input/canonical/', 'canonical/', t)
p.write_text(t)
" "$f"
done

if [ ! -d "$GOLDEN" ] || [ -z "$(ls -A "$GOLDEN" 2>/dev/null)" ]; then
  echo "No goldens yet. Copying current output to $GOLDEN..."
  rm -rf "$GOLDEN"
  mkdir -p "$GOLDEN"
  cp -R "$SCRATCH"/. "$GOLDEN/"
  echo "Goldens created. Review the diff in PR. Re-run to verify."
  exit 0
fi

if diff -r "$SCRATCH" "$GOLDEN" >/dev/null 2>&1; then
  echo "Claude Code emitter self-test: PASS"
  exit 0
else
  echo "Claude Code emitter self-test: FAIL"
  echo "Diff:"
  diff -r "$SCRATCH" "$GOLDEN" | head -50
  exit 1
fi
