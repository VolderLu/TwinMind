#!/usr/bin/env node

// PostToolUse hook: validates project actions.md/tasks.md frontmatter after Write/Edit
// Checks: frontmatter exists, project field matches directory name, updated field present
// Exit 0 = pass (with context), Exit 2 = block (with error)

const fs = require('fs');
const path = require('path');

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
    fail('validate-project-files: Failed to parse hook stdin JSON');
  }

  const filePath = data?.tool_input?.file_path;
  if (!filePath) {
    succeed('validate-project-files: Skipped (no file_path)');
  }

  const normalized = filePath.replace(/\\/g, '/');

  // Only validate actions.md and tasks.md inside PARA/Projects/*/
  if (!normalized.includes('/PARA/Projects/')) {
    succeed('validate-project-files: Skipped (not a PARA/Projects/ file)');
  }

  const basename = path.basename(normalized);
  if (basename !== 'actions.md' && basename !== 'tasks.md') {
    succeed('validate-project-files: Skipped (not actions.md or tasks.md)');
  }

  // Extract project directory name from path
  const match = normalized.match(/\/PARA\/Projects\/([^/]+)\//);
  if (!match) {
    succeed('validate-project-files: Skipped (cannot extract project name from path)');
  }
  const expectedProject = match[1];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    fail(`validate-project-files: Cannot read file ${filePath}`);
  }

  const fields = parseFrontmatter(content);
  if (!fields) {
    fail('validate-project-files: No YAML frontmatter found (missing --- delimiters)');
  }

  if (!('project' in fields)) {
    fail('validate-project-files: Missing required field: project');
  }

  if (!('updated' in fields)) {
    fail('validate-project-files: Missing required field: updated');
  }

  if (fields.project !== expectedProject) {
    fail(`validate-project-files: Project field mismatch — frontmatter says "${fields.project}", directory is "${expectedProject}"`);
  }

  succeed(`validate-project-files: OK — project=${fields.project}, file=${basename}`);
});
