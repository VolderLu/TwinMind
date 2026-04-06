# TwinMind 知識庫操作指南

本專案是 AI 主導的知識管理系統。使用者透過 terminal 自然語言輸入，AI 全權處理建卡、更新、刪除、連結、MOC 等操作。Obsidian 僅做唯讀瀏覽。

各引擎的詳細操作程序已模組化為 `tm:*` skills，本文件僅負責 Session 啟動和意圖路由。

## Session 啟動

每次 session 開始且使用者進行知識庫相關互動時，AI 必須在執行任何 vault 操作前完成以下啟動程序：

**Step 1 — 讀取索引**

讀取 `vault/System/vault-index.json`：

- **正常**：解析 JSON，從 `stats` 建立全局認知（total_cards、total_links、domains 分佈、last_updated），從 `notes` 掌握所有卡片的 title/type/status/domain/summary，從 `projects` 和 `areas` 掌握行動層狀態
- **檔案不存在**：告知使用者「索引檔案不存在」，提議從 `Cards/` 和 `Sources/` 掃描重建索引（調用 `tm:review`）
- **JSON 損壞**（解析失敗）：告知使用者「索引檔案已損壞，無法解析」，提議從檔案系統重建索引（調用 `tm:review`）

**Step 2 — 讀取設定**

讀取 `vault/System/config.md` 取得系統設定：`vault_name`、`locale`、`moc_threshold_create`、`moc_threshold_split`、`recent_cards_count`、`default_card_type`、`domains`。

**Step 3 — 就緒**

啟動完成後，所有使用者輸入皆經由「意圖解析」層路由。非知識庫相關輸入（如程式碼問題、閒聊）則 bypass 意圖路由，以一般 Claude Code 模式回應。

**Step 4 — 衍生檔案新鮮度檢查**

比較 `vault-index.json` 的 `stats.last_updated` 與 `vault/Home.md` 及 `vault/PARA/Dashboard.md` 的檔案修改時間。若任一衍生檔案的修改時間落後 `last_updated` 超過 60 秒，啟動 background subagent 執行補償性 post-op：

- Home.md 過期 → `layer: "knowledge"`
- Dashboard.md 過期 → `layer: "action"`
- 兩者都過期 → `layer: "both"`

此檢查用於偵測前次 session 的 background post-op 是否未完成（如 subagent timeout 或錯誤）。若兩者都在 60 秒內，不觸發任何補償。

**Step 5 — 行動層掃描**

從 `vault-index.json` 讀取以下資料：

- `inbox` 中 `status == "pending"` 的項目數量
- pending 且 `created` 距今超過 `config.md` 的 `memo_stale_days`（預設 7 天）的 memo 數
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

### 信號詞與判斷模式

#### CAPTURE 信號

觸發條件（符合任一即分類為 CAPTURE）：

1. **宣告式知識**：事實陳述、定義、原理（如「X 是 Y」「X 的原理是...」）
2. **個人洞見**：跨域觀察、類比、反思（如「我覺得 X 跟 Y 很像」「X 讓我想到...」）
3. **來源引用**：明確提及書/文章/影片/URL（如「我在讀《...》」「這篇文章說...」）
4. **開放問題**：想記錄的探索性問題（如「量子計算會怎麼影響加密？」，無搜尋上下文）
5. **明確建卡指令**：「記下」「建卡」「create card」「new note」

模糊輸入預設：當輸入為無明確搜尋/專案/連結上下文的**明確知識陳述**時，預設為 CAPTURE。若想法模糊不成熟，改為 INBOX。

#### INBOX 信號

觸發條件（符合任一即分類為 INBOX）：

1. **模糊片段**：「突然想到...」「隨手記一下」「筆記一下」
2. **未成熟想法**：有方向但不夠具體（如「睡眠跟創造力好像蠻有趣的」）
3. **明確 Inbox 操作**：「inbox」「triage」「升格」「promote」「dismiss」「清理 inbox」「待處理」
4. **無法明確分類的輸入**：不是知識、不是雜務、不是行動、不是專案

注意：已經夠明確的輸入 bypass Inbox——明確知識 → CAPTURE，明確雜務 → TASK，明確行動 → ACTION。

#### QUERY 信號

觸發條件（符合任一即分類為 QUERY）：

1. **搜尋關鍵字**：「搜尋」「找」「search」「find」「有沒有」
2. **列出/篩選**：「列出」「list」「哪些」「所有的」
3. **計數/統計**：「有幾張」「how many」「各領域」「統計」
4. **探索**：「跟 X 相關的」「about X」「關於」

#### PROJECT 信號

觸發條件（符合任一即分類為 PROJECT）：

1. **生命週期動詞**：「建立專案」「create project」「暫停」「pause」「恢復」「resume」「完成」「complete」「歸檔」「archive」
2. **進度紀錄**：「log for」「進度」「紀錄」
3. **專案查詢**：「list projects」「列出專案」「show me `<project-name>`」「專案狀況」
4. **卡片-專案連結**：「link ... to project」「連結到專案」「unlink」「取消連結」

注意：卡片連結至**專案**歸類為 PROJECT，不是 CONNECT。提及專案名稱的 action/task 操作也歸 PROJECT（專案內由 tm:project 處理）。

#### ACTION 信號

觸發條件（符合任一即分類為 ACTION）：

1. **建立行動**：「建立行動」「create action」「新增 action」「開始做 X」（有明確範圍但不提及專案）
2. **完成行動**：「X action 完成了」「action done」「做完了 X」
3. **列出行動**：「列出 actions」「list actions」「有哪些行動」
4. **升格行動**：「把 X 升格為專案」「promote to project」

排除：提及專案名稱 → 歸 PROJECT。

#### TASK 信號

觸發條件（符合任一即分類為 TASK）：

1. **明確雜務**：動詞開頭的短句（「買牛奶」「繳電費」「回覆 email」）
2. **建立任務**：「加個待辦」「add task」「新增 task」
3. **完成任務**：「X done」「完成 task」「X 做好了」
4. **列出任務**：「列出 tasks」「list tasks」「待辦清單」
5. **刪除任務**：「不需要 X 了」「刪除 task」「delete task」

排除：提及專案名稱或 action 名稱 → 歸 PROJECT 或 ACTION。

#### AREA 信號

觸發條件（符合任一即分類為 AREA）：

1. **建立領域**：「建立領域」「create area」「新增關注領域」
2. **管理領域**：「停用 area」「deactivate」「重新啟用」「reactivate」
3. **關聯操作**：「關聯到 area」「link to area」「把 X 加到 Y 領域」
4. **列出領域**：「列出 areas」「list areas」「關注領域」

#### REVIEW 信號

觸發條件（符合任一即分類為 REVIEW）：

1. **Vault 狀態**：「vault status」「知識庫狀況」「目前狀態」
2. **索引操作**：「verify index」「檢查索引」「rebuild index」「重建索引」
3. **MOC 維護**：「更新 MOC」「review MOC」「Atlas 需要整理嗎」
4. **Seed 回顧**：「有哪些 seed 需要發展」「review seeds」
5. **Dashboard**：「更新 Home」「refresh dashboard」

#### CONNECT 信號

觸發條件（**必須**明確提及兩張卡片且要求連結操作）：

1. **建立連結**：「把 X 和 Y 連起來」「link X to Y」「connect X and Y」
2. **移除連結**：「移除 X 和 Y 的連結」「unlink X from Y」「disconnect」
3. **指定關係類型**：「X 跟 Y 的關係是 analogous」

排除規則：

- 僅提及一張卡片 → 可能是 QUERY 或 CAPTURE，不歸類為 CONNECT
- 目標為專案（非卡片）→ 歸類為 PROJECT

#### 非知識庫輸入 Bypass

當輸入與知識庫操作無關時（如閒聊、程式碼問題、系統指令），AI 不進入意圖路由，以一般 Claude Code 模式回應。

### 子意圖解析

每個意圖類別內，AI 根據輸入內容判斷具體操作（子意圖）：

**CAPTURE：**

- 建立新卡片（預設）
- 更新既有卡片（使用者指名既有卡片並提供修改內容）
- 刪除卡片（使用者明確要求刪除）

**INBOX：**

- 建立 memo / idea
- 升格（7 種路徑：→ Card / Action / Task / Project 等）
- 捨棄
- 列出 pending 項目

**ACTION：**

- 建立獨立行動
- 完成獨立行動（含反思鉤）
- 列出獨立行動
- 管理 action 內 tasks
- 升格為專案

**TASK：**

- 新增獨立任務
- 完成獨立任務
- 刪除獨立任務
- 列出獨立任務

**PROJECT：**

- 建立 / 暫停 / 恢復 / 完成（含反思鉤）/ 歸檔專案
- 新增進度紀錄
- 連結或取消連結卡片至專案
- 專案內 action CRUD（新增/完成/列出）
- 專案內 task CRUD（新增/完成/刪除）

**AREA：**

- 建立 / 更新 / 停用 / 重新啟用 Area
- 關聯/取消關聯 Project 或 Card

**QUERY：**

- 關鍵字搜尋
- 依 domain 篩選
- 依 type / status 篩選
- 領域統計摘要
- 專案列表 / 篩選 / 詳情
- Inbox / Action / Task / Area 查詢

**REVIEW：**

- 知識庫摘要（Vault Summary）
- 索引驗證
- 索引重建
- MOC 回顧
- Seed 回顧
- Dashboard 更新
- Inbox triage 過期提醒
- Action 過期檢查

**CONNECT：**

- 建立連結（可含關係類型）
- 移除連結

### 分類優先序

當輸入可能匹配多個意圖時，依以下優先序判斷（第一個匹配即為結果）：

1. 明確知識/定義 → `CAPTURE`
2. 明確專案操作（提及專案名稱）→ `PROJECT`
3. 明確行動操作 → `ACTION`
4. 明確任務/雜務 → `TASK`
5. 明確 Area 操作 → `AREA`
6. 模糊想法/片段 → `INBOX`
7. 搜尋/查詢 → `QUERY`
8. 維護操作 → `REVIEW`
9. 明確連結操作 → `CONNECT`

### 複合意圖處理

當單一輸入包含多個意圖時，AI 依以下優先序拆解並依序執行：

1. `CAPTURE` — 先記錄知識，避免資料遺失
2. `CONNECT` — 趁上下文新鮮建立連結
3. `PROJECT` — 更新專案狀態
4. `ACTION` — 處理行動
5. `TASK` — 處理任務
6. `AREA` — 更新領域
7. `INBOX` — 捕捉模糊想法
8. `QUERY` — 回答查詢
9. `REVIEW` — 維護任務最後

執行前宣告順序（如「先建立卡片，再連結至專案」）。

### 模糊意圖 Fallback

當 AI 無法確定意圖類別時，依以下規則處理：

1. 若輸入為明確知識陳述或新資訊 → 預設 `CAPTURE`
2. 若輸入為模糊想法、片段、未成熟 idea → 預設 `INBOX`
3. 若輸入針對既有內容提問 → 預設 `QUERY`
4. 若以上皆不適用 → 詢問使用者釐清（如「你想要記錄這個想法、加入 inbox 孵化，還是搜尋相關筆記？」）

AI 不得忽略模糊輸入。

## Skill Dispatch

分類意圖後，AI 使用 Skill tool 調用對應的 `tm:*` skill。**自動 dispatch——不詢問使用者要調用哪個 skill。**

| 意圖 | Skill | post-op layer | Post-op 執行模式 | Link Inference 模式 |
|------|-------|---------------|-----------------|-------------------|
| `CAPTURE` | `tm:capture` | `knowledge` | Background subagent | Inline（main agent） |
| `INBOX` | `tm:inbox` | `action`（升格為 Card 時用 `both`） | Background subagent | Inline（升格為 Card 時） |
| `ACTION` | `tm:action` | `action` | Background subagent | — |
| `TASK` | `tm:task` | `action` | Background subagent | — |
| `PROJECT` | `tm:project` | `action` | Background subagent | — |
| `AREA` | `tm:area` | `action` | Background subagent | — |
| `QUERY` | `tm:query` | 不需要（純唯讀） | — | — |
| `REVIEW` | `tm:review` | 僅索引修復/重建後（`both`） | Background subagent | — |
| `CONNECT` | `tm:connect` | `knowledge` | Background subagent | — |

### Post-op 規則

狀態變更操作完成後，對應 skill **不再透過 Skill tool 調用 `/tm:post-op`**，改為透過 Agent tool 啟動 background subagent 執行 post-op pipeline。Main agent 在啟動 subagent 後立即回應使用者，不需等待 post-op 完成。

Post-op subagent 根據 layer 參數執行不同收尾步驟：

| layer | Changelog | MOC 檢查 | Home.md | Dashboard |
|-------|:---------:|:--------:|:-------:|:---------:|
| `knowledge` | ✓ | ✓ | ✓ | ✗ |
| `action` | ✓ | ✗ | ✗ | ✓ |
| `both` | ✓ | ✓ | ✓ | ✓ |

未指定 layer 時預設為 `both`。

Changelog 採用月度切檔（`vault/System/changelog-YYYY-MM.md`）+ append-only 尾部追加。`vault/System/changelog.md` 為索引頁，列出各月連結（newest-first）。Post-op subagent 寫入 changelog 時不讀取既有內容。

### Subagent 委派協定

#### 執行模式

- **Background subagent**（post-op）：透過 Agent tool 的 `run_in_background: true` 啟動。Main agent 不等待結果，立即回應使用者。適用於 changelog、MOC、Home.md、Dashboard.md 等確定性重建操作。
- **Link inference**：由 main agent inline 執行，不使用 subagent。Main agent 利用 session 啟動時已載入 context 的 vault-index.json notes 資料直接進行語意比對。

#### Prompt Payload 格式

每個 subagent 都接收結構化 prompt，包含：

**Post-op payload：**

```json
{
  "task": "post-op",
  "layer": "knowledge | action | both",
  "event_type": "CARD_CREATED",
  "event_context": {
    "card_id": "20260405130000",
    "card_title": "Rust Ownership",
    "card_path": "Cards/Rust-Ownership.md",
    "domains": ["technology"],
    "affected_project": null
  },
  "config": {
    "moc_threshold_create": 5,
    "moc_threshold_split": 20,
    "recent_cards_count": 5,
    "vault_name": "TwinMind"
  },
  "domain_counts": { "technology": 5 },
  "total_cards": 22,
  "recent_notes": [
    { "title": "...", "path": "...", "created": "2026-04-05", "status": "seed", "type": "concept", "domain": ["technology"] }
  ]
}
```

`config`/`domain_counts`/`total_cards`/`recent_notes` 由 main agent 從 context 中���有的 config.md 和 vault-index.json 資料填充。Subagent 使用這些欄位，不再讀取 `config.md`（MOC 門檻）和 `vault-index.json`（domain 統計、recent cards）。

#### 回傳訊息格式

**成功：** `<task> 完成 | <key=value 摘要>`
**失敗：** `<task> 失敗 | step=<失敗步驟> | error: <錯誤描述>`

Main agent 解析回傳訊息判斷成功或失敗。回傳訊息不包含 file content，僅狀態摘要。

#### 寫入順序保證

**Main agent 必須完成所有 vault-index.json 寫入後，才能啟動 subagent。** 確保 subagent 讀到一致的狀態。

序列：

1. Main agent 寫入主要 artifact（卡片、專案檔案等）
2. Main agent 更新 vault-index.json
3. Main agent 回應使用者
4. Main agent 啟動 background subagent（subagent 只讀 vault-index.json，寫入 changelog/MOC/Home/Dashboard）

**Post-op subagent 不寫入 vault-index.json。** MOC 變更透過 return message 回報。

#### 錯誤處理

- **Background subagent 失敗**：subagent 自行讀取 hook error 並重試一次。重試仍失敗則回傳失敗訊息，main agent 在下次與使用者互動時告知。
- **Inline link inference 失敗**：main agent 跳過連結推理，Connections 保持 `（尚無連結）`，告知使用者自動連結建議暫時不可用。

### Hook 自動驗證

PostToolUse hooks 會在以下寫入操作後自動執行驗證：

- **`Cards/*.md` / `Sources/*.md` 寫入後** → 驗證 frontmatter 必填欄位和 enum 合法值
- **`PARA/Inbox/*.md` 寫入後** → 驗證 inbox item frontmatter（type/status enum）
- **`PARA/Actions/*.md` 寫入後** → 驗證 standalone action frontmatter（id/title/status/created）
- **`PARA/Projects/*/actions.md|tasks.md` 寫入後** → 驗證 project 欄位匹配目錄名
- **`vault-index.json` 寫入後** → 驗證 JSON 合法性和九項一致性不變式（total_cards、total_links、雙向連結、domain 計數、version、inbox count、actions count、standalone tasks count）

驗證失敗會 block 寫入並回報具體錯誤。**AI 不需手動執行一致性驗證——hooks 已自動處理。**

## Markdown 注意事項

- **連結偏好：** 使用 `[title](url)` 格式。依以下優先序決定 title：
  1. 內文已提供標題 → 直接使用
  2. 執行 `node scripts/fetch-title.mjs <url1> [url2] ...` 取得實際標題
  3. 從 URL slug 推測並翻譯為 locale 語言（如 `/my-great-post` → `我的好文章`）
  4. 以上皆不可行 → 使用純連結 `<url>`
- **Tag 跳脫：** `#word` 在 Obsidian 中為 tag。非 tag 用途的 `#` 需跳脫為 `\#` 或用 backtick 包裹。常見非 tag 場景：程式語言名稱（`C#`、`F#`）、編號（`#1`、`#42`）、issue/PR 引用（`#123`）。
