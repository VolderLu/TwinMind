---
name: "LYT: Capture"
description: TwinMind card engine — create, update, delete cards with link inference
category: TwinMind
tags: ["knowledge", "vault", "capture"]
---

捕捉使用者的想法、知識、問題或來源引用，轉化為知識卡片。建卡後透過 foreground subagent 執行自動連結推理，完成後啟動 background subagent 執行 post-op pipeline。

一致性驗證由 PostToolUse hooks 自動處理。

完整程序請參照 `.claude/skills/tm-capture/SKILL.md`。
