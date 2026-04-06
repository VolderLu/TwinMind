## Why

使用者輸入經常包含外部 URL（文章、影片、書籍連結）。目前 tm:capture 流程沒有 URL 預處理步驟，AI 撰寫卡片 body 時傾向直接貼入裸連結。CLAUDE.md 雖定義了連結偏好規則（fetch title → slug 推測 → 裸連結 fallback），但 tm:capture 未明確引用，導致規則形同虛設。

將 fetch-title 邏輯操作化到 capture 流程，讓卡片中的外部連結自動帶有人類可讀標題。

## What Changes

- **tm:capture SKILL.md**：在 Step 4（生成 Frontmatter）與 Step 5（寫入卡片檔案）之間插入新步驟「URL 預處理」——掃描使用者輸入中的 URL，批次執行 `scripts/fetch-title.mjs` 取得標題，建立 url→title 對照表供 body 撰寫使用
- **CLAUDE.md**：「Markdown 注意事項 → 連結偏好」整段移除（連結格式化邏輯完全由 tm:capture 承擔）

## Capabilities

### New Capabilities

- `url-preprocessing`: tm:capture 流程中的 URL 偵測、批次 title fetch、對照表建立，以及 fallback 處理策略

### Modified Capabilities

（無既有 spec 需修改）

## Impact

- **Skill 檔案**：`.claude/skills/tm-capture/SKILL.md` 新增步驟
- **CLAUDE.md**：連結偏好段落移除
- **scripts/fetch-title.mjs**：不修改（現有功能已足夠）
- **tm:inbox**：不修改——memo 存入時不 fetch，升格為 Card 時走 capture 流程自然觸發
