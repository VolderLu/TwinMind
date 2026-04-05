#!/usr/bin/env node

// PostToolUse hook: validates card frontmatter after Write/Edit on Cards/*.md or Sources/*.md
// Exit 0 = pass (with context), Exit 2 = block (with error)

const fs = require('fs');

const REQUIRED_FIELDS = ['id', 'title', 'type', 'status', 'domain', 'created', 'updated'];
const VALID_TYPE = ['concept', 'insight', 'source', 'question'];
const VALID_STATUS = ['seed', 'growing', 'evergreen'];
const VALID_CONFIDENCE = ['low', 'medium', 'high'];

function fail(msg) {
  process.stderr.write(msg + '\n');
  process.exit(2);
}

function succeed(msg) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: msg
    }
  };
  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(0);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const yaml = match[1];
  const fields = {};
  for (const line of yaml.split(/\r?\n/)) {
    const m = line.match(/^(\w[\w_]*):\s*(.*)/);
    if (m) {
      let value = m[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      fields[m[1]] = value;
    }
  }
  return fields;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    fail('validate-card: Failed to parse hook stdin JSON');
  }

  const filePath = data?.tool_input?.file_path;
  if (!filePath) {
    fail('validate-card: No file_path in tool_input');
  }

  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/Cards/') && !normalized.includes('/Sources/')) {
    succeed('validate-card: Skipped (not a Cards/ or Sources/ file)');
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    fail(`validate-card: Cannot read file ${filePath}`);
  }

  const fields = parseFrontmatter(content);
  if (!fields) {
    fail('validate-card: No YAML frontmatter found (missing --- delimiters)');
  }

  // Check required fields
  const missing = REQUIRED_FIELDS.filter(f => !(f in fields));
  if (missing.length > 0) {
    fail(`validate-card: Missing required field(s): ${missing.join(', ')}`);
  }

  // Validate type enum
  if (!VALID_TYPE.includes(fields.type)) {
    fail(`validate-card: Invalid type "${fields.type}" (allowed: ${VALID_TYPE.join(', ')})`);
  }

  // Validate status enum
  if (!VALID_STATUS.includes(fields.status)) {
    fail(`validate-card: Invalid status "${fields.status}" (allowed: ${VALID_STATUS.join(', ')})`);
  }

  // Validate confidence enum (optional field)
  if ('confidence' in fields && !VALID_CONFIDENCE.includes(fields.confidence)) {
    fail(`validate-card: Invalid confidence "${fields.confidence}" (allowed: ${VALID_CONFIDENCE.join(', ')})`);
  }

  succeed(`validate-card: OK — type=${fields.type}, status=${fields.status}`);
});
