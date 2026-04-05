---
title: vault-index.json Schema
description: AI 知識庫索引的完整資料結構定義與一致性規則
updated: 2026-03-28
---

# vault-index.json Schema

`System/vault-index.json` 是 AI 的工作記憶。每次 Claude Code session 啟動時讀取此檔案即可理解整個知識庫的狀態。

## Top-level Structure

```json
{
  "version": 1,
  "stats": { ... },
  "notes": { ... },
  "projects": { ... },
  "areas": { ... }
}
```

- `version`: 整數，schema 變更時遞增
- `stats`: 全局統計資訊
- `notes`: 所有卡片的元資料
- `projects`: 所有專案的狀態
- `areas`: 所有領域的狀態

## Note Entry Schema

每筆 note 以時間戳 ID（格式 `YYYYMMDDHHmmss`）作為 key：

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `title` | string | YES | 人類可讀的筆記標題 |
| `path` | string | YES | 從 vault 根目錄的相對路徑（如 `Cards/rust-ownership.md`）|
| `type` | string | YES | 卡片類型：`concept` / `insight` / `source` / `question` |
| `status` | string | YES | 成熟度：`seed` / `growing` / `evergreen` |
| `domain` | string[] | YES | 領域標籤列表 |
| `summary` | string | YES | 一句話摘要，用於語意比對 |
| `links_to` | string[] | YES | 此筆記連結到的其他筆記 ID |
| `linked_from` | string[] | YES | 連結到此筆記的其他筆記 ID |
| `link_count` | number | YES | 雙向連結總數 |

範例：

```json
{
  "20260328143022": {
    "title": "Rust 所有權機制",
    "path": "Cards/rust-ownership.md",
    "type": "concept",
    "status": "growing",
    "domain": ["technology", "programming"],
    "summary": "Rust 的所有權系統確保記憶體安全，類似 C++ RAII",
    "links_to": ["20260301120000"],
    "linked_from": ["20260320090000"],
    "link_count": 2
  }
}
```

## Project Entry Schema

每筆 project 以專案目錄名稱作為 key：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `status` | string | 狀態：`active` / `paused` / `completed` |
| `card_refs` | number | 引用此專案的卡片數量 |

範例：

```json
{
  "learn-rust": {
    "status": "active",
    "card_refs": 5
  }
}
```

## Area Entry Schema

每筆 area 以領域檔名（不含副檔名）作為 key：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `card_refs` | number | 引用此領域的卡片數量 |

範例：

```json
{
  "career": {
    "card_refs": 3
  }
}
```

## Index Consistency Rules

1. **原子更新**: 每次操作必須同時更新所有相關欄位。建立一張卡片時，必須一次完成：新增 `notes` 條目、更新所有被連結卡片的 `linked_from`、更新 `stats`。
2. **Stats 即時反映**: `stats.total_cards` 必須等於 `notes` 物件的 key 數量。`stats.total_links` 必須等於所有 note 的 `links_to` 陣列長度總和。`stats.domains` 必須反映各 domain 的實際卡片數。
3. **雙向一致**: 如果 A 的 `links_to` 包含 B，則 B 的 `linked_from` 必須包含 A。
4. **時間戳更新**: 每次修改 index 後，`stats.last_updated` 必須更新為當前時間。
