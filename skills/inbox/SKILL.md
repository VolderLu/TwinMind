---
name: inbox
description: "TwinMind inbox engine — the safety net for half-formed thoughts. Use this skill whenever the user shares something vague, unstructured, or not yet ready to become a Card, Action, Task, or Project. Classic triggers: '突然想到...', '隨手記一下', '有個想法但還不確定', 'inbox', '升格', 'promote', 'dismiss', '清理 inbox', 'triage', '待處理'. Also use this when the user's input is ambiguous — if you can't tell whether it's knowledge, a task, or an action, it belongs in the Inbox. The key question: does the user know what this should become? If not → Inbox. Important: do NOT use this for inputs that are already clear — a fact goes to twinmind:capture, '買牛奶' goes to twinmind:task, a scoped action goes to twinmind:action."
license: MIT
metadata:
  author: twinmind
  version: "2.0"
---

Inbox 是所有模糊輸入的安全網。人的大腦會在隨機時刻冒出想法——有些已成形，有些只是碎片。Inbox 的存在讓使用者不需要在靈感出現的那一刻決定「這是知識還是任務」，只要先記下來，之後再分類。

一致性驗證由 PostToolUse hooks 自動處理。狀態變更操作完成後透過 Bash tool 執行 `node .claude/twinmind/bin/tm-post-op.mjs` 觸發 post-op pipeline。唯讀查詢不需要。

### Post-op 執行方式

透過 Bash tool 執行：

```bash
node .claude/twinmind/bin/tm-post-op.mjs --layer <action|both> --event '{"event_type":"<INBOX_CREATED|INBOX_PROMOTED|INBOX_DISMISSED>","event_context":{"inbox_id":"<id>","inbox_text":"<text>","promoted_to":"<path 或 null>"}}'
```

升格為 Card 時用 `--layer both`，其餘用 `--layer action`。腳本同步執行，執行完成後再回應使用者。

## 什麼該進 Inbox，什麼不該

這是本 skill 最重要的判斷。Inbox 只收「還不確定要變成什麼」的想法，已經明確的輸入應該直接到目的地（跳過 Inbox 減少摩擦）：

- 「CAP 定理說分散式系統只能三選二」→ 明確知識，直接 `twinmind:capture`
- 「買牛奶」→ 明確雜務，直接 `twinmind:task`
- 「研究 Rust async runtime」→ 有明確範圍的行動，直接 `twinmind:action`
- 「睡眠跟創造力的關係好像蠻有趣的」→ 有方向但不成熟 → **Inbox（idea）**
- 「今天看到一篇 Rust 文章不錯」→ 碎片，無方向 → **Inbox（memo）**

判斷標準很簡單：**使用者自己知道這該變成什麼嗎？** 知道 → bypass。不知道 → Inbox。

## 兩種類型

- **memo**：片段——一句話、一個連結、零碎觀察，沒有明確方向。原始記錄，不重寫。
- **idea**：有方向的想法——有主題輪廓但還不夠成熟。可以進一步發展。

分類依據：輸入是否有可辨識的主題或探索方向。有方向 = idea，無方向 = memo。

## 建立 Inbox 項目

建立 `vault/PARA/Inbox/<id>-<slug>.md`（id 為 `YYYYMMDDHHmmss`，slug 為 kebab-case 英文）。

Frontmatter 包含 5 個必填欄位：`id`、`type`（memo/idea）、`text`（一行摘要）、`created`（YYYY-MM-DD）、`status`（初始為 pending）。選填 `promoted_to`（升格後填入目標路徑）。

Body 保留使用者的原始輸入，不要重寫或原子化——Inbox 的價值在於忠實記錄當下的想法，整理是升格時的事。

更新 `vault-index.json`：在 `inbox` 新增條目，`stats.total_inbox` += 1。執行 post-op（Bash tool，`--layer action --event '{"event_type":"INBOX_CREATED",...}'`）。

## 升格（Promotion）

升格是 Inbox 的核心價值——讓想法在成熟後流向正確的容器。7 條路徑：

| 從 → 到 | 怎麼做 | 何時適用 |
|---------|--------|---------|
| memo → idea | 更新 type，豐富 body，status 保持 pending | 想法開始有方向了，但還不夠具體 |
| → Card | 調用 `twinmind:capture` 建卡 | 想法已成熟為可獨立存在的知識 |
| → Action（獨立）| 調用 `twinmind:action`，action 的 `source_inbox` 填 inbox ID | 想法變成了具體可執行的行動 |
| → Action（專案內）| 調用 `twinmind:project` 追加 action | 想法屬於某個專案的行動 |
| → Task（獨立）| 調用 `twinmind:task` | 想法具體化為一個待辦事項 |
| → Task（專案內）| 調用 `twinmind:project` 追加 task | 想法屬於某個專案的任務 |
| → Project | 調用 `twinmind:project` 建專案 | 想法大到需要一個專案來承載 |

升格後更新 inbox 檔案（status: promoted，promoted_to 填目標路徑），更新 index（total_inbox -= 1）。執行 post-op（Bash tool，升格為 Card 用 `--layer both`，其餘用 `--layer action`，event_type: `INBOX_PROMOTED`）。

升格目標由使用者指示決定。若使用者沒有明確指定，根據內容推測最可能的目標並確認。

## 捨棄（Dismiss）

使用者決定不要這個想法了。更新 status 為 dismissed（不刪除檔案——保留歷史記錄），total_inbox -= 1。執行 post-op（Bash tool，`--layer action --event '{"event_type":"INBOX_DISMISSED",...}'`）。

## 列出 Inbox 項目

從 `vault-index.json` 的 `inbox` 讀取，按 status 分組顯示：

- Pending：`💡 idea` 或 `📝 memo` + text + created 日期
- Promoted：text + 升格目標
- Dismissed：text

支援按 status 篩選。空態回報「Inbox 是空的」。列出是唯讀操作，不需 post-op。
