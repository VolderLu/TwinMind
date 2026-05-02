---
name: post-op
description: "TwinMind shared post-operation pipeline — DEPRECATED as LLM subagent. Post-op is now handled programmatically via scripts/post-op.mjs. This skill file is retained for reference only."
license: MIT
metadata:
  author: twinmind
  version: "4.0"
---

## twinmind:post-op（已廢除）

Post-op pipeline 已程式化為 `.claude/twinmind/bin/tm-post-op.mjs`，不再使用 LLM subagent 執行。

呼叫方式：

```bash
node .claude/twinmind/bin/tm-post-op.mjs --layer <knowledge|action|both> --event '<JSON>'
```

`.claude/twinmind/bin/tm-post-op.mjs` 是由 SessionStart hook 在 vault 端寫入的 shim，會 spawn plugin 內 `scripts/post-op.mjs` (pipeline 主程式，與 `scripts/lib/` 目錄共構)。需要查實作時，從 `.claude/twinmind/config.json` 的 `pluginRoot` 欄位取得 plugin 安裝路徑後，再去讀 `<pluginRoot>/scripts/post-op.mjs` 與 `<pluginRoot>/scripts/lib/`。
