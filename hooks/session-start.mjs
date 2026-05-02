#!/usr/bin/env node
/**
 * session-start.mjs: SessionStart hook for TwinMind plugin.
 *
 * Detects TwinMind projects by checking for TwinMind.md in the working directory.
 * If found:
 *   1. Materialize <cwd>/.claude/twinmind/{config.json,bin/*.mjs} so skills can
 *      invoke plugin scripts via stable project-relative paths.
 *   2. Emit router-prompt.md content to stdout for context injection.
 *
 * Cross-platform: uses only Node.js built-ins, no shell dependencies.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeShimLayout } from './lib/shim-writer.mjs';

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cwd = input.cwd;

  if (!cwd) {
    process.exit(0);
  }

  const configPath = join(cwd, 'TwinMind.md');
  if (!existsSync(configPath)) {
    process.exit(0);
  }

  const pluginRoot = join(import.meta.dirname, '..');

  const result = writeShimLayout({ pluginRoot, cwd });
  if (!result.ok) {
    process.stderr.write(`twinmind shim-writer: ${result.error.message}\n`);
  }

  try {
    const content = readFileSync(join(pluginRoot, 'router-prompt.md'), 'utf8');
    process.stdout.write(content);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

main().catch((e) => {
  process.stderr.write(`twinmind session-start: ${e.message}\n`);
  process.exit(0);
});
