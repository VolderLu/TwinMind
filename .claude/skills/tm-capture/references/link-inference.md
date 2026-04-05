# 連結推理與關係類型

本文件定義建卡時的自動連結推理程序，以及連結建立所需的關係類型系統。由 `tm:capture` 的 Step 5.5 引用。

## 6 種關係類型

| 類型 | 符號 | 語意 | 範例 |
|------|------|------|------|
| `is-part-of` | `⊂` | A 是 B 的子概念 | 所有權 ⊂ Rust |
| `analogous` | `≈` | 不同領域的相似模式 | RAII ≈ 所有權 |
| `related` | `~` | 共享主題或上下文 | Rust ~ Go |
| `inspires` | `→` | A 啟發了 B | 反脆弱 → 混沌工程 |
| `contradicts` | `⊕` | 觀點衝突或對比 | OOP ⊕ FP |
| `supports` | `⇒` | A 為 B 提供證據 | 論文X ⇒ CAP定理 |

每條連結有且僅有一種類型。無法歸類時 fallback 為 `related`（`~`）。

## 關係分類優先序

判斷時依序檢查，取第一個符合的：

1. **is-part-of（⊂）** — A 是 B 的組成部分、子集或特化。domain 重疊且概念範圍明顯窄於另一方
2. **supports（⇒）** — A 為 B 提供證據或佐證。典型：source 支持 concept/insight
3. **contradicts（⊕）** — 對立觀點或互斥結論，主題相同但立場相反
4. **inspires（→）** — A 直接促成或啟發了 B，存在因果或啟發方向性
5. **analogous（≈）** — 結構或邏輯相似但分屬不同 domain。關鍵：跨域相似性
6. **related（~）** — 共享主題或上下文，無更強結構關係。預設 fallback

## Connections 區塊格式

```markdown
## Connections
- <符號> [[<目標卡片 slug>|<目標卡片 title>]] — <一句話說明為何連結>
```

`<slug>` 為目標卡片檔名（不含 `.md`）。零連結時內容為 `（尚無連結）`。

## 反向關係對照表

| 正向（A→B） | 符號 | 反向（B→A） | 反向符號 | 說明 |
|---|---|---|---|---|
| `is-part-of` | ⊂ | `related` | ~ | 反向說明需註明「包含 A」 |
| `analogous` | ≈ | `analogous` | ≈ | 對稱，反向說明相同 |
| `related` | ~ | `related` | ~ | 對稱，反向說明相同 |
| `inspires` | → | `related` | ~ | 反向說明需註明「受 A 啟發」 |
| `contradicts` | ⊕ | `contradicts` | ⊕ | 對稱，反向說明相同 |
| `supports` | ⇒ | `related` | ~ | 反向說明需註明「由 A 提供證據」 |

對稱關係（≈、~、⊕）反向不變。非對稱關係（⊂、→、⇒）反向用 `related`（~），說明中標注方向。

## 建立連結程序（LINK_CREATED）

每建立一條連結，執行：

**Step 1 — 寫入源卡片**：讀取 `## Connections`，移除 `（尚無連結）` placeholder（若有），追加連結行。

**Step 2 — 寫入目標卡片反向連結**：同上，但用反向關係對照表決定符號和說明。

**Step 3 — 更新索引**（**單次 Edit**）：以單次 Edit tool invocation 完成以下所有變更：
1. 目標 ID 加入源 note 的 `links_to`
2. 源 ID 加入目標 note 的 `linked_from`
3. 重算兩張 note 的 `link_count`（`links_to.length + linked_from.length`）
4. 重算 `stats.total_links`（所有 `links_to` 長度總和）
5. 更新 `stats.last_updated`

old_string SHALL 涵蓋源 note entry、目標 note entry 和 stats 物件的連續 JSON 區塊；new_string 包含所有欄位更新後的完整版本。**當多條連結由 link-inference 接受時，所有連結的 Step 3 SHALL 合併為單次 Edit**：old_string 涵蓋新卡片 entry、每張目標卡片 entry 和 stats 物件，new_string 包含所有受影響 entries 的完整更新版本（所有 links_to/linked_from 更新、所有 link_count 重算、stats.total_links 增加接受連結數、stats.last_updated 更新）。

## 連結推理程序（Step 5.5）

在卡片檔案寫入後、更新索引前執行：

1. **跳過條件**：`notes` 為空（無既有卡片）→ 跳過，Connections 保持 `（尚無連結）`
2. **掃描候選**：遍歷所有既有 notes，將新卡片的 title/summary/domain 與每筆 note 語意比對
3. **判斷相關性**：綜合判斷語意關聯（概念重疊、主題相關、跨域類比）
4. **排序與限制**：超過 5 筆時取前 5（排序：title 相似度 > summary 重疊 > 共享 domain）。無最低門檻——有 1 筆相關即建立
5. **分類與說明**：依關係分類優先序判斷類型，生成說明
6. **執行連結**（兩階段批次寫入）：
   - **Phase A — 卡片檔案編輯**：對每筆接受的連結，依序執行「建立連結程序」的 Step 1（寫入新卡片 `## Connections`）和 Step 2（寫入目標卡片反向連結）。此階段完成所有卡片 `.md` 檔案的 Edit，不觸碰 vault-index.json
   - **Phase B — 單次索引更新**：所有卡片檔案編輯完成後，執行一次合併的 Step 3：single Edit 涵蓋新卡片 entry、所有目標卡片 entries 和 stats 物件，new_string 包含所有接受連結的完整雙向更新（詳見 Step 3 說明）
