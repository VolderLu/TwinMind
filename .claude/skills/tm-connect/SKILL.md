---
name: tm-connect
description: "TwinMind link engine for manual connections. Use when the user explicitly asks to link or unlink two specific cards (e.g. '把 X 和 Y 連起來', 'link X to Y', 'disconnect X from Y'). Handles relationship type classification, bidirectional link writing, and index updates. Not for automatic link inference during card creation — that's handled by tm:capture."
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

處理使用者明確要求的手動連結操作——建立或解除兩張卡片之間的連結。與 `tm:capture` 的自動連結推理不同，這裡是使用者主動指定要連結哪兩張卡片。

關係類型、分類規則、Connections 格式和反向對照表的完整定義，請讀取 `.claude/skills/tm-capture/references/link-inference.md`（與 capture 共用同一套連結系統）。

一致性驗證由 PostToolUse hooks 自動處理。完成操作後啟動 background subagent 執行 post-op pipeline（`layer: "knowledge"`）。

### Post-op Subagent 啟動方式

透過 Agent tool（`run_in_background: true`）啟動 subagent，prompt 包含 post-op payload：
```json
{
  "task": "post-op",
  "layer": "knowledge",
  "event_type": "<LINK_CREATED|LINK_REMOVED>",
  "event_context": {
    "source_id": "<ID>", "source_title": "<title>",
    "target_id": "<ID>", "target_title": "<title>",
    "relation": "<relationship_type>",
    "domains": ["<affected domains>"]
  }
}
```
啟動後立即回應使用者。

## 建立連結

當使用者要求連結兩張卡片時（如「把 Rust Ownership 和 RAII 連起來」）：

1. 從 `vault-index.json` 的 `notes` 以 title/keyword 找到兩張目標卡片
2. 找不到任一卡片 → 回報「未找到匹配的卡片」，列出可能候選
3. 關係類型判斷：
   - 使用者指定了（如「關係是 analogous」）→ 使用指定類型
   - 未指定 → 依 `references/link-inference.md` 的分類優先序自動推斷
4. 說明文字：使用者提供則用，未提供則 AI 生成一句話
5. 執行連結建立程序（見 `references/link-inference.md` 的「建立連結程序」）：
   - 寫入源卡片 `## Connections`（移除 placeholder 若有）
   - 寫入目標卡片反向連結（依反向對照表）
   - 更新 `vault-index.json`（**單次 Edit**）：old_string 涵蓋源 note entry、目標 note entry 和 stats 物件的連續 JSON 區塊；new_string 包含完整更新版本（links_to/linked_from 加入對應 ID、重算兩方 link_count、重算 stats.total_links、更新 stats.last_updated）。此操作 SHALL 為單次 Edit tool invocation
6. 啟動 post-op background subagent（event_type: `LINK_CREATED`）

## 解除連結

當使用者要求解除兩張卡片的連結時：

1. 從 `vault-index.json` 找到兩張目標卡片
2. 確認存在連結（檢查 `links_to`/`linked_from`）
3. 無連結 → 回報「這兩張卡片之間沒有連結」
4. 執行移除：
   - 從源卡片 `## Connections` 移除含目標卡片 wiki-link 的行。若移除後無連結，恢復 `（尚無連結）`
   - 從目標卡片 `## Connections` 移除含源卡片 wiki-link 的行。同上
   - 更新 `vault-index.json`（**單次 Edit**）：old_string 涵蓋源 note entry、目標 note entry 和 stats 物件的連續 JSON 區塊；new_string 包含移除連結後的完整版本（links_to/linked_from 移除對應 ID、重算兩方 link_count、重算 stats.total_links、更新 stats.last_updated）。此操作 SHALL 為單次 Edit tool invocation
5. 啟動 post-op background subagent（event_type: `LINK_REMOVED`）
