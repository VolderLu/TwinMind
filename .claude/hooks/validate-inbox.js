#!/usr/bin/env node

// PostToolUse hook: validates Inbox item frontmatter after Write/Edit on PARA/Inbox/*.md
// Exit 0 = pass (with context), Exit 2 = block (with error)

const fs = require('fs');

const REQUIRED_FIELDS = ['id', 'type', 'text', 'created', 'status'];
const VALID_TYPE = ['memo', 'idea'];
const VALID_STATUS = ['pending', 'promoted', 'dismissed'];

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
    fail('validate-inbox: Failed to parse hook stdin JSON');
  }

  const filePath = data?.tool_input?.file_path;
  if (!filePath) {
    succeed('validate-inbox: Skipped (no file_path)');
  }

  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/PARA/Inbox/')) {
    succeed('validate-inbox: Skipped (not a PARA/Inbox/ file)');
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    fail(`validate-inbox: Cannot read file ${filePath}`);
  }

  const fields = parseFrontmatter(content);
  if (!fields) {
    fail('validate-inbox: No YAML frontmatter found (missing --- delimiters)');
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in fields));
  if (missing.length > 0) {
    fail(`validate-inbox: Missing required field(s): ${missing.join(', ')}`);
  }

  if (!VALID_TYPE.includes(fields.type)) {
    fail(`validate-inbox: Invalid type "${fields.type}" (allowed: ${VALID_TYPE.join(', ')})`);
  }

  if (!VALID_STATUS.includes(fields.status)) {
    fail(`validate-inbox: Invalid status "${fields.status}" (allowed: ${VALID_STATUS.join(', ')})`);
  }

  succeed(`validate-inbox: OK — type=${fields.type}, status=${fields.status}`);
});
