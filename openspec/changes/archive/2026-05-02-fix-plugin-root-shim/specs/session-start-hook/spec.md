## MODIFIED Requirements

### Requirement: SessionStart hook detects TwinMind.md

The `session-start.mjs` hook SHALL read the `cwd` field from stdin JSON, check if `TwinMind.md` exists at that path, and exit silently (code 0, no stdout) if it does not exist. When `TwinMind.md` exists, the hook SHALL first invoke the shim writer (see capability `plugin-shim`) to materialize `<cwd>/.claude/twinmind/config.json` and shim files, then write `router-prompt.md` content to stdout. Shim writer failures SHALL NOT prevent stdout output.

#### Scenario: Non-TwinMind project

- **WHEN** the hook runs in a directory without `TwinMind.md`
- **THEN** the hook exits with code 0 and produces no stdout output
- **AND** the hook does not create `<cwd>/.claude/twinmind/`

#### Scenario: TwinMind project detected

- **WHEN** the hook runs in a directory containing `TwinMind.md`
- **THEN** the hook ensures `<cwd>/.claude/twinmind/config.json` and the three shim files exist with the correct content
- **AND** the hook outputs the contents of `router-prompt.md` to stdout
- **AND** the stdout output is less than 10,000 characters
- **AND** the stdout output does not contain the substring `${CLAUDE_PLUGIN_ROOT}`

#### Scenario: Shim writer error does not block session

- **WHEN** the hook runs in a directory containing `TwinMind.md` but cannot write to `<cwd>/.claude/twinmind/`
- **THEN** the hook writes one stderr line beginning with `twinmind shim-writer:`
- **AND** the hook still writes `router-prompt.md` to stdout
- **AND** the hook exits with code 0
