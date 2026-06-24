# Engine predicate extensions

Drop adopter-specific predicate files here. The engine auto-loads any file matching `*.predicates.{js,mjs}` at startup and registers every exported function as a predicate under its function name.

## Shape

```js
// engine/extensions/my-rules.predicates.mjs
// Signature: (input) => Finding[] | Promise<Finding[]>
//   input.filePath     string
//   input.fileContent  string (UTF-8; '' if unreadable/deleted)
//   input.rule         the governance.yaml rule entry (predicate-specific fields available)
//   input.context      { repoRoot, governance, headCommit, headCommitMessage, affectedFiles, allInScopeFiles }
// Finding: { ruleId, severity, filePath, line?, message }

export function no_todo_in_committed_code(input) {
  if (!/\.(ts|js|tsx|jsx)$/.test(input.filePath)) return [];
  const findings = [];
  input.fileContent.split('\n').forEach((line, i) => {
    if (/\bTODO\b/.test(line)) {
      findings.push({
        ruleId: input.rule.id,
        severity: input.rule.severity,
        filePath: input.filePath,
        line: i + 1,
        message: 'TODO marker in committed code',
      });
    }
  });
  return findings;
}
```

Then in `governance.yaml`:

```yaml
- id: R30_no_todo
  severity: warn
  description: No TODO markers in committed source.
  enforcement: [engine]
  check: no_todo_in_committed_code
  scope: "src/**"
```

## Constraints (v0.1)

- **TS/JS only.** This is tracked as F12 in [docs/findings/wave4-self-bootstrap.md](../../docs/findings/wave4-self-bootstrap.md). To use another language, wrap a `child_process` call inside a JS predicate. A native multi-language predicate registry is a v0.2 candidate (see [ROADMAP.md](../../ROADMAP.md)).
- TypeScript authors: compile to `.js`/`.mjs` here, or ship `.mjs` directly. The loader imports the emitted module, not `.ts` source.
- Predicates must be pure functions of their input. Global state (HEAD message, affected files) is provided via `input.context`; don't reach outside it.
- An exception thrown while importing an extension file aborts the run with a clear error (fail-loud; a broken predicate must not silently disable governance).

This directory ships empty in the scaffold (only this README). It is the adopter's surface.
