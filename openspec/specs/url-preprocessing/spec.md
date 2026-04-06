## ADDED Requirements

### Requirement: URL detection in user input

tm:capture SHALL scan the user's input for external URLs before writing the card body (Step 4.5). Internal wiki-links (`[[...]]`) SHALL NOT be processed.

#### Scenario: Input contains external URLs

- **WHEN** user input contains one or more HTTP/HTTPS URLs
- **THEN** the system extracts all unique URLs into a list for title fetching

#### Scenario: Input contains no URLs

- **WHEN** user input contains no HTTP/HTTPS URLs
- **THEN** the system skips Step 4.5 entirely and proceeds to Step 5

### Requirement: User-provided title extraction

Before fetching, the system SHALL check the user's input for URLs that already have an explicit title (e.g., "這篇《Rust 指南》 `https://...`"). These URLs SHALL be written directly into the mapping without fetching.

#### Scenario: User provides explicit title for a URL

- **WHEN** user input includes an explicit title adjacent to a URL
- **THEN** the system writes the user-provided title into the mapping and excludes that URL from fetching

#### Scenario: No user-provided titles

- **WHEN** no URLs in the input have explicit titles
- **THEN** all URLs proceed to batch fetching

### Requirement: Batch title fetching for remaining URLs

The system SHALL execute `node scripts/fetch-title.mjs` only for URLs that lack a user-provided title, in a single batch call.

#### Scenario: All remaining URLs resolve successfully

- **WHEN** fetch-title.mjs returns titles for all remaining URLs
- **THEN** the system merges fetched titles into the mapping

#### Scenario: Some URLs fail to resolve

- **WHEN** fetch-title.mjs fails to return a title for one or more URLs
- **THEN** the system applies fallback per URL: attempt slug-based title inference first, then fall back to bare URL (`<url>`)

#### Scenario: All URLs fail to resolve

- **WHEN** fetch-title.mjs fails for all URLs (e.g., offline environment)
- **THEN** the system applies fallback for each URL and proceeds to body writing without blocking

#### Scenario: All URLs have user-provided titles

- **WHEN** every detected URL already has a user-provided title
- **THEN** the system skips fetch-title.mjs entirely

### Requirement: Title mapping consumed during body writing

During Step 5 (card body writing), the AI SHALL use the url→title mapping to format every external URL as `[title](url)`. The mapping already contains the final resolved title per URL (user-provided, fetched, or slug-inferred from Step 4.5); Step 5 consumes the mapping without additional priority logic.

#### Scenario: Mapping contains a title

- **WHEN** the mapping contains a title for a URL appearing in the body
- **THEN** the URL is formatted as `[title](url)`

#### Scenario: No title available (fallback)

- **WHEN** the mapping has no title for a URL (all resolution methods failed)
- **THEN** the URL is formatted as a bare link `<url>`

### Requirement: CLAUDE.md link preference removed

CLAUDE.md's "Markdown 注意事項 → 連結偏好" bullet SHALL be removed entirely. Link formatting logic is owned exclusively by tm:capture Step 4.5.

#### Scenario: Non-tm context encounters a URL

- **WHEN** AI writes markdown outside of tm workflows (e.g., changelog, general response)
- **THEN** AI formats URLs at its own discretion; no prescribed link formatting rule exists in CLAUDE.md
