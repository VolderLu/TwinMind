# MOC 檔案結構與管理

本文件定義 MOC（Map of Content）的完整結構和操作程序。由 `tm:post-op` 的 Step 2 引用。

## MOC 檔案結構

```markdown
# <Domain Name> Map of Content

<一句話描述此知識領域>

## Concepts
- 🌳 [[<slug>|<card title>]] — <card summary>
- 🌿 [[<slug>|<card title>]] — <card summary>
- 🌱 [[<slug>|<card title>]] — <card summary>

## Insights
- 🌱 [[<slug>|<card title>]] — <card summary>

## Sources
- 🌱 [[<slug>|<card title>]] — <card summary>

## Questions
- 🌱 [[<slug>|<card title>]] — <card summary>

---
*<N> cards · Last updated: <YYYY-MM-DD>*
```

**規則：**
- 卡片按 `type` 分為 4 組：Concepts、Insights、Sources、Questions
- 每組內按 `status` 排序：🌳 evergreen → 🌿 growing → 🌱 seed
- **空組省略** — 若該 type 無卡片，不顯示該區塊標題
- 卡片資料從 `vault-index.json` 的 `notes` 中篩選 `domain` 包含該 MOC 對應 domain 的條目
- MOC 檔名規則：domain 名稱首字母大寫（如 `technology` → `Atlas/Technology.md`）

## MOC 更新觸發矩陣

| 觸發事件 | MOC 行為 |
|----------|----------|
| 建卡 | 若 domain 有 MOC → 加入新卡片。若達 threshold 且無 MOC → 建立 |
| 刪卡 | 若 domain 有 MOC → 移除卡片。若降至 < threshold → 刪除 MOC |
| Domain 變更 | 舊 domain MOC 移除、新 domain MOC 加入，兩邊各自檢查 threshold |
| Status/Title/Summary 變更 | 更新 MOC 中該卡片的條目（emoji、title、summary） |

更新 MOC 時，從 `vault-index.json` 重新篩選該 domain 的所有 notes，按上述結構**重新生成完整內容**。

## MOC 拆分程序

當 MOC 內的卡片數超過 `moc_threshold_split`（讀取 config.md，預設 20）時：

1. 分析該 domain 下所有卡片的連結關係和子領域特徵，識別自然的子主題群組
2. 為每個子主題建立子 MOC 檔案：`Atlas/<Domain>-<Subtopic>.md`
3. 將原始 MOC 轉換為 parent MOC：

```markdown
# <Domain Name> Map of Content

<描述>

## Sub-topics
- [[Atlas/<Domain>-<Subtopic1>|<Subtopic1>]] (<count> cards)
- [[Atlas/<Domain>-<Subtopic2>|<Subtopic2>]] (<count> cards)

---
*<N> cards total · <M> sub-topics · Last updated: <YYYY-MM-DD>*
```

4. 追加 `MOC_SPLIT` changelog 條目

## MOC Changelog 格式

| EVENT_TYPE | 觸發時機 | 記錄內容 |
|---|---|---|
| `MOC_CREATED` | 新 MOC 建立 | domain 名稱、卡片數 |
| `MOC_UPDATED` | MOC 結構性變更（非例行卡片新增） | domain 名稱、變更摘要 |
| `MOC_SPLIT` | MOC 拆分為子 MOC | domain 名稱、子主題列表 |
| `MOC_DELETED` | MOC 刪除（domain 低於 threshold） | domain 名稱、原因 |

例行卡片新增/移除造成的 MOC 內容更新不記錄 `MOC_UPDATED`，以避免 changelog 噪音。僅在 MOC 結構改變時（拆分、大幅重組）才記錄。
