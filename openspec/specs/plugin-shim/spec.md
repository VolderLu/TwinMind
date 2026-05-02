## ADDED Requirements

### Requirement: Project-local shim layout under `.claude/twinmind/`

The plugin SHALL materialize a project-local helper layout under `<cwd>/.claude/twinmind/` in any detected TwinMind project. The layout SHALL contain exactly one `config.json` at the root and a `bin/` directory containing one Node shim per plugin script invoked from skills.

#### Scenario: Layout files present after session start

- **WHEN** a session starts in a directory containing `TwinMind.md`
- **AND** the SessionStart hook has completed
- **THEN** `<cwd>/.claude/twinmind/config.json` exists and is valid JSON
- **AND** `<cwd>/.claude/twinmind/bin/tm-post-op.mjs` exists
- **AND** `<cwd>/.claude/twinmind/bin/tm-update-index.mjs` exists
- **AND** `<cwd>/.claude/twinmind/bin/tm-fetch-title.mjs` exists

#### Scenario: No layout in non-TwinMind directories

- **WHEN** a session starts in a directory without `TwinMind.md`
- **THEN** the hook does not create `<cwd>/.claude/twinmind/`

### Requirement: `config.json` records absolute plugin root

The `<cwd>/.claude/twinmind/config.json` file SHALL contain a single top-level `pluginRoot` field whose value is the absolute filesystem path of the running plugin's root directory (the directory containing `plugin.json`). The file SHALL serialize stably so byte-equality comparison succeeds across runs that use the same plugin install.

#### Scenario: pluginRoot field

- **WHEN** parsing `<cwd>/.claude/twinmind/config.json`
- **THEN** the parsed object has a `pluginRoot` field of type string
- **AND** that path is absolute according to `path.isAbsolute`
- **AND** that path resolves to an existing directory containing `plugin.json`

#### Scenario: Stable serialization

- **WHEN** the hook writes `config.json` twice in succession with the same `pluginRoot`
- **THEN** the second write is skipped because the existing file bytes match the desired bytes

### Requirement: Shim contract

Every shim under `<cwd>/.claude/twinmind/bin/` SHALL be a self-contained Node script that:

1. Reads sibling `../config.json` to obtain `pluginRoot`.
2. Constructs the absolute target path `<pluginRoot>/scripts/<original-name>.mjs` using `path.join`.
3. Spawns the target via `child_process.spawn(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' })`.
4. Forwards the child's exit code to the shim's own exit code; if the child exits because of a signal, the shim re-raises the same signal on its own process.

The shim SHALL NOT be invoked via shebang or executable bit; consumers always run it as `node <path>`.

#### Scenario: Forward arguments and exit code

- **WHEN** invoking `node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '{"event_type":"X","event_context":{}}'`
- **THEN** the child process receives the same arguments after the script path
- **AND** the shim exits with the same code as the underlying `scripts/post-op.mjs` invocation

#### Scenario: stdout and stderr passthrough

- **WHEN** the underlying script writes `post-op done | layer=action | …` to stdout
- **THEN** the shim's stdout contains the same line verbatim
- **AND** stderr from the underlying script appears on the shim's stderr unchanged

### Requirement: Shim names map deterministically

The plugin SHALL map every script under `scripts/<name>.mjs` that is invoked from skills to a shim named `bin/tm-<name>.mjs`. The set of shims is exactly: `tm-post-op.mjs`, `tm-update-index.mjs`, `tm-fetch-title.mjs`.

#### Scenario: Mapping enumerated

- **WHEN** listing `<cwd>/.claude/twinmind/bin/`
- **THEN** the listing contains exactly three files: `tm-post-op.mjs`, `tm-update-index.mjs`, `tm-fetch-title.mjs`

### Requirement: Shim layout is cross-platform

Shim files and `config.json` SHALL be written using only Node.js built-in modules (`node:fs`, `node:path`, `node:url`, `node:child_process`). They SHALL NOT contain bash, batch, or PowerShell syntax. They SHALL NOT inline absolute filesystem paths into shell command strings; absolute paths flow only through `config.json` (parsed by Node).

#### Scenario: No shell syntax in shim

- **WHEN** scanning each file under `bin/` for shell-only constructs (`#!/bin/bash`, `@echo off`, `Set-StrictMode`)
- **THEN** zero matches are found

#### Scenario: Forward-slash invocation only

- **WHEN** any skill or `router-prompt.md` references a shim
- **THEN** the path uses forward slashes only (`.claude/twinmind/bin/tm-<name>.mjs`)
- **AND** no skill or `router-prompt.md` text contains the substring `${CLAUDE_PLUGIN_ROOT}`

### Requirement: Idempotent shim writes

Writes to `config.json` and each shim file SHALL be idempotent: the writer SHALL read the existing target file (if present), compare bytes against the desired content, and skip the write when they match. Mismatches SHALL be overwritten with the desired bytes.

#### Scenario: Repeated session starts do not rewrite unchanged files

- **WHEN** session-start runs twice in succession with the same `pluginRoot` and shim template content
- **THEN** the second run does not call `writeFileSync` for `config.json` or any shim file, so their bytes and mtimes are unchanged

#### Scenario: Plugin root change triggers rewrite

- **WHEN** the plugin is reinstalled at a different absolute path
- **AND** session-start runs again
- **THEN** `config.json` is rewritten with the new `pluginRoot`
- **AND** existing shim files are checked and rewritten only if their bytes no longer match the template

### Requirement: Shim writer failures do not block session start

Errors during shim writing (e.g., read-only filesystem, permission denied) SHALL be reported to stderr by `session-start.mjs` as a single line prefixed with `twinmind shim-writer:`, and SHALL NOT prevent the hook from emitting `router-prompt.md` to stdout. The hook SHALL exit with code 0 even when shim writing fails.

#### Scenario: Read-only vault

- **WHEN** `<cwd>/.claude/twinmind/` cannot be created or written
- **THEN** the hook writes one stderr line beginning with `twinmind shim-writer:`
- **AND** the hook still writes `router-prompt.md` content to stdout
- **AND** the hook exits with code 0
