## Context

Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` only in registered plugin contexts (hooks.json, slash commands, agent definitions). Skill content rendered to the model and Bash commands the model emits do **not** receive the substitution, and the Bash tool does not have `CLAUDE_PLUGIN_ROOT` in its environment. Empirically, running `node ${CLAUDE_PLUGIN_ROOT}/scripts/post-op.mjs` from the Bash tool expands to `node /scripts/post-op.mjs` and fails with `MODULE_NOT_FOUND`.

The TwinMind plugin currently relies on this expansion in `router-prompt.md` (~6 occurrences) and nine `SKILL.md` files (~30 occurrences) to invoke `scripts/post-op.mjs`, `scripts/update-index.mjs`, and `scripts/fetch-title.mjs`. A cross-platform fix is required because the plugin officially supports Linux, macOS, and Windows (Claude Code on Windows runs the Bash tool through Git Bash).

The session-start hook is the only deterministic hook that already runs in plugin context, has `${CLAUDE_PLUGIN_ROOT}` correctly substituted in its command line, and runs early in every session. It is the natural place to materialize a project-local helper layout that the rest of the plugin can reference with stable, relative paths.

## Goals / Non-Goals

**Goals:**

- Eliminate every literal `${CLAUDE_PLUGIN_ROOT}` reference from skill instructions and `router-prompt.md` so the main agent's Bash invocations never depend on shell variable expansion.
- Provide a single, idempotent code path that creates `.claude/twinmind/config.json` plus three Node shims under `.claude/twinmind/bin/` on every session start.
- Keep all paths the model emits to Bash as forward-slash, project-relative strings so they work uniformly on Linux/macOS bash, Windows Git Bash, and any other POSIX-compatible shell Claude Code may use in the future.
- Pass through exit codes and stdio so existing skill behavior (waiting for `post-op done | …` / `post-op failed | …`) is preserved.
- Do not regress hook performance: in the steady state where nothing has changed, shim writing should add only a handful of small reads (under 1 KB each) to session start.

**Non-Goals:**

- Adding a separate `tm` CLI binary on the user's PATH.
- Changing the CLI surface of `scripts/post-op.mjs`, `scripts/update-index.mjs`, or `scripts/fetch-title.mjs`.
- Supporting non-Node shells (fish, nushell, PowerShell native); the Bash tool already runs Bash on every supported platform.
- Detecting and recovering from filesystem corruption inside `.claude/twinmind/` beyond a byte-equality check before each rewrite.
- Versioning the shim layout for future schema changes; the byte-equality check already forces regeneration whenever the template or `pluginRoot` value changes, and a single `pluginRoot` field is enough today.

## Decisions

### Decision 1: Use Node shims (not bash shims)

Shims are written as `.mjs` Node scripts invoked via `node <path>`. Reasons:

- Node is already a hard dependency (every script under `scripts/` is `.mjs`).
- A single source of truth runs identically on Linux, macOS, and Windows. Bash shims would need separate `.cmd` wrappers on Windows; PowerShell shims would not work in Git Bash.
- We never rely on the executable bit or the shebang line; only `node <path>`. This sidesteps Windows filesystem semantics entirely.
- Node's `path.join` and JSON serialization handle Windows backslashes correctly when reading `pluginRoot` from `config.json`, so the shim never inlines a raw Windows path into a shell command.

**Alternatives considered:**

- **POSIX shell shim**: Compact, but requires Git Bash and an `exec` line that handles spaces correctly. Forces a second .cmd wrapper if Claude Code ever switches to native cmd.exe.
- **Per-platform shims** (`.sh` + `.cmd`): Doubles maintenance with no benefit while the Bash tool is the only consumer.
- **Inline absolute plugin root at session-start**: Works on Linux/macOS but breaks on Windows Git Bash because absolute paths contain `\` (interpreted as an escape) and `:` after the drive letter.

### Decision 2: Generated layout lives under `<cwd>/.claude/twinmind/`

```text
<cwd>/.claude/twinmind/
├── config.json              # { "pluginRoot": "<absolute path>" }
└── bin/
    ├── tm-post-op.mjs
    ├── tm-update-index.mjs
    └── tm-fetch-title.mjs
```

- `<cwd>` is the user's vault project root (the directory containing `TwinMind.md`). The `<cwd>/.claude/` directory is already a Claude Code convention; nesting under `twinmind/` gives the plugin a private namespace that won't collide with user-installed slash commands or other plugins' shims.
- Project-local placement is required: the model emits paths like `node .claude/twinmind/bin/tm-post-op.mjs`, which Bash resolves against the working directory. Anything else (e.g., user-home shims) would force absolute paths back into the command line.
- The directory is git-ignored both in the plugin repo (for contributor dev-mode) and in user vaults (written by `setup`); users cloning their vault into a fresh checkout regenerate the contents on first session start.

### Decision 3: Shim contract, spawn Node directly

Each shim is the same shape:

```js
#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(here, '..', 'config.json');

let pluginRoot;
try {
  pluginRoot = JSON.parse(readFileSync(cfgPath, 'utf8')).pluginRoot;
} catch (e) {
  process.stderr.write(`<shim-name>: cannot read ${cfgPath}: ${e.message}\n`);
  process.exit(1);
}

const target = join(pluginRoot, 'scripts', '<script-name>.mjs');
const child = spawn(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('error', (e) => {
  process.stderr.write(`<shim-name>: spawn failed: ${e.message}\n`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
```

- `process.execPath` ensures the same Node binary that started the shim is used for the target; this avoids PATH issues on Windows where `node.exe` may resolve differently in the shim's child shell.
- `stdio: 'inherit'` preserves stdout/stderr semantics that the existing skill prompts depend on (`post-op done | layer=… | …`, `post-op failed | step=… | error: …`).
- Signal forwarding mirrors the parent's exit reason. Skills currently only key off exit code, but signal forwarding is cheap insurance against future debugging.
- A `child.on('error', …)` handler is attached so a spawn failure (e.g. `ENOENT` because `pluginRoot` no longer points to a valid plugin install) surfaces a labeled stderr diagnostic instead of a raw stack trace. Without it, Node's default behavior on an unhandled `error` event is to throw, which produces a stack trace rather than a labeled message.
- The shim file is small enough (< 30 lines) that it can be stored as a static template in `templates/twinmind-bin/` and copied verbatim.

**Alternatives considered:**

- **Use `import` instead of `spawn`**: Faster start, but `scripts/post-op.mjs` reads `process.argv` directly and calls `process.exit`. Importing it would either require refactoring those scripts or capturing `process.exit` calls; both increase blast radius for this fix.
- **Hard-code the absolute target path inside the shim**: Saves the `config.json` read but couples the shim's content to a specific install path. Idempotency would require regeneration any time the plugin moves; with `config.json` indirection the shims are byte-stable across plugin upgrades unless the template changes.

### Decision 4: Idempotent writes via byte comparison

`session-start.mjs` calls a new `hooks/lib/shim-writer.mjs` module on every detected TwinMind session. The writer:

1. Computes the desired `config.json` body (`{"pluginRoot": "<abs>"}` with stable key order, trailing newline).
2. For each target, attempts `readFileSync(target, 'utf8')` inside a try/catch. On `ENOENT` the file is treated as missing; any other error propagates. On a successful read, the bytes are compared against the desired content.
3. Writes only mismatches via `fs.writeFileSync(target, desired)`. No explicit `mode` is set: shims are always invoked via `node <path>` and never need an executable bit, so the umask default is fine and avoids a stringly-typed magic constant.
4. Returns a status object `{config: 'unchanged'|'written', shims: {...}}` for telemetry; session-start currently consults this object only on the failure path, where it writes one stderr line. Stdout remains reserved for router-prompt content.

The try/catch ENOENT pattern (instead of `existsSync` followed by `readFileSync`) avoids a TOCTOU window between the existence check and the read, halves the syscall count on the steady-state hot path (single open+read instead of stat+open+read), and sidesteps Node's deprecation note on `existsSync`.

Shim template content is read inside the writer's outer try/catch on every call. Reading once at module load would save the per-call read but lets a missing template crash at `import` time before the caller can convert the failure into a `{ ok: false, error }` result, which violates the "session-start hook never blocks on shim writer errors" contract. Reading per-call costs three small (<1 KB) reads with a warm inode cache and keeps the error contract intact.

Errors during writing are caught: if any step fails, the writer returns `{ ok: false, error }`; session-start writes one stderr line `twinmind shim-writer: <message>` and continues to emit router-prompt. The plugin remains usable for read-only flows even if the user's vault directory is read-only; write flows will fail explicitly when the model tries to invoke the shim, which surfaces a clear error to the user.

### Decision 5: Document/skill rewrite uses project-relative paths

All references take this exact shape:

| Old | New |
|-----|-----|
| `node ${CLAUDE_PLUGIN_ROOT}/scripts/post-op.mjs` | `node .claude/twinmind/bin/tm-post-op.mjs` |
| `node ${CLAUDE_PLUGIN_ROOT}/scripts/update-index.mjs` | `node .claude/twinmind/bin/tm-update-index.mjs` |
| `node ${CLAUDE_PLUGIN_ROOT}/scripts/fetch-title.mjs` | `node .claude/twinmind/bin/tm-fetch-title.mjs` |
| `${CLAUDE_PLUGIN_ROOT}/skills/capture/references/link-inference.md` | `the references in the twinmind:capture skill` (prose) |
| `${CLAUDE_PLUGIN_ROOT}/templates/TwinMind.md` (in setup skill) | `<plugin-root>/templates/TwinMind.md` with instruction to read `pluginRoot` from `.claude/twinmind/config.json` |

The setup skill needs the plugin root to copy templates into the freshly created vault, and `connect` needs it to read shared references from `capture`; both read `config.json` via the Read tool and construct the absolute path. This is acceptable because both flows are interactive and run rarely.

### Decision 6: Hook command in hooks.json stays unchanged

`hooks/hooks.json` continues to use `node ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs` and `node ${CLAUDE_PLUGIN_ROOT}/hooks/validate.js`. The hook runtime substitutes the variable correctly and the Bash tool is not involved here. Touching hooks.json would force a behavior re-test for every PostToolUse invocation; we leave it alone.

## Risks / Trade-offs

**[Race: parallel session starts on the same vault]** → Two Claude Code sessions starting simultaneously could both attempt to write the same shim. Mitigation: each `fs.writeFileSync` call writes the file in one syscall (no partial-write window for files this small), and the byte-equality check makes repeat writes no-ops. Worst case is one redundant write, never a corrupted file. We accept this; vaults are not expected to host concurrent sessions.

**[User edits the shim]** → A user manually modifies `.claude/twinmind/bin/tm-post-op.mjs`. The byte-equality check will overwrite it on the next session start. Mitigation: documented in the proposal (`.gitignore` ignores the directory, files are regenerated). If a user wants persistence, they can fork the plugin.

**[Read-only vault directory]** → Some users may mount the vault read-only. Mitigation: shim writer logs the failure to stderr and session-start still emits router-prompt; read intents (query, review) keep working. Write intents fail with a clear error when the shim does not exist.

**[Plugin install path with unusual characters]** → If the absolute plugin root contains characters that need JSON escaping (already handled by `JSON.stringify`) or that Node's `path.join` cannot reproduce (none on supported platforms), the shim could resolve to a wrong target. Mitigation: shim uses `path.join`; we round-trip through JSON, which handles all valid filename characters. We do not attempt to support paths with embedded null bytes (impossible) or non-UTF-8 byte sequences (Node rejects them anyway).

**[Future change to shim template]** → If we later tweak the shim template (e.g., add logging), every existing vault must regenerate. Mitigation: byte comparison automatically detects the drift and rewrites. No version negotiation needed.

**[Documentation drift]** → Future contributors may revert to `${CLAUDE_PLUGIN_ROOT}` references out of habit. Mitigation: add a check in the workflow (CI grep) that fails if any non-archived `skills/**/*.md` or `router-prompt.md` contains the literal placeholder. Out of scope for this change but recorded as a follow-up.

## Migration Plan

1. Land the change. Existing user vaults pick it up on next session start; nothing for users to do.
2. Stale `.claude/twinmind/` directories from any earlier prototype have their contents byte-compared and overwritten only when the bytes diverge from the current template.
3. No rollback path required other than reverting the commit; the next session start with the old code restores the broken behavior, but no user data is harmed.

## Open Questions

None. All decisions above are firm; the proposal already pinned the architecture in /discuss.
