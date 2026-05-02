## ADDED Requirements

### Requirement: All 11 skills migrated to plugin layout

Each of the 11 existing skills SHALL be moved from `.claude/skills/tm-<name>/SKILL.md` to `skills/<name>/SKILL.md` (without `tm-` prefix). The migrated skills are: capture, query, action, task, project, area, inbox, connect, review, enrich, post-op.

#### Scenario: Skill directory listing

- **WHEN** listing the `skills/` directory
- **THEN** it contains exactly 12 subdirectories: capture, query, action, task, project, area, inbox, connect, review, enrich, post-op, setup

### Requirement: Script path references updated

All references to script invocation in skill files SHALL use the project-relative shim form `node .claude/twinmind/bin/tm-<name>.mjs`. The legacy form `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs` SHALL NOT appear in any non-archived skill file or in `router-prompt.md`. The shims under `.claude/twinmind/bin/` are materialized by the SessionStart hook (see capabilities `session-start-hook` and `plugin-shim`).

#### Scenario: No bare script references remain

- **WHEN** searching all `skills/*/SKILL.md` files for the pattern `node ${CLAUDE_PLUGIN_ROOT}/scripts/` or any other path ending in `/scripts/<name>.mjs` outside of prose explanations of the legacy layout
- **THEN** zero matches are found

#### Scenario: No legacy plugin-root references in skills

- **WHEN** searching all `skills/*/SKILL.md` files and `router-prompt.md` for the substring `${CLAUDE_PLUGIN_ROOT}`
- **THEN** zero matches are found

#### Scenario: Shim references present

- **WHEN** searching all skills that invoke scripts (`capture`, `connect`, `action`, `task`, `area`, `inbox`, `project`, `review`, `post-op`) and `router-prompt.md` for the pattern `node .claude/twinmind/bin/tm-`
- **THEN** matches are found in every one of those files

#### Scenario: Cross-skill file references use skill names

- **WHEN** any skill needs to direct the model to read another skill's references
- **THEN** the text refers to the target skill by its `twinmind:<name>` identifier rather than constructing a `${CLAUDE_PLUGIN_ROOT}/skills/...` path

### Requirement: Skill internal cross-references updated

Any skill that references another skill by name SHALL use the new namespace format. References to `tm:capture` or `tm-capture` SHALL be updated to `twinmind:capture` (plugin-namespaced form).

#### Scenario: No old-style skill references remain

- **WHEN** searching all `skills/*/SKILL.md` files for patterns `tm:` or `tm-capture`, `tm-query`, etc.
- **THEN** zero matches are found (excluding historical context or documentation about the migration)

### Requirement: Skill frontmatter updated

Each `SKILL.md` SHALL have YAML frontmatter with at minimum `name` and `description` fields. The `name` field SHALL NOT contain the `tm-` prefix.

#### Scenario: Skill frontmatter format

- **WHEN** reading `skills/capture/SKILL.md`
- **THEN** its YAML frontmatter contains a `name` field that does not start with `tm-`

### Requirement: Validation hooks updated for plugin paths

All 5 validation hook scripts (`validate-card.js`, `validate-inbox.js`, `validate-action.js`, `validate-project-files.js`, `validate-index.js`) SHALL work when invoked from the plugin hooks directory. They SHALL NOT reference `$CLAUDE_PROJECT_DIR/.claude/hooks/`.

#### Scenario: No old hook path references

- **WHEN** searching all `hooks/validate-*.js` files for `$CLAUDE_PROJECT_DIR`
- **THEN** zero matches are found

### Requirement: Scripts use resolve-config for vault paths

The scripts `post-op.mjs`, `update-index.mjs`, and `fetch-title.mjs` SHALL import `resolveVaultRoot` from `./lib/resolve-config.mjs` and use it to determine the vault directory. They SHALL NOT use `resolve(__dirname, '..', 'vault')` or any `__dirname`-relative vault path.

#### Scenario: No __dirname vault resolution

- **WHEN** searching `scripts/*.mjs` for `__dirname` combined with `vault`
- **THEN** zero matches are found

#### Scenario: resolve-config import present

- **WHEN** reading `scripts/post-op.mjs` and `scripts/update-index.mjs`
- **THEN** both files import from `./lib/resolve-config.mjs`
