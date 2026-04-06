## Context

tm:capture 的 Step 5 撰寫卡片 body 時，AI 需要將使用者輸入中的 URL 格式化為 `[title](url)`。現有工具 `scripts/fetch-title.mjs` 已支援批次 title 抓取（含 og:title fallback、5 秒 timeout、Wayback Machine fallback）。CLAUDE.md 定義了四層 fallback 優先序，但 tm:capture 流程沒有明確的 URL 處理步驟。

變更範圍僅涉及兩個文字檔：tm:capture SKILL.md（新增步驟）和 CLAUDE.md（精簡措辭）。不涉及程式碼修改。

## Goals / Non-Goals

**Goals:**

- 在 tm:capture 流程中加入 URL 預處理步驟，讓 body 撰寫時自動使用 `[title](url)` 格式
- CLAUDE.md 移除連結偏好段落，連結格式化完全由 tm:capture 承擔

**Non-Goals:**

- 不修改 `scripts/fetch-title.mjs`
- 不在 tm:inbox 存入流程加入 fetch（升格為 Card 時自然走 capture 流程）
- 不處理 vault 內部 wiki-link（`[[slug|title]]`），僅針對外部 URL

## Decisions

### 1. 步驟插入位置：Step 4 之後、Step 5 之前（新編號 Step 4.5）

**選擇**：在 frontmatter 生成後、body 撰寫前插入 URL 預處理。

**理由**：此時使用者輸入已完成分類和重複偵測，確定要建卡。在 body 撰寫前準備好 url→title 對照表，body 撰寫時直接引用，流程最自然。

**替代方案**：在 Step 1 之前（最早時機）——但若重複偵測決定不建卡，fetch 就浪費了。

### 2. CLAUDE.md 連結偏好段落：完全移除

**選擇**：CLAUDE.md 的「Markdown 注意事項 → 連結偏好」整段移除，連結格式化邏輯完全由 tm:capture Step 4.5 承擔。

**理由**：連結格式化是 tm:capture 的操作細節，非 tm 場景不需要此規則。保留通用原則聲明會造成維護負擔但實際價值低。

**替代方案**：保留通用原則聲明——但使用者決定不保留。

### 3. Fetch 失敗靜默降級

**選擇**：fetch-title.mjs 失敗時，依序嘗試 slug 推測 → 裸連結，不 block 建卡流程，不通知使用者。

**理由**：連結標題是 nice-to-have，不應阻擋知識捕捉的核心任務。fetch-title.mjs 已內建 5 秒 timeout 和 Wayback fallback，額外的降級處理只需在 SKILL.md 中說明。

## Risks / Trade-offs

- **[網路延遲]** → fetch-title.mjs 有 5 秒 timeout；使用者輸入通常 1-3 個 URL，總延遲可控。若離線環境，全部走 fallback 3/4，不影響建卡。
- **[步驟編號變動]** → 插入 Step 4.5 不影響既有步驟編號（4 和 5 不改），後續步驟引用不受影響。
