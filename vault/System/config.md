---
vault_name: "TwinMind"
locale: "zh-TW"
moc_threshold_create: 5
moc_threshold_split: 20
recent_cards_count: 5
default_card_type: "concept"
memo_stale_days: 7
action_stale_days: 14
domains: []
---

# TwinMind 系統配置

## 設定說明

| 設定 | 說明 |
|------|------|
| `vault_name` | 知識庫顯示名稱 |
| `locale` | AI 生成內容的語言 |
| `moc_threshold_create` | 某領域累積多少張卡片後自動建立 MOC |
| `moc_threshold_split` | MOC 內卡片數超過此值時自動拆分為子 MOC |
| `recent_cards_count` | Home.md「最近新增」區塊顯示的筆記數量 |
| `default_card_type` | AI 無法判斷卡片類型時的預設值 |
| `memo_stale_days` | Inbox memo 超過此天數未處理視為 stale，Session 啟動時提醒 |
| `action_stale_days` | 獨立 Action 超過此天數未完成視為 stale，Session 啟動時提醒 |
| `domains` | 預定義的領域標籤，AI 分類時優先使用；仍可建立新標籤 |
