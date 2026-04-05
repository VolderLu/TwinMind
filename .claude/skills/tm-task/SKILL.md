---
name: tm-task
description: "TwinMind task engine — manages standalone tasks (life chores, errands, quick todos). Use this skill when the user mentions a simple, concrete thing they need to do that doesn't belong to any project or action. Classic triggers: short imperative sentences like '買牛奶', '繳電費', '回覆 email', '預約牙醫', or explicit task operations like '加個待辦', 'add task', 'task done', '完成 task', '刪除 task', 'delete task', '列出 tasks', 'list tasks', '待辦清單'. The distinguishing feature of a standalone task is that it's too small for an Action and not tied to any project. If the user mentions a project name, route to tm:project. If it's a multi-step endeavor, consider tm:action instead."
license: MIT
metadata:
  author: twinmind
  version: "2.0"
---

獨立任務是系統中最小的「做」單位——「買牛奶」不值得建一個 Action 檔案，更不值得建一個 Project。所有獨立任務集中在 `vault/PARA/Tasks/tasks.md` 單一檔案中，用 checklist 格式管理，在 Obsidian 中一目了然。

## 檔案結構

`vault/PARA/Tasks/tasks.md` 分為兩個區塊：

- `## Active`：待完成的任務（`- [ ] <description>`）
- `## Done`：已完成的任務（`- [x] <description>（YYYY-MM-DD）`）

Frontmatter 只有一個 `updated` 欄位，每次修改時更新為當天。

## 新增 Task

在 `## Active` 末尾追加 `- [ ] <description>`。更新 `vault-index.json`：`standalone_tasks` 追加 `{ "text": "<description>", "done": false }`，`stats.total_tasks_standalone` += 1。啟動 post-op background subagent（layer: action）。

## 完成 Task

從 `## Active` 移除該行，在 `## Done` 追加 `- [x] <description>（YYYY-MM-DD）`。這樣設計是因為 Obsidian 中 Done 區塊收在下方，不會干擾對 Active 任務的瀏覽。

更新 index：匹配項設 `done: true` + `completed` 日期，`stats.total_tasks_standalone` -= 1。啟動 post-op background subagent（layer: action）。

## 刪除 Task

完全移除 checklist 行（適用於「不需要做了」的情況，區別於「完成了」）。從 index 的 `standalone_tasks` 移除匹配項。若未完成則 `stats.total_tasks_standalone` -= 1。啟動 post-op background subagent（layer: action）。

## 列出 Tasks

從 `vault-index.json` 讀取 `standalone_tasks`，分 Active / Done 顯示，含計數。支援按狀態篩選。空態：「目前沒有獨立任務」。唯讀操作，不需 post-op。
