#!/usr/bin/env node

// PostToolUse hook: validates standalone Action frontmatter after Write/Edit on PARA/Actions/*.md
// Exit 0 = pass (with context), Exit 2 = block (with error)

const fs = require('fs');

const REQUIRED_FIELDS = ['id', 'title', 'status', 'created'];
const VALID_STATUS = ['active', 'done'];

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
    fail('validate-action: Failed to parse hook stdin JSON');
  }

  const filePath = data?.tool_input?.file_path;
  if (!filePath) {
    succeed('validate-action: Skipped (no file_path)');
  }

  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/PARA/Actions/')) {
    succeed('validate-action: Skipped (not a PARA/Actions/ file)');
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    fail(`validate-action: Cannot read file ${filePath}`);
  }

  const fields = parseFrontmatter(content);
  if (!fields) {
    fail('validate-action: No YAML frontmatter found (missing --- delimiters)');
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in fields));
  if (missing.length > 0) {
    fail(`validate-action: Missing required field(s): ${missing.join(', ')}`);
  }

  if (!VALID_STATUS.includes(fields.status)) {
    fail(`validate-action: Invalid status "${fields.status}" (allowed: ${VALID_STATUS.join(', ')})`);
  }

  succeed(`validate-action: OK — title=${fields.title}, status=${fields.status}`);
});
