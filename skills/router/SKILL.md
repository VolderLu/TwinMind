---
name: router
description: "Classifies user knowledge-base input into one of 9 intent categories (capture, inbox, query, project, action, task, area, review, connect) using signal words, priority rules, compound intent handling, and fuzzy fallback matching. Invoke BEFORE dispatching to any twinmind:* skill when the user provides knowledge-base input. Do NOT skip this step — the session startup skeleton only has a summary table; this skill has the complete rules needed for accurate classification."
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

本 skill 包含完整的意圖分類規則。Session 啟動時注入的 `router-prompt.md` 只有意圖類別速查表；AI 必須在 session 中首次處理知識庫輸入前調用本 skill 載入完整分類規則，再決定 dispatch 至哪個 `twinmind:*` skill。同一 session 內不需重複調用。

## 信號詞與判斷模式

### CAPTURE 信號

觸發條件（符合任一即分類為 CAPTURE）：

1. **宣告式知識** — 事實陳述、定義、原理：「X 是 Y」「X 的原理是…」
2. **個人洞見** — 跨域觀察、類比、反思：「我覺得 X 跟 Y 很像」「X 讓我想到…」
3. **來源引用** — 明確提及書/文章/影片/URL：「我在讀《…》」「這篇文章說…」
4. **開放問題** — 想記錄的探索性問題（無搜尋上下文）：「量子計算會怎麼影響加密？」
5. **明確建卡指令** — 記下, 建卡, create card, new note

模糊輸入預設：無明確搜尋/專案/連結上下文的**明確知識陳述** → CAPTURE。想法模糊不成熟 → INBOX。

### INBOX 信號

觸發條件（符合任一即分類為 INBOX）：

1. **模糊片段** — 突然想到…, 隨手記一下, 筆記一下
2. **未成熟想法** — 有方向但不夠具體：「睡眠跟創造力好像蠻有趣的」
3. **明確 Inbox 操作** — inbox, triage, 升格, promote, dismiss, 清理 inbox, 待處理
4. **無法明確分類的輸入** — 不是知識、不是雜務、不是行動、不是專案

注意：已經夠明確的輸入 bypass Inbox — 明確知識 → CAPTURE，明確雜務 → TASK，明確行動 → ACTION。

### QUERY 信號

觸發條件（符合任一即分類為 QUERY）：

1. **搜尋關鍵字** — 搜尋, 找, search, find, 有沒有
2. **列出/篩選** — 列出, list, 哪些, 所有的
3. **計數/統計** — 有幾張, how many, 各領域, 統計
4. **探索** — 跟 X 相關的, about X, 關於

### PROJECT 信號

觸發條件（符合任一即分類為 PROJECT）：

1. **生命週期動詞** — 建立專案, create project, 暫停, pause, 恢復, resume, 完成, complete, 歸檔, archive
2. **進度紀錄** — log for, 進度, 紀錄
3. **專案查詢** — list projects, 列出專案, show me `<project-name>`, 專案狀況
4. **卡片-專案連結** — link … to project, 連結到專案, unlink, 取消連結

注意：卡片連結至**專案**歸類為 PROJECT，不是 CONNECT。提及專案名稱的 action/task 操作也歸 PROJECT（專案內由 twinmind:project 處理）。

### ACTION 信號

觸發條件（符合任一即分類為 ACTION）：

1. **建立行動** — 建立行動, create action, 新增 action, 開始做 X（有明確範圍但不提及專案）
2. **完成行動** — X action 完成了, action done, 做完了 X
3. **列出行動** — 列出 actions, list actions, 有哪些行動
4. **升格行動** — 把 X 升格為專案, promote to project

排除：提及專案名稱 → 歸 PROJECT。

### TASK 信號

觸發條件（符合任一即分類為 TASK）：

1. **明確雜務** — 動詞開頭的短句：買牛奶, 繳電費, 回覆 email
2. **建立任務** — 加個待辦, add task, 新增 task
3. **完成任務** — X done, 完成 task, X 做好了
4. **列出任務** — 列出 tasks, list tasks, 待辦清單
5. **刪除任務** — 不需要 X 了, 刪除 task, delete task

排除：提及專案名稱或 action 名稱 → 歸 PROJECT 或 ACTION。

### AREA 信號

觸發條件（符合任一即分類為 AREA）：

1. **建立領域** — 建立領域, create area, 新增關注領域
2. **管理領域** — 停用 area, deactivate, 重新啟用, reactivate
3. **關聯操作** — 關聯到 area, link to area, 把 X 加到 Y 領域
4. **列出領域** — 列出 areas, list areas, 關注領域

### REVIEW 信號

觸發條件（符合任一即分類為 REVIEW）：

1. **Vault 狀態** — vault status, 知識庫狀況, 目前狀態
2. **索引操作** — verify index, 檢查索引, rebuild index, 重建索引
3. **MOC 維護** — 更新 MOC, review MOC, Atlas 需要整理嗎
4. **Seed 回顧** — 有哪些 seed 需要發展, review seeds
5. **Dashboard** — 更新 Home, refresh dashboard

### CONNECT 信號

觸發條件（**必須**明確提及兩張卡片且要求連結操作）：

1. **建立連結** — 把 X 和 Y 連起來, link X to Y, connect X and Y
2. **移除連結** — 移除 X 和 Y 的連結, unlink X from Y, disconnect
3. **指定關係類型** — X 跟 Y 的關係是 analogous

排除：僅提及一張卡片 → 可能是 QUERY 或 CAPTURE。目標為專案（非卡片）→ PROJECT。

### 非知識庫輸入 Bypass

當輸入與知識庫操作無關時（如閒聊、程式碼問題、系統指令），AI 不進入意圖路由，以一般 Claude Code 模式回應。

## 子意圖解析

每個意圖類別內，AI 根據輸入內容判斷具體操作（子意圖）。詳細處理邏輯見各 twinmind:* skill。

| 意圖 | 子意圖 |
|------|--------|
| CAPTURE | 建立新卡片（預設）· 更新既有卡片 · 刪除卡片 |
| INBOX | 建立 memo/idea · 升格（7 種路徑：→ Card/Action/Task/Project 等）· 捨棄 · 列出 pending |
| ACTION | 建立 · 完成（含反思鉤）· 列出 · 管理 action 內 tasks · 升格為專案 |
| TASK | 新增 · 完成 · 刪除 · 列出 |
| PROJECT | 建立/暫停/恢復/完成（含反思鉤）/歸檔 · 進度紀錄 · 連結/取消連結卡片 · action CRUD · task CRUD |
| AREA | 建立/更新/停用/重新啟用 · 關聯/取消關聯 Project 或 Card |
| QUERY | 關鍵字搜尋 · domain/type/status 篩選 · 領域統計 · 專案列表/詳情 · Inbox/Action/Task/Area 查詢 |
| REVIEW | Vault Summary · 索引驗證/重建 · MOC 回顧 · Seed 回顧 · Dashboard 更新 · 過期提醒（Inbox triage · Action） |
| CONNECT | 建立連結（可含關係類型）· 移除連結 |

## 分類優先序

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

## 複合意圖處理

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

## 模糊意圖 Fallback

當 AI 無法確定意圖類別時，依以下規則處理：

1. 若輸入為明確知識陳述或新資訊 → 預設 `CAPTURE`
2. 若輸入為模糊想法、片段、未成熟 idea → 預設 `INBOX`
3. 若輸入針對既有內容提問 → 預設 `QUERY`
4. 若以上皆不適用 → 詢問使用者釐清（如「你想要記錄這個想法、加入 inbox 孵化，還是搜尋相關筆記？」）

AI 不得忽略模糊輸入。
