---
name: review
description: "TwinMind review and maintenance engine. Use for vault health checks, seed card review, index verification/rebuild, MOC management, and vault status summaries. Triggers on: 'vault status', '知識庫狀況', 'health report', '健康報告', 'verify index', '檢查索引', 'rebuild index', '重建索引', 'review seeds', '有哪些 seed', 'update MOC', or any request about knowledge base maintenance and overview."
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

知識庫的維護和回顧工具。大多數操作是唯讀的（看看知識庫的狀態），但索引修復/重建會修改檔案。

唯讀操作不需觸發 post-op。索引修復/重建完成後透過 Bash tool 執行 `node .claude/twinmind/bin/tm-post-op.mjs --layer both --event '{"event_type":"INDEX_REBUILT","event_context":{}}'` 觸發 post-op pipeline。

## 知識庫摘要（Vault Summary）

從 `vault-index.json` 產出摘要，不掃描檔案：

| 項目 | 來源 |
|------|------|
| 卡片總數 | `stats.total_cards` |
| 類型分佈 | 遍歷 `notes` 按 `type` 分組計數 |
| 成熟度分佈 | 遍歷 `notes` 按 `status` 分組計數 |
| 前 5 大領域 | `stats.domains` 依計數降序取前 5 |
| 活躍專案數 | `projects` 中 `status == "active"` 的數量 |
| 最後更新 | `stats.last_updated` |

空 vault（`total_cards == 0`）：「知識庫目前還沒有卡片，試著分享一個想法或知識吧！」

## Seed 回顧

幫助使用者發展未成熟的知識卡片——seed 是剛記錄但還沒充分發展的想法。

**摘要統計**：seed 總數、佔比（%）、seed 最多的領域。

**篩選與排序**（支援指定 domain）：

1. created 最舊者優先（越久沒發展越需要關注）
2. link_count 最少者優先
3. title 字母序

**發展建議**（依優先序取第一個符合的）：

- summary < 20 字元 → 「補充內容」
- link_count == 0 → 「建立連結」
- link_count >= 2 → 「升級為 growing」

無 seed → 「所有卡片已超越 seed 階段」

## 知識健康報告

四項健康指標的整合分析。空 vault 不適用。

完整指標定義和評級規則，請讀取 `references/health-indicators.md`。

**指標摘要**：

1. **孤島卡片** — link_count == 0 的卡片（有則警告）
2. **領域偏斜** — 任一 domain > 50% 或 total > 10 且 domain < 3（有則警告）
3. **Seed 堆積** — seed 佔比 > 60%（有則警告）
4. **連結密度** — total_links / total_cards < 1.0 且 cards > 5（有則警告）

**評級**：0 警告 = 良好、1-2 = 尚可、≥3 = 需要關注

## 索引完整性管理

### 驗證（唯讀）

1. 讀取 `vault-index.json` 所有 notes 的 path
2. 掃描 `Cards/` 和 `Sources/` 的 `.md` 檔案
3. 偵測差異：
   - **孤兒條目**：index 有但檔案不存在
   - **未追蹤檔案**：檔案存在但 index 沒有
4. 全部一致 → 「驗證通過」；有差異 → 列出並詢問是否修復

### 修復（需執行 post-op（Bash tool））

**孤兒移除**：從 notes 移除、更新 stats、清理 links_to/linked_from 引用。
**未追蹤新增**：讀取 frontmatter，生成 summary，加入 notes 和 stats。

### 完整重建（需執行 post-op（Bash tool））

既有 index 有資料時先確認再覆寫。掃描所有 `.md`、重建 notes/stats/links、保留 projects/areas。寫入前執行九項一致性不變式驗證，發現不一致時在記憶體中修正後再寫入，並在摘要中報告修正項目。完整程序請讀取 `references/index-rebuild.md`。

## Inbox Triage 過期提醒

檢查 Inbox 中過期的 pending 項目，提醒使用者處理：

1. 從 `vault-index.json` 的 `inbox` 篩選 `status == "pending"` 的項目
2. 讀取 `config.md` 的 `memo_stale_days`（預設 7）
3. 計算每個 pending 項目的存在天數（今天 - `created`）
4. 列出超過 `memo_stale_days` 的項目，標記為「過期」
5. 顯示格式：

   ```text
   📥 Inbox 過期項目（超過 7 天未處理）：
   - 📝 memo: <text>（<created>，已 N 天）
   - 💡 idea: <text>（<created>，已 N 天）

   建議：升格（promote）、捨棄（dismiss）、或保留
   ```

6. 無過期項目 → 「Inbox 沒有過期項目」

## Action 過期檢查

檢查長時間未完成的 active actions：

1. 從 `vault-index.json` 的 `standalone_actions` 篩選 `status == "active"`
2. 讀取 `config.md` 的 `action_stale_days`（預設 14）
3. 對每個 active action，讀取其檔案取得 `created` 日期
4. 列出超過 `action_stale_days` 的 actions
5. 顯示格式：

   ```text
   ⚡ 過期 Actions（超過 14 天未完成）：
   - <title>（<created>，已 N 天）tasks: <done>/<total>

   建議：繼續推進、拆分為專案、或標記完成
   ```

6. 無過期 action → 「沒有過期的行動」
