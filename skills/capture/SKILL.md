---
name: capture
description: "TwinMind card engine. Use this whenever the user shares a thought, idea, knowledge, question, or source reference that should be captured as a card. Also handles card updates and deletions. Covers the full lifecycle: type classification, duplicate detection, card creation, automatic link inference to existing cards, and index updates. If the user says something that looks like knowledge worth remembering — this is the skill to use. For vague or unformed thoughts, route to twinmind:inbox instead."
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

捕捉使用者的想法、知識、問題或來源引用，轉化為知識卡片。建卡後自動尋找並建立與既有卡片的連結。

一致性驗證由 PostToolUse hooks 自動處理，不需手動檢查。完成操作後透過 Bash tool 執行 `node .claude/twinmind/bin/tm-post-op.mjs` 觸發 post-op pipeline（changelog、MOC、Home 更新）。連結推理由 main agent inline 執行（不使用 subagent）。

## 建立卡片（CARD_CREATED）

### Step 1 — 類型分類

| 類型 | 判斷依據 | 範例 |
|------|----------|------|
| `concept` | 知識點、定義、原理 | 「CAP 定理說分散式系統只能三選二」 |
| `insight` | 跨域觀察、個人體悟、類比 | 「CAP 定理跟創業三難抉擇的邏輯很像」 |
| `source` | 明確引用書/文章/影片/URL | 「我在讀《DDIA》第五章講 replication」 |
| `question` | 開放式問題、待探索主題 | 「量子計算會怎麼影響加密？」 |

無法確定時用 `config.md` 的 `default_card_type`（預設 `concept`）。

### Step 2 — 重複偵測

讀取 `vault-index.json` 的 `notes`，比對 title/summary 是否與既有卡片語意等價（含跨語言，如 "Rust Ownership" vs "Rust 所有權機制"）。

- 偵測到重複 → 回報既有卡片，詢問「合併」或「建立新卡片」
- 無重複 → 繼續

### Step 3 — 生成 ID 與檔名

- **ID**：`YYYYMMDDHHmmss` 格式（當前時間）
- **Slug**：title 轉 kebab-case 英文（如 "Rust 所有權機制" → `rust-ownership`）
- **路徑**：type 為 `source` → `Sources/<slug>.md`，其餘 → `Cards/<slug>.md`
- **衝突**：檔案已存在則加數字後綴（`rust-ownership-2.md`）

### Step 4 — 生成 Frontmatter

```yaml
---
id: "<YYYYMMDDHHmmss>"
title: "<人類可讀標題>"
type: <concept|insight|source|question>
status: seed
domain: [<AI 分類的領域標籤>]
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
confidence: medium
source: "<來源：使用者輸入 / URL / 書名>"
related_projects: []
---
```

10 個必填欄位，全部要有值。新卡片固定 `status: seed`、`confidence: medium`。

### Step 4.5 — URL 預處理

若使用者輸入包含外部 URL（HTTP/HTTPS），在撰寫 body 前批次取得標題：

1. 掃描使用者原始輸入中所有外部 URL（行內、腳注、參考清單，不含 wiki-link），提取唯一值
2. 若無 URL → 跳過此步驟
3. 已有使用者標題的 URL 直接寫入對照表；其餘批次執行：`node .claude/twinmind/bin/tm-fetch-title.mjs <url1> [url2] ...`
4. 合併結果建立 url→title 對照表，優先序：使用者標題 > fetch 標題 > slug 推測（翻譯為 locale 語言，前綴 `~` 標記） > 裸連結 `<url>`

對照表供 Step 5 body 撰寫使用。Fetch 失敗不阻擋建卡流程。

### Step 5 — 寫入卡片檔案

```markdown
---
<frontmatter>
---

# <title>

<使用者輸入重整為原子化筆記內容>

## Connections

（尚無連結）
```

### Step 5.5 — 連結推理（Inline 執行）

建卡的核心增值步驟——自動發現新卡片與既有知識的關聯。Main agent 直接使用 session 啟動時已載入 context 的 vault-index.json notes 資料執行語意比對，**不啟動 foreground subagent**。

**執行流程：**

1. 從 context 中已有的 vault-index.json `notes` 資料，遍歷所有既有卡片
2. 比對新卡片的 `title`、`summary`、`domain` 與每張既有卡片的對應欄位
3. 識別語意相關的卡片（最多 5 筆），排序：title 相似度 > summary 重疊 > 共享 domain
4. 對每筆建議判斷關係類型（is-part-of ⊂ / analogous ≈ / related ~ / inspires → / contradicts ⊕ / supports ⇒）
5. 根據使用者原始輸入上下文，決定採納哪些建議

**處理結果：**

- **有建議且採納**：對每筆採納的建議，依 `references/link-inference.md` 的「建立連結程序」執行雙向連結寫入
  - Connections 格式：`- <符號> [[<slug>|<title>]] — <一句話說明為何連結>`（slug 為目標卡片檔名，不含 `.md`）
- **無建議**：Connections 保持 `（尚無連結）`
- **索引資料異常**（如 notes 資料缺失或格式錯誤）：跳過連結推理，Connections 保持 `（尚無連結）`，告知使用者自動連結建議暫時不可用

若 vault 為空（`notes` 為空物件），跳過連結推理，直接保持 `（尚無連結）`。

### Step 6 — 更新索引（程式化 CLI）

透過 Bash tool 執行 `.claude/twinmind/bin/tm-update-index.mjs` 更新 `vault/System/vault-index.json`。**LLM 不得直接使用 Edit 或 Write tool 修改 vault-index.json。**

```bash
node .claude/twinmind/bin/tm-update-index.mjs add-card '{"id":"<ID>","title":"<title>","path":"<path>","type":"<type>","status":"seed","domain":["<domain>"],"summary":"<摘要>","links_to":["<Step 5.5 採納的目標 ID>"]}'
```

- `links_to` 為空陣列時仍需包含（`"links_to":[]`）
- 腳本自動處理：新增 notes 條目、雙向連結更新（targets 的 `linked_from`/`link_count`）、stats 更新（`total_cards`、`total_links`、`domains`、`last_updated`）
- 成功時 stdout 印出 `ok | add-card | id=<ID> title="<title>" links=<N>`
- 失敗時 stderr 印出 `error: <description>`，exit code 1

### Step 7 — 執行 post-op（Bash tool）

**寫入順序保證：** Step 6（索引更新）必須完成後才能執行 post-op。

透過 Bash tool 執行：

```bash
node .claude/twinmind/bin/tm-post-op.mjs --layer knowledge --event '{"event_type":"<CARD_CREATED|CARD_UPDATED|CARD_DELETED>","event_context":{"card_title":"<標題>","card_path":"<路徑>","domains":["<domain>"]}}'
```

腳本同步執行。exit code 0 表示成功（stdout 印出 `post-op done | ...`），exit code 1 表示失敗（stderr 印出 `post-op failed | step=... | error: ...`）。失敗時告知使用者錯誤內容。執行完成後再回應使用者。

## 更新卡片（CARD_UPDATED）

1. 從 `vault-index.json` 查找目標卡片（by title/keyword）
2. 讀取卡片 `.md` 檔案
3. 修改內容或 frontmatter（status, domain, confidence, body 等）
4. `updated` 設為當天日期。`id` 和 `created` 不得修改
5. 寫回檔案
6. 透過 Bash tool 執行程式化索引更新（**不得直接 Edit vault-index.json**）：

   ```bash
   node .claude/twinmind/bin/tm-update-index.mjs update-card '{"id":"<ID>","<field>":"<value>"}'
   ```

   payload 僅包含 `id` 和**實際變更的欄位**（title、type、status、domain、summary）。腳本自動處理 domain diff 計算（舊 domain -1 歸零刪 key、新 domain +1）和 `stats.last_updated` 更新。
7. 執行 post-op（Bash tool，`node .claude/twinmind/bin/tm-post-op.mjs --layer knowledge --event '...'`，event_type 為 `CARD_UPDATED`，event_context 含變更摘要）

## 刪除卡片（CARD_DELETED）

1. 從 `vault-index.json` 查找目標卡片
2. 找不到 → 回報「未找到匹配的卡片」
3. 找到後：
   a. 刪除卡片 `.md` 檔案
   b. 透過 Bash tool 執行程式化索引更新（**不得直接 Read/Write vault-index.json**）：

      ```bash
      node .claude/twinmind/bin/tm-update-index.mjs delete-card '{"id":"<ID>"}'
      ```

      腳本自動處理：移除 notes 條目、清理所有雙向連結引用（`links_to`/`linked_from`）、重算 `link_count`、重算 `stats.total_links`、更新 `stats.total_cards`/`stats.domains`/`stats.last_updated`
   c. 執行 post-op（Bash tool，`node .claude/twinmind/bin/tm-post-op.mjs --layer knowledge --event '...'`，event_type 為 `CARD_DELETED`，event_context 含被刪卡片 title/path/domains）
