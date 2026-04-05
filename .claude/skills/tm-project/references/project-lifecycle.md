# 專案生命週期完整程序

由 `tm:project` skill 引用。包含所有專案操作的詳細步驟。

## 狀態轉換表

| 當前狀態 | 操作 | 目標狀態 | 備註 |
|----------|------|----------|------|
| `active` | pause | `paused` | |
| `active` | complete | `completed` | 觸發反思鉤 |
| `active` | archive | 移除（歸檔） | 需使用者確認 |
| `paused` | resume | `active` | |
| `paused` | complete | `completed` | 觸發反思鉤 |
| `paused` | archive | 移除（歸檔） | 需使用者確認 |
| `completed` | archive | 移除（歸檔） | |

非法轉換回報格式：「<name> 目前狀態為 <status>。可用操作：<available actions>」

## 建立專案（PROJECT_CREATED）

1. **目錄名**：專案標題轉 kebab-case 英文（如 "Learn Rust" → `learn-rust`）
2. **衝突檢查**：`PARA/Projects/<name>/` 已存在 → 詢問使用者
3. **建立檔案**：
   - `PARA/Projects/<name>/goal.md`：frontmatter 含 title, status: active, created, deadline
   - `PARA/Projects/<name>/log.md`：`# Progress Log`
   - `PARA/Projects/<name>/actions.md`：frontmatter 含 `project: "<name>"`, `updated: <YYYY-MM-DD>`，heading `# Actions`，無條目
   - `PARA/Projects/<name>/tasks.md`：frontmatter 含 `project: "<name>"`, `updated: <YYYY-MM-DD>`，heading `# Tasks`，無條目
4. **更新 `PARA/Projects/_index.md`**：新增 wiki-link
5. **更新 `vault-index.json`**：`projects` 新增 `{ "<name>": { "status": "active", "card_refs": 0, "actions": [], "tasks_total": 0, "tasks_done": 0 } }`，更新 `stats.last_updated`

## 暫停專案（PROJECT_PAUSED）

1. 查找專案，驗證狀態為 `active`
2. 更新 `goal.md` frontmatter：`status: paused`
3. 更新 `vault-index.json`：`projects[name].status = "paused"`
4. 更新 `stats.last_updated`

## 恢復專案（PROJECT_RESUMED）

1. 查找專案，驗證狀態為 `paused`
2. 更新 `goal.md` frontmatter：`status: active`
3. 更新 `vault-index.json`：`projects[name].status = "active"`

## 完成專案（PROJECT_COMPLETED）

1. 查找專案，驗證狀態合法（active 或 paused）
2. 更新 `goal.md` frontmatter：`status: completed`，新增 `completed: <YYYY-MM-DD>`
3. 更新 `vault-index.json`：`projects[name].status = "completed"`
4. **反思鉤（Reflection Hook）**：
   - 主動詢問：「做完這個專案你有什麼收穫或教訓？要建卡嗎？」
   - 使用者回答 → 調用 `tm:capture` 建卡，`source` 設為 `"PARA/Projects/<name>/goal.md"`
   - 使用者說「沒有」「不用」「skip」→ 跳過，繼續 post-op
   - 此步驟為 **opt-out**——預設觸發，使用者可跳過

## 歸檔專案（PROJECT_ARCHIVED）

1. 查找專案。若狀態非 `completed` → 詢問確認
2. 移動 `PARA/Projects/<name>/` 至 `PARA/Archive/<name>/`（含所有檔案：goal.md、log.md、actions.md、tasks.md）
3. 從 `vault-index.json` 的 `projects` 移除條目
4. 從 `PARA/Projects/_index.md` 移除連結
5. 已連結卡片的 `related_projects` 保持不變（歷史記錄）

## 專案進度紀錄（PROJECT_LOG_ADDED）

1. 查找專案（任何狀態皆可紀錄）
2. 向 `PARA/Projects/<name>/log.md` 追加：
   ```markdown
   ## <YYYY-MM-DD>

   <使用者的進度描述>
   ```
3. 同日多筆各自產生獨立 `## <date>` 區塊

## 連結卡片至專案（CARD_LINKED_TO_PROJECT）

1. 查找目標卡片和目標專案
2. 若 `related_projects` 已含該專案 → 回報已連結
3. 將專案名加入卡片 frontmatter `related_projects`
4. `updated` 設為當天
5. `vault-index.json`：`projects[name].card_refs` += 1

## 取消連結（CARD_UNLINKED_FROM_PROJECT）

1. 查找目標卡片和目標專案
2. 若 `related_projects` 不含該專案 → 回報未連結
3. 從 `related_projects` 移除
4. `vault-index.json`：`projects[name].card_refs` -= 1（最小 0）

## 專案內 Action 管理

### 新增 Action（PROJECT_ACTION_ADDED）

1. 讀取 `PARA/Projects/<name>/actions.md`
2. 在 `# Actions` 下追加新 H2 區塊：
   ```markdown
   ---

   ## <action-title>
   - **status**: active
   - **created**: YYYY-MM-DD
   - **completed**:
   - **description**: <一句話描述>

   ### Tasks
   ```
3. 更新 `actions.md` frontmatter 的 `updated` 為今天
4. 更新 `vault-index.json`：`projects[name].actions` 追加 `{ "title": "<title>", "status": "active", "tasks_total": 0, "tasks_done": 0 }`
5. 更新 `stats.last_updated`

### 完成 Action（PROJECT_ACTION_COMPLETED）

1. 在 `actions.md` 中找到對應 H2 區塊
2. 將 `**status**: active` 改為 `**status**: done`
3. 填入 `**completed**: YYYY-MM-DD`
4. 更新 `actions.md` frontmatter 的 `updated`
5. 更新 `vault-index.json`：`projects[name].actions[index].status = "done"`
6. **反思鉤（Reflection Hook）**：
   - 主動詢問：「做完這個你有什麼收穫或教訓？要建卡嗎？」
   - 使用者回答 → 調用 `tm:capture` 建卡，`source` 設為 `"PARA/Projects/<name>/actions.md"`
   - 使用者拒絕 → 跳過
7. 更新 `stats.last_updated`

### 列出 Actions

從 `vault-index.json` 的 `projects[name].actions` 讀取，顯示：
```
- <title> — status: <active|done>, tasks: <done>/<total>
```

## 專案內 Task 管理

### 新增專案直屬 Task（PROJECT_TASK_ADDED）

1. 讀取 `PARA/Projects/<name>/tasks.md`
2. 追加 `- [ ] <description>`
3. 更新 `tasks.md` frontmatter 的 `updated`
4. 更新 `vault-index.json`：`projects[name].tasks_total` += 1
5. 更新 `stats.last_updated`

### 新增 Action 內 Task

1. 在 `PARA/Projects/<name>/actions.md` 中找到對應 action 的 `### Tasks` 區塊
2. 追加 `- [ ] <description>`
3. 更新 `actions.md` frontmatter 的 `updated`
4. 更新 `vault-index.json`：
   - `projects[name].actions[index].tasks_total` += 1
   - `projects[name].tasks_total` += 1
5. 更新 `stats.last_updated`

### 完成 Task（PROJECT_TASK_COMPLETED）

1. 在對應檔案中找到 `- [ ] <description>`
2. 改為 `- [x] <description>（YYYY-MM-DD）`
3. 更新 frontmatter 的 `updated`
4. 更新 `vault-index.json`：
   - 若為專案直屬 task：`projects[name].tasks_done` += 1
   - 若為 action 內 task：`projects[name].actions[index].tasks_done` += 1 且 `projects[name].tasks_done` += 1
5. 更新 `stats.last_updated`

### 刪除 Task（PROJECT_TASK_DELETED）

1. 在對應檔案中移除 checklist 行
2. 更新 frontmatter 的 `updated`
3. 更新 `vault-index.json`：
   - `projects[name].tasks_total` -= 1
   - 若為已完成 task：`projects[name].tasks_done` -= 1
   - 若為 action 內 task：同步更新 action 的 tasks_total/tasks_done
4. 更新 `stats.last_updated`

## Dashboard Active Projects 格式

```markdown
- [[PARA/Projects/<name>/goal|<title>]] — deadline: <日期 or "no deadline"> · <N> cards · actions: <done>/<total> · tasks: <done>/<total>
```
