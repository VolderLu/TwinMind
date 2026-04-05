---
name: tm-enrich
description: "TwinMind card enrichment engine. Use this whenever the user wants to deepen, expand, or intellectually complete an existing vault card. Triggers on: 'enrich <card>', 'enrich <card> → growing', '完善 <card>', '深化 <card>', '把 <card> 發展成 growing', '補充 <card> 的概念', 'expand <card>', '讓 <card> 更完整'. The user provides only the card name and optional focus hints — the AI autonomously identifies content gaps and generates comprehensive content across six dimensions: concept explanation, origin/story, examples, related terms (abstraction/lateral/decomposition), practical applications, and common misconceptions vs counter-intuitive insights. Always use this skill when the user wants a card to grow intellectually, not just receive new facts."
license: MIT
metadata:
  author: twinmind
  version: "1.0"
---

# tm:enrich — 卡片知識深化引擎

## 角色定位

接收一張現有卡片（通常是 `seed` 狀態），自主診斷概念缺口，生成完整的知識內容，將卡片升格為 `growing` 或 `evergreen`。

使用者只需提供卡片名稱和可選的焦點方向。**AI 負責所有內容生成** — 這不是 `tm:capture` update（使用者提供 delta，AI 寫入），而是 AI 主動研究並擴展概念深度。

## 輸入解析

從使用者輸入提取：

| 參數 | 必填 | 說明 |
|------|------|------|
| `target_card` | ✓ | 卡片名稱或 slug（比對 title 或 path） |
| `target_status` | 選填 | 目標狀態；預設升一級（seed→growing，growing→evergreen） |
| `focus` | 選填 | 內容焦點方向，如「實踐步驟」、「神經科學機制」、「哲學含意」 |

## 執行流程

### Step 1 — 讀取目標卡片

從 `vault/System/vault-index.json` 定位 target_card（比對 `title` 或 `path` slug）。讀取對應的卡片檔案，取得當前內容、status、domain、現有連結。

若找不到卡片，告知使用者並結束。

### Step 2 — 讀取 vault 上下文

讀取 `vault/System/vault-index.json`，掌握：
- 所有現有卡片的 title + path（用於識別「相關名詞」中哪些已有對應卡片）
- 與 target_card 相同 domain 的卡片（潛在新連結）

### Step 3 — 生成完整內容

依照下方「六個內容維度」生成所有 section 的內容。

使用者有 `focus` 方向時，在對應維度加深處理；其他維度維持標準深度。

### Step 4 — 重寫卡片

以完整內容重寫卡片檔案（全量覆寫，不是追加）。更新 frontmatter：
- `status`：升格至 target_status
- `updated`：今天日期（YYYY-MM-DD）

保留原有 `id`、`created`、`type`、`domain`、`source`、`related_projects`。

### Step 5 — 更新 vault-index.json

在 `vault/System/vault-index.json` 中更新 target_card 的 entry：
- `status`：新狀態
- `summary`：根據新內容重寫（1–2 句，精確反映新增內容的重點）
- `links_to`：加入新連結卡片的 ID（來自 Connections section）
- `link_count`：重新計算（target_card 連接的 unique 節點數，links_to ∪ linked_from）
- `stats.total_links`：加上新增的 links_to 數量

同時更新每張新連結卡片的 `linked_from`（加入 target_card ID）和 `link_count`。

**一致性原則：target_card 的 links_to 更新，與每張新連結卡片的 linked_from 更新，必須在同一次 Edit 操作中完成。** Hook 在每次寫入後驗證雙向一致性——若分步寫入，會因瞬間不一致而被攔截。解法：將所有需要變更的 entry 合併成一個連續的 JSON 區塊，一次替換。

**寫入順序：必須完成所有 vault-index.json 更新後，才能啟動 subagent。**

### Step 6 — 更新 MOC emoji

在對應的 `vault/Atlas/*.md` MOC 檔案中，將該卡片條目的狀態 emoji 更新：
- `🌱` seed → `🌿` growing
- `🌿` growing → `🌲` evergreen

若找不到對應 MOC，略過此步驟（不強制建立）。

### Step 7 — 啟動 post-op subagent

透過 Agent tool（`run_in_background: true`）啟動 post-op pipeline，**立即回應使用者，不等待**。

Post-op payload：
```json
{
  "task": "post-op",
  "layer": "knowledge",
  "event_type": "CARD_UPDATED",
  "event_context": {
    "card_id": "<id>",
    "card_title": "<title>",
    "card_path": "<path>",
    "domains": ["<domain>"],
    "status_change": "<old_status>→<new_status>"
  }
}
```

---

## 六個內容維度

每次 enrich 必須覆蓋所有六個維度，每個維度對應卡片中一個 H2 section。目標：讀完這張卡片的人應能向他人解釋這個概念，知道它從哪來、有哪些具體案例、如何延伸探索、如何實際應用，以及有哪些常見的認知陷阱。

---

### 維度 1：完整概念解說

**目的：** 讓讀者真正理解概念，而不只是記住定義。

包含：
- 核心機制：它是如何運作的？（「為什麼」不只是「是什麼」）
- 概念在知識地圖中的定位：它解決什麼問題？填補什麼空缺？
- 若概念有值得獨立說明的子機制，用 H3 分節

Section 標題：通常即為卡片主標題（H1），後接機制說明。或用 `## 核心機制` 作為子節。

---

### 維度 2：由來與故事

**目的：** 故事是記憶的錨點。知道概念的起源，讓它從抽象變具體。

包含：誰提出或發現這個概念、何時、在什麼情境下、原本是為了解決什麼問題。不需要完整傳記，1–3 段即可。

若概念沒有明確的發現者（如自然現象或民間智慧），描述它是如何被系統化研究的。

Section 標題：`## 由來與故事` 或 `## 起源`

---

### 維度 3：案例

**目的：** 案例讓概念從「聽懂了」變成「真的理解了」。

提供 2–3 個具體案例，來自**不同情境**（如：學術研究 + 日常生活 + 專業應用）。案例是真實發生的實例或可觀察的現象，不是比喻。

Section 標題：`## 案例`

---

### 維度 4：相關名詞

**目的：** 給使用者**有方向的延伸路徑**，而不是一份詞彙清單。

分三個探索層次，每層 2–6 個詞彙，每個詞彙附一句說明：

```markdown
## 相關名詞

### 抽象層（往上）
這個概念屬於哪個更大的框架或理論？

- **名詞** — 為什麼值得往這個方向探索
- **[[已存在的卡片slug|名詞]]** — 說明（vault 中已有卡片，用 wikilink 標示）

### 橫向探索（同層）
有哪些兄弟概念，跟這個概念在同一個鄰近空間？

- **名詞** — 它跟本概念的關係或核心差異

### 拆解層（往下）
這個概念由哪些子元件或具體實作組成？

- **名詞** — 它是本概念的哪個部分
```

**關鍵：** 若某個相關名詞在 vault 中已有對應卡片（從 Step 2 的卡片清單比對），用 wikilink 標示：`**[[slug|名詞]]**`。這讓使用者能直接跳轉探索。

---

### 維度 5：應用方式

**目的：** 讓概念從知識變成行動能力。

提供**具體可操作**的指引，不是泛泛建議。可包含：
- 使用時機和判斷標準（何時該用、何時不該用）
- 具體操作步驟或工作流程整合方式
- 設計含意、決策框架、或思考工具
- 常見誤用和避免方法

Section 標題：`## 應用方式` 或 `## 應用與啟發`

---

### 維度 6：常見偏誤 vs 反直覺

**目的：** 幫助讀者避開認知陷阱，同時記住這個概念真正反常識之處——這往往是概念中最有價值、最難忘的部分。

分兩個子節：

```markdown
## 常見偏誤 vs 反直覺

### 常見偏誤
人們在理解或應用這個概念時最常犯什麼錯誤？

- **偏誤名稱** — 描述這個錯誤的具體形式，以及為什麼人容易掉進這個陷阱

### 反直覺洞見
這個概念中有哪些違反直覺、或讓人第一次聽到會覺得「這怎麼可能」的地方？

- **洞見陳述** — 為什麼這件事反直覺，以及為什麼它是真的
```

撰寫原則：
- 常見偏誤聚焦「錯誤的應用或理解」，不是簡單的「不知道這個概念」
- 反直覺洞見必須是**真實的**反直覺（有研究或充分論據支持），不是刻意製造驚喜感
- 每個子節 2–3 點即可，寧少勿濫；若概念確實沒有明顯反直覺面，單一洞見亦可
- 可與維度 5（應用方式）的「常見誤用」互補，但不重複：此維度著重**認知層面**，維度 5 著重**操作層面**

Section 標題：`## 常見偏誤 vs 反直覺`

---

## Connections Section

保持在卡片最末尾。格式：

```markdown
## Connections

- <符號> [[slug|顯示名稱]] — 連結理由（具體說明這條連結的知識意義）
```

關係符號：`~`（相關）、`→`（啟發）、`⇒`（支持）、`⊂`（包含）

從「相關名詞」中識別出的 vault 既有卡片，若語意關係強，加入 Connections。**不要把相關名詞全部加進來** — 只選有真實知識關聯的連結，每條連結都要能用一句話說清楚「為什麼這兩個概念有關係」。

---

## 輸出格式

```
✓ <card-title> 已升格為 <new-status>

**新增內容：**
- 由來：<一句話摘要>
- 案例：<n> 個（<情境1>、<情境2>...）
- 相關名詞：<n> 抽象 / <n> 橫向 / <n> 拆解
- 應用：<一句話摘要>
- 偏誤 vs 反直覺：<n> 個偏誤 / <n> 個反直覺洞見

**連結變更：** +<n> 個新連結
```

---

## 寫作規範

- **語言：** 全文 zh-TW
- **文風：** 清晰、有觀點、不廢話。每個 section 讓讀者覺得「這有幫助，不是在湊字數」
- **引言段落（卡片開頭）：** 2–3 句，說明概念定位和核心價值，不是定義複讀。應回答「這個概念為什麼值得記錄」
- **長度：** 以內容需要為準，不為長而長。growing 卡片通常 400–800 字，evergreen 可更長
- **不要在 Connections 重複已有的連結**（讀取現有卡片內容確認）
