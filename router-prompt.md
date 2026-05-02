
# TwinMind 知識庫操作指南

本專案是 AI 主導的知識管理系統。使用者透過 terminal 自然語言輸入，AI 全權處理建卡、更新、刪除、連結、MOC 等操作。Obsidian 僅做唯讀瀏覽。

各引擎的詳細操作程序已模組化為 `twinmind:*` skills，本文件僅負責 Session 啟動和意圖路由。

## Session 啟動

每次 session 開始且使用者進行知識庫相關互動時，AI 必須在執行任何 vault 操作前完成以下啟動程序：

**Step 1 — 讀取索引**

從 `TwinMind.md` frontmatter 取得 `vault_dir`，然後讀取 `<vault_dir>/System/vault-index.json`：

- **正常**：解析 JSON，從 `stats` 建立全局認知（total_cards、total_links、domains 分佈、last_updated），從 `notes` 掌握所有卡片的 title/type/status/domain/summary，從 `projects` 和 `areas` 掌握行動層狀態
- **檔案不存在**：告知使用者「索引檔案不存在」，提議從 `Cards/` 和 `Sources/` 掃描重建索引（調用 `twinmind:review`）
- **JSON 損壞**（解析失敗）：告知使用者「索引檔案已損壞，無法解析」，提議從檔案系統重建索引（調用 `twinmind:review`）

**Step 2 — 讀取設定**

讀取 `TwinMind.md` frontmatter 取得系統設定：`vault_name`、`locale`、`moc_threshold_create`、`moc_threshold_split`、`recent_cards_count`、`default_card_type`、`domains`。

**Step 3 — 就緒**

啟動完成後，所有使用者輸入皆經由「意圖解析」層路由。非知識庫相關輸入（如程式碼問題、閒聊）則 bypass 意圖路由，以一般 Claude Code 模式回應。

**Step 4 — 衍生檔案新鮮度檢查**

比較 `vault-index.json` 的 `stats.last_updated` 與 `<vault_dir>/Home.md` 及 `<vault_dir>/PARA/Dashboard.md` 的檔案修改時間。若任一衍生檔案的修改時間落後 `last_updated` 超過 60 秒，執行補償性 post-op（透過 Bash tool 調用 `node .claude/twinmind/bin/tm-post-op.mjs`）：

- Home.md 過期 → `--layer knowledge`
- Dashboard.md 過期 → `--layer action`
- 兩者都過期 → `--layer both`

此檢查用於偵測前次 session 的 post-op 是否未完成。若兩者都在 60 秒內，不觸發任何補償。

**Step 5 — 行動層掃描**

從 `vault-index.json` 讀取以下資料：

- `inbox` 中 `status == "pending"` 的項目數量
- pending 且 `created` 距今超過 `TwinMind.md` 的 `memo_stale_days`（預設 7 天）的 memo 數
- `standalone_actions` 中 `status == "active"` 且建立超過 `action_stale_days`（預設 14 天）的 action 數
- `projects` 中 `status == "active"` 且 deadline 在 7 天內的專案數

若任一 > 0，主動提示使用者，例如：

```text
📥 3 個 inbox 待處理（1 個超過 7 天）
⏰ 1 個專案本週到期（發布 TwinMind, 04-10）
要先 triage 嗎？
```

此掃描僅為提示，使用者可拒絕 triage。若全部為 0，不輸出任何提示。

## 意圖解析（Intent Routing）

### 意圖類別

每次使用者輸入，AI 分類為以下九大意圖之一：

| 意圖 | 定義 | 路由至 |
|------|------|--------|
| `CAPTURE` | 提供明確知識、定義、來源引用，要記錄為卡片 | 卡片引擎 |
| `INBOX` | 模糊想法、片段、未成熟的 idea，需要孵化 | Inbox 引擎 |
| `ACTION` | 建立/完成/列出獨立行動（不隸屬專案） | Action 引擎 |
| `TASK` | 建立/完成/刪除獨立任務（生活雜務） | Task 引擎 |
| `PROJECT` | 專案操作：建立、暫停、恢復、完成、歸檔、紀錄進度、連結卡片、專案內 action/task | 專案引擎 |
| `AREA` | 建立/更新/停用持續關注領域，關聯 project/card | Area 引擎 |
| `QUERY` | 搜尋、列出、篩選或探索知識庫/行動層內容 | 索引引擎 |
| `REVIEW` | 知識庫維護：狀態摘要、索引驗證、MOC 回顧、seed 提醒、Inbox triage、Action 過期檢查 | 多引擎 |
| `CONNECT` | 明確要求在兩張卡片之間建立或移除連結 | 連結引擎 |

每次分類結果為且僅為一個類別（互斥）。

### 意圖分類規則載入

收到知識庫相關輸入時，AI **必須**先使用 Skill tool 調用 `twinmind:router` 載入完整的信號詞判斷模式、子意圖解析、分類優先序、複合意圖處理及模糊意圖 Fallback 規則，再進行意圖分類和 dispatch。首次載入後，同一 session 內不需重複調用。本文件的意圖類別表僅為速查參考，完整分類邏輯在 `twinmind:router` skill 中。

## Skill Dispatch

分類意圖後，AI 使用 Skill tool 調用對應的 `twinmind:*` skill。**自動 dispatch——不詢問使用者要調用哪個 skill。**

| 意圖 | Skill | post-op layer | Post-op 執行模式 | Link Inference 模式 |
|------|-------|---------------|-----------------|-------------------|
| `CAPTURE` | `twinmind:capture` | `knowledge` | Bash tool | Inline（main agent） |
| `INBOX` | `twinmind:inbox` | `action`（升格為 Card 時用 `both`） | Bash tool | Inline（升格為 Card 時） |
| `ACTION` | `twinmind:action` | `action` | Bash tool | — |
| `TASK` | `twinmind:task` | `action` | Bash tool | — |
| `PROJECT` | `twinmind:project` | `action` | Bash tool | — |
| `AREA` | `twinmind:area` | `action` | Bash tool | — |
| `QUERY` | `twinmind:query` | 不需要（純唯讀） | — | — |
| `REVIEW` | `twinmind:review` | 僅索引修復/重建後（`both`） | Bash tool | — |
| `CONNECT` | `twinmind:connect` | `knowledge` | Bash tool | — |

### Plan Mode 檢查

Vault 寫入操作（twinmind:capture、twinmind:connect、twinmind:inbox、twinmind:action、twinmind:task、twinmind:project、twinmind:area）執行前，意圖路由層 SHALL 檢查 plan mode 是否 active。若 plan mode active：

- 告知使用者 vault 操作需要退出 plan mode，提議退出
- 不嘗試執行寫入操作
- 唯讀操作（twinmind:query）不受影響，可正常執行

Plan mode 下不執行 post-op Bash 調用。改為記錄 post-op payload，待 plan mode 退出後由 main agent 執行。

### Post-op 規則

狀態變更操作完成後，對應 skill 透過 **Bash tool** 執行 `node .claude/twinmind/bin/tm-post-op.mjs` 觸發 post-op pipeline。Main agent 等待腳本完成（同步執行），腳本輸出 `post-op done | ...` 後再回應使用者。

Post-op 腳本根據 `--layer` 參數執行不同收尾步驟：

| layer | Changelog | MOC 檢查 | Home.md | Dashboard |
|-------|:---------:|:--------:|:-------:|:---------:|
| `knowledge` | ✓ | ✓ | ✓ | ✗ |
| `action` | ✓ | ✗ | ✗ | ✓ |
| `both` | ✓ | ✓ | ✓ | ✓ |

未指定 layer 時預設為 `both`。

Changelog 採用月度切檔（`<vault_dir>/System/changelog-YYYY-MM.md`）+ append-only 尾部追加。`<vault_dir>/System/changelog.md` 為索引頁，列出各月連結（newest-first）。腳本 append 時不讀取既有 changelog 內容。

### Subagent 委派協定

#### 執行模式

- **Background subagent**（非 post-op 任務）：透過 Agent tool 的 `run_in_background: true` 啟動。Main agent 不等待結果，立即回應使用者。
- **Post-op**：透過 **Bash tool** 執行 `node .claude/twinmind/bin/tm-post-op.mjs --layer <layer> --event '<JSON>'`。腳本同步執行，main agent 等待 exit code 再回應使用者。不使用 Agent tool。
- **Link inference**：由 main agent inline 執行，不使用 subagent。Main agent 利用 session 啟動時已載入 context 的 vault-index.json notes 資料直接進行語意比對。

#### Prompt Payload 格式

每個非 post-op subagent 都接收結構化 prompt，包含：

1. **Role declaration** — 一行說明 subagent 的任務目的
2. **Input payload** — JSON block，包含 subagent 所需的所有 context，必含 `task` 欄位
3. **Execution steps** — subagent 需執行的具體步驟
4. **Output format** — subagent 回傳訊息的格式

Payload 不應包含 post-op 專屬欄位——post-op 腳本直接從檔案系統讀取 `vault-index.json` 和 `TwinMind.md`。

#### 回傳訊息格式（非 post-op subagent）

**成功：** `<task> 完成 | <key=value 摘要>`
**失敗：** `<task> 失敗 | step=<失敗步驟> | error: <錯誤描述>`

Main agent 解析回傳訊息判斷成功或失敗。回傳訊息不包含 file content，僅狀態摘要。

#### 寫入順序保證

**Main agent 必須完成 vault-index.json 更新後，才能執行 post-op 腳本。** 確保腳本讀到一致的狀態。

序列：

1. Main agent 寫入主要 artifact（卡片、專案檔案等）
2. Main agent 執行程式化索引更新（Bash tool，`node .claude/twinmind/bin/tm-update-index.mjs <command> '<JSON>'`）
3. Main agent 執行 `node .claude/twinmind/bin/tm-post-op.mjs`（Bash tool，同步）
4. Main agent 回應使用者

卡片 CRUD 操作（建立、更新、刪除）和連結建立，**不得直接使用 Edit 或 Write tool 修改 vault-index.json**，一律透過 `.claude/twinmind/bin/tm-update-index.mjs` 處理。腳本原子完成所有必要的 notes/stats 更新。

**Post-op 腳本不寫入 vault-index.json。** 腳本僅讀取 vault-index.json，寫入 changelog/MOC/Home/Dashboard。

#### 錯誤處理

- **Post-op 腳本失敗**：腳本 exit code 1 並輸出 `post-op failed | step=<step> | error: <描述>` 至 stderr。Main agent 讀取 exit code，若失敗則在當前回應中告知使用者。不自動重試。
- **非 post-op background subagent 失敗**：subagent 自行讀取 hook error 並重試一次。重試仍失敗則回傳失敗訊息，main agent 在下次與使用者互動時告知。
- **Inline link inference 失敗**：main agent 跳過連結推理，Connections 保持 `（尚無連結）`，告知使用者自動連結建議暫時不可用。

### Hook 自動驗證

PostToolUse hooks 會在以下寫入操作後自動執行驗證：

- **`Cards/*.md` / `Sources/*.md` 寫入後** → 驗證 frontmatter 必填欄位和 enum 合法值
- **`PARA/Inbox/*.md` 寫入後** → 驗證 inbox item frontmatter（type/status enum）
- **`PARA/Actions/*.md` 寫入後** → 驗證 standalone action frontmatter（id/title/status/created）
- **`PARA/Projects/*/actions.md|tasks.md` 寫入後** → 驗證 project 欄位匹配目錄名
- **`vault-index.json` 寫入後** → 驗證 JSON 合法性和九項一致性不變式（total_cards、total_links、雙向連結、domain 計數、version、inbox count、actions count、standalone tasks count）

驗證失敗會回報錯誤信號（exit code 2），但檔案已被寫入（PostToolUse 是事後偵測控制，非事前攔截）。**AI 收到 hook 失敗時，須立即讀回檔案確認實際狀態，再以單次 corrective Edit 修正不一致。** AI 不需手動執行一致性驗證——hooks 已自動處理。

## Markdown 注意事項

- 在 **Markdown body text** 中，非 tag 用途的 `#` 需跳脫為 `\#` 或用 backtick 包裹。JSON 檔案和 YAML frontmatter 中，`#` 不需跳脫。常見非 tag 場景：程式語言名稱（`C#`、`F#`）、編號（`#1`、`#42`）、issue/PR 引用（`#123`）。
