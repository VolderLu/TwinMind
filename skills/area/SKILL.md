---
name: area
description: "TwinMind area engine — manages Areas of ongoing responsibility (long-term focus domains with no end date). Use this skill when the user talks about a persistent life/work domain they want to track, like '健康管理', '職涯發展', '財務規劃', or when they want to group projects and cards under a theme. Triggers: '建立領域', 'create area', '新增 area', '停用 area', 'deactivate', '重新啟用', 'reactivate', '關聯到 area', 'link to area', '列出 areas', 'list areas', '關注領域', or any mention of ongoing responsibilities, life domains, or thematic grouping of projects. Important: Areas are different from Projects (which have end dates) and from card domains (which are metadata tags). An Area is a conscious commitment to track a life domain."
license: MIT
metadata:
  author: twinmind
  version: "2.0"
---

Areas 代表持續關注的領域——沒有明確結束日期的長期責任或興趣（如「健康管理」「職涯發展」）。它們和 Projects 的區別在於：Project 完成後會歸檔，Area 則持續存在。Areas 提供跨專案的主題視角，幫助使用者看到不同專案和卡片之間的主題關聯。

每個 Area 存為 `vault/PARA/Areas/<area-name>.md`。

一致性驗證由 PostToolUse hooks 自動處理。狀態變更操作完成後透過 Bash tool 執行 `node .claude/twinmind/bin/tm-post-op.mjs --layer action` 觸發 post-op pipeline。唯讀查詢不需要。

### Post-op 執行方式

透過 Bash tool 執行：

```bash
node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '{"event_type":"<AREA_CREATED|AREA_DEACTIVATED|AREA_REACTIVATED|AREA_UPDATED|AREA_LINKED|AREA_UNLINKED>","event_context":{"area_name":"<name>","area_slug":"<slug>"}}'
```

腳本同步執行，執行完成後再回應使用者。

## Area Schema

Frontmatter 必填欄位：`name`（人類可讀名稱）、`description`（一句話描述）、`status`（active/inactive）、`created`、`updated`、`related_projects`（陣列）、`related_cards`（陣列）。

Body 包含描述和兩個關聯區塊：`## Related Projects`（wikilinks）和 `## Related Cards`（wikilinks）。

## 建立 Area

生成 kebab-case 英文檔名，檢查衝突。建立 .md 檔案，更新 `PARA/Areas/_index.md` 加 wikilink，更新 `vault-index.json` 的 `areas` 新增條目（status: active，空 related 陣列）。執行 post-op（Bash tool，`node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '...'`）。

## 停用 / 重新啟用

Area 不刪除——只切換 status。停用的 Area 不出現在 Dashboard 的 active 區塊中，但檔案保留，隨時可重新啟用。這比刪除安全，因為 Area 的關聯資料（projects、cards）仍有參考價值。

停用：status → inactive。重新啟用：status → active。兩者都更新 index 和 `updated` 日期。執行 post-op（Bash tool，`node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '...'`）。

## 關聯 Project / Card

Areas 的價值在於連結——把分散的 Projects 和 Cards 收攏在同一個主題下。

**關聯 Project**：將 project 名加入 `related_projects`，在 `## Related Projects` 追加 wikilink（`[[PARA/Projects/<name>/goal|<title>]]`），更新 index。

**關聯 Card**：將 card ID 加入 `related_cards`，在 `## Related Cards` 追加 wikilink（`[[Cards/<slug>|<title>]]`），更新 index。

取消關聯為逆操作。重複關聯時回報「已關聯」。每次操作都執行 post-op（Bash tool，`node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '...'`）。

## 更新 Area

修改 description 等 metadata，更新 `updated` 日期和 index。執行 post-op（Bash tool，`node .claude/twinmind/bin/tm-post-op.mjs --layer action --event '...'`）。

## 列出 Areas / 查看詳情

從 `vault-index.json` 讀取，按 active/inactive 分組顯示 name、projects 數、cards 數。查看詳情時讀取 area 檔案顯示完整資訊。唯讀操作，不需 post-op。空態：「目前沒有關注領域」。
