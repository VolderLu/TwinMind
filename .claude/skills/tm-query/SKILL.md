---
name: tm-query
description: "TwinMind query engine: index queries, card recommendation"
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

TwinMind 查詢引擎。處理所有索引查詢和卡片推薦操作。

**本 skill 為唯讀操作，不修改任何檔案，不需調用 `/tm:post-op`。**

所有查詢操作皆從 `vault-index.json` 的記憶體內資料執行，不掃描檔案系統。

## 索引查詢

### 依 Domain 查詢

當使用者要求列出特定領域的卡片時（如「列出所有 technology 領域的卡片」）：

1. 從 `vault-index.json` 的 `notes` 遍歷所有條目
2. 篩選 `domain` 陣列包含指定 domain 的 notes
3. 若使用者指定多個 domain（如「technology 或 business」），使用 **OR 邏輯** — 只要 `domain` 包含任一指定值即匹配
4. 回傳每筆匹配結果的 `title`、`type`、`status`、`path`
5. 若無匹配：回報「該領域目前沒有卡片」

### 依 Type / Status 查詢

當使用者要求按類型或成熟度篩選卡片時（如「列出所有 seed 狀態的 concept」）：

1. 從 `vault-index.json` 的 `notes` 遍歷所有條目
2. 支援三種篩選模式：
   - **僅 type**：篩選 `type` 等於指定值（concept / insight / source / question）
   - **僅 status**：篩選 `status` 等於指定值（seed / growing / evergreen）
   - **type + status 組合**：使用 **AND 邏輯**，兩者皆須匹配
3. 回傳每筆匹配結果的 `title`、`type`、`status`、`path`
4. 若無匹配：回報「沒有符合條件的卡片」

### 依關鍵字查詢

當使用者以關鍵字搜尋卡片時（如「搜尋跟 Rust 相關的筆記」）：

1. 從 `vault-index.json` 的 `notes` 遍歷所有條目
2. 將關鍵字與每筆 note 的 `title` 和 `summary` 進行比對：
   - 不分大小寫（case-insensitive）
   - 支援部分字串匹配（partial match）
3. 結果排序：`title` 匹配的排在前面，僅 `summary` 匹配的排在後面
4. 回傳每筆匹配結果的 `title`、`type`、`status`、`path`、`summary`
5. 若無匹配：回報「未找到與該關鍵字相關的筆記」

### 領域統計摘要

當使用者詢問領域分佈（如「各領域有多少卡片？」）時：

1. 從 `vault-index.json` 的 `stats.domains` 取得所有 domain 與計數
2. 依計數降序排列
3. 呈現每個 domain 名稱及其卡片數，末尾附上 `stats.total_cards` 總數
4. 若 `stats.domains` 為空物件：回報「目前尚無任何領域分類」

## 推薦引擎（Card Recommendation）

當使用者要求推薦相關卡片時（如「跟 CAP 定理相關的卡片有哪些？」「有沒有跟記憶體管理相關的筆記？」），AI 執行以下步驟：

**Step 1 — 判斷查詢來源**

接收使用者的卡片 title 或自然語言描述作為查詢輸入。

- 若輸入精確匹配 `vault-index.json` 中某筆 note 的 `title` → 以該卡片為查詢錨點，記錄其 ID（用於自我排除和連結標示）
- 若輸入不精確匹配任何 title → 視為語意查詢，直接比對所有 notes

**Step 2 — 語意比對**

遍歷 `vault-index.json` 中所有 `notes`，對每筆 note 進行語意比對：

1. 將查詢輸入與每筆 note 的 `title`、`summary`、`domain` 進行 AI 語意比較
2. 判斷是否存在語意關聯（概念重疊、主題相關、跨域類比等）
3. 按相關性排序：title 相似度 > summary 內容重疊 > 共享 domain 數量

**Step 3 — 自我排除**

若 Step 1 確認查詢精確匹配某既有卡片，從比對結果中排除該卡片本身。

**Step 4 — 已連結標示**

若 Step 1 確認了查詢錨點卡片，對每筆推薦結果檢查：

- 該推薦卡片的 ID 是否存在於錨點卡片的 `links_to` 或 `linked_from` 中
- 若存在：讀取對應卡片的 `## Connections` 區塊，找出關係類型符號
- 在結果中附加標示，如「已連結（≈ analogous）」

**Step 5 — 回傳結果**

取排序後的前 5 筆結果，每筆包含：

| 欄位 | 說明 |
|------|------|
| title | 卡片標題 |
| type | 卡片類型 |
| status | 成熟度 |
| path | 檔案路徑 |
| reason | 一句話說明為何相關 |
| linked | （選填）已連結標示，含關係類型符號 |

**邊界情況：**

- **Vault 為空**（`notes` 為空物件）：回報「知識庫尚無卡片」
- **無相關結果**：回報「未找到相關卡片」

## 行動層查詢

所有行動層查詢從 `vault-index.json` 讀取，不掃描檔案。

### Inbox 查詢

當使用者詢問 Inbox 狀態時（如「inbox 有什麼待處理」「列出 inbox」）：

1. 從 `inbox` 篩選符合條件的項目（預設 `status == "pending"`）
2. 按 `created` 降序排列
3. 顯示 type（📝 memo / 💡 idea）、text、created、status
4. 空態：「Inbox 是空的」

### Action 查詢

當使用者詢問 Actions 時（如「列出 actions」「有哪些行動」）：

1. 從 `standalone_actions` 篩選（預設 `status == "active"`，可指定 all/done）
2. 顯示 title、status、tasks（done/total）
3. 空態：「目前沒有獨立行動」

### Task 查詢

當使用者詢問獨立 Tasks 時（如「列出 tasks」「待辦清單」）：

1. 從 `standalone_tasks` 讀取
2. 分 Active / Done 顯示
3. 空態：「目前沒有獨立任務」

### Area 查詢

當使用者詢問 Areas 時（如「列出 areas」「關注領域」）：

1. 從 `areas` 讀取，按 status 分組（active / inactive）
2. 顯示 name、status、related_projects 數、related_cards 數
3. 空態：「目前沒有關注領域」

### 專案內 Action/Task 查詢

當使用者詢問特定專案的 actions 或 tasks 時（如「build-blog 的 actions」）：

1. 從 `projects[name].actions` 讀取 action 列表
2. 從 `projects[name].tasks_total` / `tasks_done` 讀取統計
3. 若需詳細內容，讀取 `PARA/Projects/<name>/actions.md` 或 `tasks.md`
