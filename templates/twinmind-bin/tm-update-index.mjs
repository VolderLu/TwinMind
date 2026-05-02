#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(here, '..', 'config.json');

let pluginRoot;
try {
  pluginRoot = JSON.parse(readFileSync(cfgPath, 'utf8')).pluginRoot;
} catch (e) {
  process.stderr.write(`tm-update-index: cannot read ${cfgPath}: ${e.message}\n`);
  process.exit(1);
}

const target = join(pluginRoot, 'scripts', 'update-index.mjs');
const child = spawn(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('error', (e) => {
  process.stderr.write(`tm-update-index: spawn failed: ${e.message}\n`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
