## 1. tm:capture SKILL.md — 新增 URL 預處理步驟

- [x] 1.1 在 Step 4 與 Step 5 之間插入 Step 4.5「URL 預處理」——使用者標題優先分流，僅對剩餘 URL 批次 fetch，合併結果建立對照表（含 slug 推測與裸連結 fallback）
- [x] 1.2 修改 Step 5 body 撰寫說明，加入「使用 Step 4.5 對照表格式化外部 URL 為 `[title](url)`」

## 2. CLAUDE.md — 移除連結偏好段落

- [x] 2.1 移除「Markdown 注意事項 → 連結偏好」整段（連結格式化完全由 tm:capture Step 4.5 承擔）
