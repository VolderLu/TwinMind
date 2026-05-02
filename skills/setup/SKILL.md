---
name: setup
description: "Initialize a new TwinMind vault in the current directory. Creates TwinMind.md configuration and vault directory structure from templates. Use when starting a fresh knowledge vault or setting up TwinMind in a new project."
license: MIT
---

# TwinMind Setup

Initialize a new TwinMind vault in the current working directory.

## Pre-flight Checks

Before proceeding, check for existing installations:

1. **TwinMind.md exists** → Warn: "TwinMind.md already exists in this directory. Overwrite?" Ask user to confirm or abort.
2. **Old-style `.claude/skills/tm-*` directories exist** → Warn: "Detected old-style TwinMind installation (.claude/skills/tm-*). This plugin-based setup is separate. Consider removing old files to avoid confusion."
3. **Vault directory already exists and contains files** → Warn: "Directory `<vault_dir>/` already exists with content. Setup will not overwrite existing vault data. Only missing structure files will be created."

If all checks pass or user confirms, proceed.

## Interactive Configuration

Ask the user for customization (or accept defaults):

1. **Vault directory name** — default: `vault`
2. **Locale** — default: `zh-TW`
3. **Domains** — default: empty list (AI creates as needed)

## Setup Steps

### Resolve Plugin Root

Setup needs the plugin's absolute path to copy templates from. Read `<cwd>/.claude/twinmind/config.json` with the Read tool and use its `pluginRoot` field as `<plugin-root>` in the steps below.

**Cold-start fallback**: if `<cwd>/.claude/twinmind/config.json` does not exist, the SessionStart hook has not run for this vault yet (TwinMind.md is required to trigger it). In that case:

1. Use the Write tool to create `<cwd>/TwinMind.md` with minimal frontmatter (just `vault_dir: vault\nvault_name: TwinMind\nlocale: zh-TW`).
2. Tell the user: "請執行 `exit` 退出 Claude Code，然後 `claude` 重新啟動 session (讓 SessionStart hook 寫入 plugin 路徑)，再次執行 `/setup` 完成餘下步驟。"
3. Stop.

### Copy and Customize

1. Copy `<plugin-root>/templates/TwinMind.md` to `<cwd>/TwinMind.md`.
2. Update frontmatter values based on user's choices (`vault_dir`, `locale`, `domains`).
3. Copy `<plugin-root>/templates/vault/` directory structure to `<cwd>/<vault_dir>/`:
   - Create all subdirectories: `System/`, `Cards/`, `Sources/`, `Atlas/`, `PARA/Inbox/`, `PARA/Actions/`, `PARA/Projects/`, `PARA/Archive/`, `PARA/Areas/`, `PARA/Tasks/`.
   - Copy initial files: `System/vault-index.json`, `Home.md`, `PARA/Dashboard.md`.
   - Skip directories/files that already exist.
4. Create `.gitignore` in `<cwd>` if not exists, listing both `.obsidian/` and `.claude/twinmind/` (the latter holds plugin-generated shims that regenerate on every session start).

## Completion

Report:

- Created TwinMind.md at project root
- Created vault structure at `<vault_dir>/`
- Next steps: "Open this directory in Obsidian to browse your vault. Start talking to Claude to capture knowledge!"
