# 知識健康報告指標定義

由 `tm:review` skill 的健康報告功能引用。

## 指標 1 — 孤島卡片（Isolated Cards）

掃描所有 `notes`，篩選 `link_count == 0` 的卡片。
- 有孤島卡片：列出每張的 title、type、domain、path。計 1 個警告。
- 無孤島卡片：「無孤島卡片」

## 指標 2 — 領域偏斜（Domain Skew）

從 `stats.domains` 計算各 domain 佔 `total_cards` 的比例。

- 任一 domain 佔比 > 50% → 警告「領域偏斜」，標明 domain 與百分比
- `total_cards` > 10 且 domain 數 < 3 → 警告「領域多樣性不足」
- 每個觸發的條件各計 1 個警告

## 指標 3 — Seed 堆積率（Seed Accumulation）

計算 seed 數 / `total_cards`。

- > 60% → 警告「Seed 堆積」，標明百分比
- ≤ 60% → 顯示百分比，不附警告

## 指標 4 — 連結密度（Link Density）

計算 `total_links` / `total_cards`。

- 密度 < 1.0 且 total_cards > 5 → 警告「連結密度偏低」
- 密度 ≥ 1.0 或 total_cards ≤ 5 → 顯示數值，不附警告

## 整體評級

| 警告數 | 評級 |
|--------|------|
| 0 | 良好 |
| 1–2 | 尚可 |
| ≥ 3 | 需要關注 |

## 報告格式

1. 頂部顯示整體評級
2. 依序列出四項指標，每項標示正常或警告（含數據）
3. 若有警告，末尾彙總改善建議
