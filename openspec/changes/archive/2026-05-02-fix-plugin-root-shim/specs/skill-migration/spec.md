## MODIFIED Requirements

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
