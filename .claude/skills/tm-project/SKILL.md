---
name: tm-project
description: "TwinMind project engine — the hub for goal-driven work with a clear start and end. Use this skill for any project lifecycle operation: create, pause, resume, complete, archive. Also handles project-scoped actions and tasks (adding/completing actions within a project, managing project task lists), progress logging, and linking cards to projects. Triggers: '建立專案', 'create project', '暫停', 'pause', '恢復', 'resume', '完成專案', 'complete', '歸檔', 'archive', '進度', 'log', '列出專案', 'list projects', '專案狀況', or when the user mentions a specific project name in combination with an action/task operation (e.g., '在 build-blog 加個 action'). This is the central skill for anything that references a named project."
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

管理知識庫中的專案——從建立到歸檔的完整生命週期。專案是行動導向的容器，將相關卡片組織在共同目標下。與卡片（知識）不同，專案有明確的開始和結束。

一致性驗證由 PostToolUse hooks 自動處理。狀態變更操作完成後啟動 background subagent 執行 post-op pipeline（`layer: "action"`）。唯讀查詢不需要。

### Post-op Subagent 啟動方式

透過 Agent tool（`run_in_background: true`）啟動 subagent，prompt 包含 post-op payload：
```json
{
  "task": "post-op",
  "layer": "action",
  "event_type": "<PROJECT_CREATED|PAUSED|RESUMED|COMPLETED|ARCHIVED|...>",
  "event_context": { "project_id": "<name>", "project_title": "<title>" }
}
```
啟動後立即回應使用者。Subagent 依照 `.claude/skills/tm-post-op/SKILL.md` 執行 changelog + Dashboard 重建。

## 專案操作

所有生命週期操作的完整步驟程序（含狀態轉換表、檔案結構、卡片關聯、Action/Task 管理），請讀取 `references/project-lifecycle.md`。

### 狀態變更操作（需啟動 post-op subagent）

**建立專案**：建立 `PARA/Projects/<name>/` 目錄，含 `goal.md`（frontmatter + 目標描述）、`log.md`、`actions.md`、`tasks.md`。更新 `PARA/Projects/_index.md` 和 `vault-index.json` 的 `projects`（含 `actions: []`、`tasks_total: 0`、`tasks_done: 0`）。

**暫停 / 恢復**：驗證狀態轉換合法（見 `references/project-lifecycle.md` 狀態轉換表），更新 `goal.md` frontmatter 和 `vault-index.json`。

**完成**：驗證狀態轉換合法，更新 `goal.md` 加 `completed: <date>`。**觸發反思鉤**——主動詢問使用者「做完這個專案你有什麼收穫或教訓？要建卡嗎？」。使用者回答則調用 `tm:capture` 建卡（source 指向 goal.md），使用者拒絕則跳過。反思鉤是 opt-out 設計。

**歸檔**：移動至 `PARA/Archive/<name>/`（含所有檔案：goal.md、log.md、actions.md、tasks.md），從 `projects` 索引移除。非 completed 狀態需確認。

**連結/取消連結卡片**：更新卡片 frontmatter 的 `related_projects` 和 `vault-index.json` 的 `card_refs`。

**進度紀錄**：向 `log.md` 追加日期區塊。任何狀態皆可紀錄。

### 專案內 Action 操作（需啟動 post-op subagent）

**新增 Action**：在 `PARA/Projects/<name>/actions.md` 追加 H2 區塊（含 status: active、created、description），更新 `vault-index.json` 的 `projects[name].actions` 陣列。

**完成 Action**：將 actions.md 中對應 H2 區塊的 status 改為 done、填入 completed 日期。**觸發反思鉤**——同完成專案流程。更新 `vault-index.json`。

**列出 Actions**：讀取 `actions.md` 顯示所有 action 的標題和狀態。

### 專案內 Task 操作（需啟動 post-op subagent）

**新增 Task（專案直屬）**：在 `PARA/Projects/<name>/tasks.md` 追加 `- [ ] <description>`。更新 `vault-index.json` 的 `projects[name].tasks_total`。

**新增 Task（Action 內）**：在 `actions.md` 中對應 action 的 `### Tasks` 區塊追加 checklist item。更新 `vault-index.json` 的 action `tasks_total` 和 project `tasks_total`。

**完成 Task**：將 `[ ]` 改為 `[x]`，追加完成日期。更新 `vault-index.json` 的 `tasks_done`。

**刪除 Task**：移除 checklist 行。更新 `vault-index.json` 的 `tasks_total`。

### 唯讀查詢（不需 post-op）

所有查詢從 `vault-index.json` 的 `projects` 執行，不掃描檔案。

**列出所有專案**：依狀態分組（active → paused → completed），顯示名稱、狀態、card_refs、action 數、task 進度。空態：「目前沒有專案」。

**依狀態篩選**：篩選 active/paused/completed。

**查看詳情**：讀取 `goal.md` + `log.md` + `actions.md` + `tasks.md`，顯示標題、狀態、截止日、目標、最近 5 筆進度、關聯卡片數、action 列表、task 進度。
