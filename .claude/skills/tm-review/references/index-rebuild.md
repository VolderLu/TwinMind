# 索引完整重建程序

由 `tm:review` skill 的索引重建功能引用。

## Step 1 — 確認

若既有 `vault-index.json` 包含資料，先顯示目前卡片數與即將掃描的檔案數，要求使用者確認後才覆寫。

## Step 2 — 掃描檔案系統

1. 列出 `vault/Cards/` 和 `vault/Sources/` 中所有 `.md` 檔案
2. 逐一讀取 YAML frontmatter：`id`、`title`、`type`、`status`、`domain`、`confidence`、`source`、`related_projects`
3. 從 body 內容生成一句話 `summary`

## Step 3 — 重建連結

1. 掃描每個檔案 body 中的 `[[wiki-link]]` 模式
2. 解析 wiki-link 目標為對應卡片 ID，建立 `links_to` 陣列
3. 全部處理完後，從所有 `links_to` 反向計算每筆 `linked_from`
4. 計算每筆 `link_count`（`links_to.length + linked_from.length`）

## Step 4 — 組裝索引

1. 建立 `notes`（key 為 `id`）
2. 計算 `stats`：
   - `total_cards`：notes key 數量
   - `total_links`：所有 `links_to` 長度總和
   - `domains`：統計各 domain 出現次數
   - `last_updated`：當前 ISO 8601
3. 保留既有 `projects` 和 `areas`（若存在）；不存在則初始化空物件
4. `version` 設為 `1`

## Step 5 — 寫入

1. 寫入 `vault/System/vault-index.json`
2. 追加 `INDEX_REBUILT` changelog（記錄卡片總數）
