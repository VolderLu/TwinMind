---
name: action
description: "TwinMind action engine — manages standalone actions that aren't tied to any project. Use this skill when the user describes something they want to do that has a clear scope but doesn't belong to a project. Triggers: '建立行動', 'create action', '新增 action', '完成 action', 'action done', '做完了', '列出 actions', 'list actions', '升格為專案', 'promote to project', or when the user describes an executable goal like '研究 X', '設定 Y', '整理 Z'. Also use when the user says an action is getting too big and needs to become a project. Important: if the user mentions a specific project name, route to twinmind:project instead — that skill handles project-scoped actions."
license: MIT
metadata:
  author: twinmind
  version: "2.0"
---

Actions 存在 `vault/PARA/Actions/` 中，每個行動一個 .md 檔案。行動可以包含自己的 task checklist，也可以在 scope 擴大時升格為 Project。

### Post-op 執行方式

所有狀態變更操作完成後，透過 Bash tool 執行 post-op pipeline（唯讀查詢不需要）：

```bash
node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '{"event_type":"<ACTION_CREATED|ACTION_COMPLETED|ACTION_PROMOTED_TO_PROJECT>","event_context":{"action_title":"<title>"}}'
```

腳本同步執行，執行完成後再回應使用者。以下各操作章節標示需要的 `event_type`，均使用此指令格式。

## 建立獨立 Action

生成 slug（標題轉 kebab-case 英文），檢查檔案衝突。若 slug 已存在，加數字後綴（`<slug>-2.md`）。建立 `vault/PARA/Actions/<slug>.md`。

#### Action 檔案範例

```markdown
---
id: "20260416143000"
title: "研究 Rust async runtime"
status: active
created: 2026-04-16
---

研究 Rust 的 async runtime 選項（tokio vs async-std），比較效能和生態系。

## Tasks

- [ ] 閱讀 tokio 官方文件
- [ ] 比較 tokio vs async-std benchmark
```

Frontmatter 必填欄位：`id`（YYYYMMDDHHmmss）、`title`、`status`（初始 active）、`created`（YYYY-MM-DD）。選填：`completed`、`source_inbox`（從 Inbox 升格時填入原 ID）、`related_cards`。

Body 包含描述和 `## Tasks` 區塊（checklist 格式）。若使用者提供了子步驟，直接建立為 tasks；若沒有，留空讓之後填入。

更新 `vault-index.json`：`standalone_actions` 新增條目（含 title/status/tasks_total/tasks_done），`stats.total_actions` += 1。執行 post-op（event_type: `ACTION_CREATED`）。

## 完成獨立 Action

更新 frontmatter：status → done，填入 completed 日期。更新 index：status → done，total_actions -= 1。

**反思鉤（Reflection Hook）**——完成是知識萃取的最佳時機。主動詢問：「做完這個你有什麼收穫或教訓？要建卡嗎？」這是 opt-out 設計（預設問，使用者說「沒有」才跳過），因為人往往不會主動回顧，但被提醒時常能產出有價值的反思。使用者回答 → 調用 `twinmind:capture` 建卡，source 指向 action 檔案。

執行 post-op（event_type: `ACTION_COMPLETED`）。

## Action 內的 Task 管理

Action 可以有自己的 task checklist，幫助拆解行動為具體步驟。

- **新增**：在 `## Tasks` 追加 `- [ ] <description>`，index 的 tasks_total += 1
- **完成**：`[ ]` → `[x]`，追加日期，index 的 tasks_done += 1
- **刪除**：移除行，調整 index 的 tasks_total（已完成則也調 tasks_done）

每次變更都更新 `stats.last_updated`。

## 列出獨立 Actions

從 `vault-index.json` 讀取 `standalone_actions`。顯示 title、status、tasks 進度（done/total）。支援按 status 篩選。空態：「目前沒有獨立行動」。唯讀操作，不需 post-op。

## 升格為專案

當行動的 scope 擴大——子任務越來越多、需要多個 action 來完成、需要長期追蹤——就是升格的時機。

流程：調用 `twinmind:project` 建專案（用 action 標題），將 action 內容移入新專案的 `actions.md` 作為第一個 action，刪除原始 action 檔案，從 index 的 `standalone_actions` 移除。執行 post-op（event_type: `ACTION_PROMOTED_TO_PROJECT`）。

若專案建立失敗，不刪除原始 action 檔案。slug 衝突時加數字後綴（`<slug>-2.md`）。
