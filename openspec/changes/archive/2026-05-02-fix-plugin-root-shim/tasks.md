## 1. Shim Templates and Writer Module

- [x] 1.1 Create `templates/twinmind-bin/tm-post-op.mjs` containing the shim contract from design.md (reads `../config.json`, spawns `<pluginRoot>/scripts/post-op.mjs` with `{ stdio: 'inherit' }`, forwards exit code and signals)
- [x] 1.2 Create `templates/twinmind-bin/tm-update-index.mjs` mirroring 1.1 but targeting `scripts/update-index.mjs`
- [x] 1.3 Create `templates/twinmind-bin/tm-fetch-title.mjs` mirroring 1.1 but targeting `scripts/fetch-title.mjs`
- [x] 1.4 Create `hooks/lib/shim-writer.mjs` exporting a single `writeShimLayout({ pluginRoot, cwd })` function that ensures `<cwd>/.claude/twinmind/config.json` and `<cwd>/.claude/twinmind/bin/tm-{post-op,update-index,fetch-title}.mjs` exist with idempotent byte-equality writes; returns `{ ok: true, status: { config, shims } }` on success and `{ ok: false, error }` on filesystem error
- [x] 1.5 In `hooks/lib/shim-writer.mjs`, read the three shim templates from `templates/twinmind-bin/` so the writer is a single dependency-free module (templates are loaded per call inside `writeShimLayout`'s try/catch; see 6.4)

## 2. Hook Integration

- [x] 2.1 Update `hooks/session-start.mjs` to import `writeShimLayout` from `./lib/shim-writer.mjs`, compute `pluginRoot = join(import.meta.dirname, '..')`, and call the writer when `TwinMind.md` is detected, before reading `router-prompt.md`
- [x] 2.2 In `hooks/session-start.mjs`, on writer error log a single line `twinmind shim-writer: <message>` to stderr and continue to emit router-prompt; do not block the hook
- [x] 2.3 Confirm `hooks/hooks.json` is unchanged; PostToolUse and SessionStart commands keep their `${CLAUDE_PLUGIN_ROOT}` paths

## 3. Skill and Router-Prompt Rewrites

- [x] 3.1 In `router-prompt.md`, replace every `node ${CLAUDE_PLUGIN_ROOT}/scripts/post-op.mjs` with `node .claude/twinmind/bin/tm-post-op.mjs`
- [x] 3.2 In `router-prompt.md`, replace every `node ${CLAUDE_PLUGIN_ROOT}/scripts/update-index.mjs` with `node .claude/twinmind/bin/tm-update-index.mjs`
- [x] 3.3 In `router-prompt.md`, replace every `node ${CLAUDE_PLUGIN_ROOT}/scripts/fetch-title.mjs` with `node .claude/twinmind/bin/tm-fetch-title.mjs`
- [x] 3.4 In `router-prompt.md`, replace any remaining `${CLAUDE_PLUGIN_ROOT}/...` references that are not script invocations with skill-name prose ("see the `twinmind:capture` references")
- [x] 3.5 In `skills/capture/SKILL.md`, apply the same three replacements (post-op, update-index, fetch-title) and remove any `${CLAUDE_PLUGIN_ROOT}/skills/...` cross-references
- [x] 3.6 In `skills/connect/SKILL.md`, apply the same three replacements and rewrite the `${CLAUDE_PLUGIN_ROOT}/skills/capture/references/link-inference.md` references as "see the references in the `twinmind:capture` skill" (or equivalent prose)
- [x] 3.7 In `skills/action/SKILL.md`, apply the post-op replacement
- [x] 3.8 In `skills/area/SKILL.md`, apply the post-op replacement
- [x] 3.9 In `skills/project/SKILL.md`, apply the post-op replacement
- [x] 3.10 In `skills/task/SKILL.md`, apply the post-op replacement
- [x] 3.11 In `skills/inbox/SKILL.md`, apply the post-op replacement
- [x] 3.12 In `skills/review/SKILL.md`, apply the post-op replacement
- [x] 3.13 In `skills/post-op/SKILL.md`, apply the post-op replacement and rewrite the descriptive references to `${CLAUDE_PLUGIN_ROOT}/scripts/post-op.mjs` and `${CLAUDE_PLUGIN_ROOT}/scripts/lib/` as `.claude/twinmind/bin/tm-post-op.mjs` (with a one-sentence note that the shim forwards to the plugin's `scripts/post-op.mjs`)
- [x] 3.14 In `skills/setup/SKILL.md`, change template-copy steps to: (a) read `<cwd>/.claude/twinmind/config.json` via Read tool to obtain `pluginRoot`, (b) construct absolute paths `<pluginRoot>/templates/TwinMind.md` and `<pluginRoot>/templates/vault/` for the copy operations
- [x] 3.15 Run `grep -rn '\${CLAUDE_PLUGIN_ROOT}' router-prompt.md skills/` and confirm zero matches outside of comments documenting the historical placeholder (none expected)
- [x] 3.16 Run `grep -rn 'node \.claude/twinmind/bin/tm-' router-prompt.md skills/` and confirm matches in router-prompt and the nine skills listed in 3.5-3.13

## 4. Repository Hygiene

- [x] 4.1 Add `.claude/twinmind/` to `.gitignore`
- [x] 4.2 Verify `.gitignore` change does not interfere with existing entries by running `git check-ignore -v .claude/twinmind/config.json` from a sample vault subdirectory

## 5. Verification

- [x] 5.1 In a temporary vault (`mktemp -d` with a stub `TwinMind.md`), pipe `{"cwd":"<tmpdir>"}` into `node hooks/session-start.mjs` and confirm: stdout contains router-prompt content; `<tmpdir>/.claude/twinmind/config.json` exists with the expected `pluginRoot`; the three shim files exist and contain the templates byte-for-byte
- [x] 5.2 In the same temporary vault, run `node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '{"event_type":"TEST_NOOP","event_context":{}}'` and confirm the underlying `scripts/post-op.mjs` runs (it will likely fail with a vault validation error, which is expected; the point is the shim resolves and dispatches)
- [x] 5.3 Re-run `node hooks/session-start.mjs` against the same temporary vault and confirm shim files' mtimes are unchanged (idempotency)
- [x] 5.4 Modify `<tmpdir>/.claude/twinmind/config.json` to set a different `pluginRoot`, re-run the hook, and confirm `config.json` is rewritten to the correct value while shim files remain unchanged
- [x] 5.5 Make `<tmpdir>/.claude/twinmind/` read-only (`chmod -R a-w`), run the hook, and confirm one stderr line `twinmind shim-writer: …` appears, stdout still contains router-prompt content, and exit code is 0
- [x] 5.6 Validate the OpenSpec change with `openspec validate fix-plugin-root-shim --strict`

## 6. Retroactive Tasks (added during apply / simplify / sync-docs)

- [x] 6.1 (apply) In `skills/setup/SKILL.md`, add a cold-start fallback: if `<cwd>/.claude/twinmind/config.json` does not exist when `/setup` runs, write a minimal stub `TwinMind.md` and ask the user to restart the session, then re-run `/setup`
- [x] 6.2 (apply) In `skills/setup/SKILL.md` step 4, write `.claude/twinmind/` into the user vault's `.gitignore` alongside `.obsidian/` so user vaults do not commit generated shims
- [x] 6.3 (simplify) In `hooks/lib/shim-writer.mjs`, replace `existsSync` + `readFileSync` two-step in `writeIfChanged` with a single `readFileSync` inside try/catch ENOENT (TOCTOU + deprecated-API cleanup)
- [x] 6.4 (simplify) In `hooks/lib/shim-writer.mjs`, move shim template `readFileSync` from module top-level into the `writeShimLayout` try/catch so a missing template returns `{ ok: false, error }` instead of crashing on import
- [x] 6.5 (simplify) In `hooks/lib/shim-writer.mjs`, drop `mode: 0o644` from `writeFileSync` (shims are invoked via `node <path>`; exec bit is meaningless)
- [x] 6.6 (simplify) In each shim template under `templates/twinmind-bin/`, add `child.on('error', ...)` so a `spawn` failure (e.g. invalid `pluginRoot`) prints a labeled stderr diagnostic and exits 1 instead of relying on Node's default unhandled-`error` behavior
- [x] 6.7 (simplify) In `hooks/session-start.mjs`, replace `existsSync(routerPath)` + `readFileSync` with a single `readFileSync` inside try/catch ENOENT
- [x] 6.8 (sync-docs) In `README.md` "知識庫結構" section, add a `.claude/twinmind/` line to the directory tree and a one-paragraph note explaining the runtime artifact
