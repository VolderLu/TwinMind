/**
 * shim-writer.mjs: materializes the project-local helper layout under
 * <cwd>/.claude/twinmind/ so skills can invoke plugin scripts via stable
 * project-relative paths (no ${CLAUDE_PLUGIN_ROOT} expansion at runtime).
 *
 * Layout written:
 *   <cwd>/.claude/twinmind/config.json
 *   <cwd>/.claude/twinmind/bin/tm-post-op.mjs
 *   <cwd>/.claude/twinmind/bin/tm-update-index.mjs
 *   <cwd>/.claude/twinmind/bin/tm-fetch-title.mjs
 *
 * Writes are idempotent (byte-equal targets are skipped). Errors are returned
 * via the result object; the caller decides whether to surface them.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, '..', '..', 'templates', 'twinmind-bin');

const SHIM_NAMES = ['tm-post-op.mjs', 'tm-update-index.mjs', 'tm-fetch-title.mjs'];

function configBody(pluginRoot) {
  return `${JSON.stringify({ pluginRoot }, null, 2)}\n`;
}

function writeIfChanged(targetPath, desired) {
  try {
    if (readFileSync(targetPath, 'utf8') === desired) return 'unchanged';
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  writeFileSync(targetPath, desired);
  return 'written';
}

export function writeShimLayout({ pluginRoot, cwd }) {
  try {
    const root = join(cwd, '.claude', 'twinmind');
    const binDir = join(root, 'bin');
    mkdirSync(binDir, { recursive: true });

    const status = { config: 'unchanged', shims: {} };
    status.config = writeIfChanged(join(root, 'config.json'), configBody(pluginRoot));
    for (const name of SHIM_NAMES) {
      const template = readFileSync(join(templatesDir, name), 'utf8');
      status.shims[name] = writeIfChanged(join(binDir, name), template);
    }
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error };
  }
}
