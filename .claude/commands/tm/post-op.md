---
name: "LYT: Post-Op"
description: TwinMind shared post-operation pipeline — runs as background subagent for changelog, MOC trigger check, Home.md + Dashboard rebuild
category: TwinMind
tags: ["knowledge", "vault", "post-op", "subagent"]
---

本 skill 以 background subagent 的形式執行，不在 main agent context 中運行。Calling skill 透過 Agent tool（`run_in_background: true`）啟動 subagent，傳入結構化 JSON payload（含 task、layer、event_type、event_context）。

Post-op subagent 僅讀取 vault-index.json，不寫入。一致性驗證由 PostToolUse hooks 自動處理。

完整程序請參照 `.claude/skills/tm-post-op/SKILL.md`。
