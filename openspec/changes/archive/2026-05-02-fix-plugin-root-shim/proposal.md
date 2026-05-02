## Why

The plugin's skill instructions and `router-prompt.md` tell the main agent to invoke helper scripts via `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs` through the Bash tool. Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` only in hook commands, slash commands, and agent definitions. It does **not** inject the variable into the Bash tool environment, so the shell expands it to an empty string and every `post-op`, `update-index`, and `fetch-title` call fails with `Cannot find module '/scripts/<name>.mjs'`. The failure has been reproduced in this session: every state-changing intent (capture, connect, action, task, area, project, inbox, review) hits it on the first write.

Substituting the variable inline at session-start would also be unsafe on Windows: injecting an absolute path like `C:\Users\...` into a Bash command line breaks Git Bash quoting (`\U` escape, drive-letter colon). The plugin needs a path strategy that works on Linux, macOS, and Windows without depending on env var injection or shell-specific quoting.

## What Changes

- `session-start.mjs` SHALL, when it detects a TwinMind project, write a project-local helper layout under `<cwd>/.claude/twinmind/` before emitting `router-prompt.md`:
  - `config.json` recording the absolute plugin root.
  - `bin/tm-post-op.mjs`, `bin/tm-update-index.mjs`, `bin/tm-fetch-title.mjs` Node shim scripts that read `pluginRoot` from sibling `../config.json` and forward to the plugin's `scripts/` counterparts via `child_process.spawn(process.execPath, …)`.
- Shim writing SHALL be idempotent: skip writes when the target file already matches the desired bytes; overwrite only when `pluginRoot` or shim template content changes.
- All `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs` references in `router-prompt.md` and the nine skills (`capture`, `connect`, `action`, `area`, `project`, `task`, `inbox`, `review`, `post-op`) SHALL be rewritten to `node .claude/twinmind/bin/tm-<name>.mjs` (project-relative, forward-slash only).
- Cross-skill file references that currently use `${CLAUDE_PLUGIN_ROOT}/skills/...` (e.g. `connect/SKILL.md` linking to `capture/references/link-inference.md`) SHALL be rewritten to refer to the target by its `twinmind:<name>` skill identifier, with the model resolving the actual file via `pluginRoot` from `.claude/twinmind/config.json` when it needs to read the underlying reference.
- The `setup` skill keeps its template-copy step but reads the plugin root from `.claude/twinmind/config.json` (written by session-start) instead of relying on `${CLAUDE_PLUGIN_ROOT}` in shell. **Cold-start fallback**: if a user runs `/setup` before any session has detected `TwinMind.md` (so `config.json` does not yet exist), the skill writes a minimal stub `TwinMind.md` and asks the user to restart the session, then re-run `/setup`; the second invocation re-prompts on the existing `TwinMind.md` (per the pre-flight overwrite check) and, on confirmation, completes the template copy.
- `.gitignore` SHALL ignore `.claude/twinmind/` in two places: the plugin repo's own `.gitignore` (covers contributor dev-mode usage), and the per-vault `.gitignore` written by the `setup` skill (covers user vaults).
- `hooks/hooks.json`, `hooks/validate.js`, and the underlying `scripts/post-op.mjs`, `scripts/update-index.mjs`, `scripts/fetch-title.mjs` are unchanged: hook commands still resolve `${CLAUDE_PLUGIN_ROOT}` correctly via the hook runtime, and the script CLIs are stable.
- **Migration note** for in-flight sessions: a stale `<cwd>/.claude/twinmind/bin/` from an earlier plugin install is regenerated automatically on the next session start by the idempotency check; users do not need to act.

## Capabilities

### New Capabilities

- `plugin-shim`: Defines the `<cwd>/.claude/twinmind/` layout, the shim contract (Node-only, project-relative invocation, exit-code passthrough), idempotency rules, and the cross-platform constraints that make the layout work on Windows Git Bash without absolute-path injection.

### Modified Capabilities

- `session-start-hook`: Hook gains the responsibility to write `config.json` + the three shims before emitting router-prompt content, and must do so without blocking session start on filesystem errors.
- `skill-migration`: The "script path references" requirement changes from `node ${CLAUDE_PLUGIN_ROOT}/scripts/` to `node .claude/twinmind/bin/tm-`. Cross-skill file references via `${CLAUDE_PLUGIN_ROOT}/skills/...` are removed in favor of skill-name references.

## Impact

- **Modified files**: `hooks/session-start.mjs`, `router-prompt.md`, `skills/capture/SKILL.md`, `skills/connect/SKILL.md`, `skills/action/SKILL.md`, `skills/area/SKILL.md`, `skills/project/SKILL.md`, `skills/task/SKILL.md`, `skills/inbox/SKILL.md`, `skills/review/SKILL.md`, `skills/post-op/SKILL.md`, `skills/setup/SKILL.md`, `.gitignore`, `README.md`.
- **New files**: `hooks/lib/shim-writer.mjs` (writes config.json + shim files), `templates/twinmind-bin/tm-post-op.mjs`, `templates/twinmind-bin/tm-update-index.mjs`, `templates/twinmind-bin/tm-fetch-title.mjs` (shim source kept as templates so they can be diffed during idempotency checks).
- **Unchanged**: `hooks/hooks.json`, `hooks/validate.js`, all files under `scripts/`, all PostToolUse validation logic, OpenSpec specs other than the two listed above plus the new `plugin-shim`.
- **Generated runtime artifacts** (in user's vault): `.claude/twinmind/config.json`, `.claude/twinmind/bin/tm-post-op.mjs`, `.claude/twinmind/bin/tm-update-index.mjs`, `.claude/twinmind/bin/tm-fetch-title.mjs`. These live in the user's vault, are excluded from version control via the plugin's `.gitignore` (and the per-vault `.gitignore` written by `setup`), and regenerate on each session start.
- **Cross-platform**: Validated against Linux, macOS, and Windows Git Bash. No bash/batch/PowerShell-specific syntax. No absolute paths injected into Bash command strings. No reliance on shebang or executable bit.
- **Performance**: One `readFileSync` per target (config.json plus three shims) and one per shim template, all under 1 KB. Negligible.
- **Backward compatibility**: Existing user vaults work after upgrade with no manual action; the next session-start writes the shims. If a user previously ran with broken `${CLAUDE_PLUGIN_ROOT}` references, those calls now succeed because the model invokes the project-relative shim instead.
