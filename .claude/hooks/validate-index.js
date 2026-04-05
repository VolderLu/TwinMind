#!/usr/bin/env node

// PostToolUse hook: validates vault-index.json consistency after Write
// Checks: JSON syntax, total_cards, total_links, bidirectional links, domain counts
// Exit 0 = pass (with context), Exit 2 = block (with error)

const fs = require('fs');

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

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    fail('validate-index: Failed to parse hook stdin JSON');
  }

  const filePath = data?.tool_input?.file_path;
  if (!filePath) {
    succeed('validate-index: Skipped (no file_path)');
  }

  // Only validate vault-index.json
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.endsWith('/vault-index.json') && !normalized.endsWith('/System/vault-index.json')) {
    succeed('validate-index: Skipped (not vault-index.json)');
  }

  // Invariant 1: JSON syntax
  let index;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    index = JSON.parse(raw);
  } catch (e) {
    fail(`validate-index: Invalid JSON — ${e.message}`);
  }

  const notes = index.notes || {};
  const stats = index.stats || {};
  const noteIds = Object.keys(notes);

  // Invariant 2: total_cards == notes key count
  const actualCards = noteIds.length;
  if (stats.total_cards !== actualCards) {
    fail(`validate-index: total_cards mismatch — stats says ${stats.total_cards}, actual notes count is ${actualCards}`);
  }

  // Invariant 3: total_links == sum of all links_to lengths
  let totalLinksTo = 0;
  for (const id of noteIds) {
    const linksTo = notes[id].links_to;
    if (Array.isArray(linksTo)) {
      totalLinksTo += linksTo.length;
    }
  }
  if (stats.total_links !== totalLinksTo) {
    fail(`validate-index: total_links mismatch — stats says ${stats.total_links}, sum of links_to is ${totalLinksTo}`);
  }

  // Invariant 4: Bidirectional link integrity
  for (const idA of noteIds) {
    const linksTo = notes[idA].links_to || [];
    for (const idB of linksTo) {
      if (!notes[idB]) {
        fail(`validate-index: Broken link — note ${idA} links_to ${idB}, but note ${idB} does not exist`);
      }
      const linkedFrom = notes[idB].linked_from || [];
      if (!linkedFrom.includes(idA)) {
        fail(`validate-index: Bidirectional break — note ${idA} links_to ${idB}, but ${idB}.linked_from does not contain ${idA}`);
      }
    }
    const linkedFrom = notes[idA].linked_from || [];
    for (const idB of linkedFrom) {
      if (!notes[idB]) {
        fail(`validate-index: Broken backlink — note ${idA} linked_from ${idB}, but note ${idB} does not exist`);
      }
      const otherLinksTo = notes[idB].links_to || [];
      if (!otherLinksTo.includes(idA)) {
        fail(`validate-index: Bidirectional break — note ${idA} linked_from ${idB}, but ${idB}.links_to does not contain ${idA}`);
      }
    }
  }

  // Invariant 5: Version check
  if (stats.version !== undefined || index.version !== undefined) {
    const ver = index.version;
    if (ver !== 2) {
      fail(`validate-index: Version mismatch — expected 2, got ${ver}`);
    }
  }

  // Invariant 6: Inbox count
  const inbox = index.inbox || {};
  const pendingInbox = Object.values(inbox).filter(i => i.status === 'pending').length;
  if (stats.total_inbox !== undefined && stats.total_inbox !== pendingInbox) {
    fail(`validate-index: total_inbox mismatch — stats says ${stats.total_inbox}, actual pending inbox count is ${pendingInbox}`);
  }

  // Invariant 7: Actions count
  const standaloneActions = index.standalone_actions || {};
  const activeActions = Object.values(standaloneActions).filter(a => a.status === 'active').length;
  if (stats.total_actions !== undefined && stats.total_actions !== activeActions) {
    fail(`validate-index: total_actions mismatch — stats says ${stats.total_actions}, actual active standalone actions is ${activeActions}`);
  }

  // Invariant 8: Standalone tasks count
  const standaloneTasks = index.standalone_tasks || [];
  const activeTasks = standaloneTasks.filter(t => !t.done).length;
  if (stats.total_tasks_standalone !== undefined && stats.total_tasks_standalone !== activeTasks) {
    fail(`validate-index: total_tasks_standalone mismatch — stats says ${stats.total_tasks_standalone}, actual active standalone tasks is ${activeTasks}`);
  }

  // Invariant 9: Domain counts (was invariant 5)
  const domainCounts = {};
  for (const id of noteIds) {
    const domains = notes[id].domain || [];
    for (const d of domains) {
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }
  }
  const statsDomains = stats.domains || {};
  // Check stats domains match actual
  for (const d of Object.keys(statsDomains)) {
    const actual = domainCounts[d] || 0;
    if (statsDomains[d] !== actual) {
      fail(`validate-index: Domain count mismatch for "${d}" — stats says ${statsDomains[d]}, actual is ${actual}`);
    }
  }
  // Check actual domains exist in stats
  for (const d of Object.keys(domainCounts)) {
    if (!(d in statsDomains)) {
      fail(`validate-index: Domain "${d}" found in ${domainCounts[d]} note(s) but missing from stats.domains`);
    }
  }

  succeed(`validate-index: OK — cards=${actualCards}, links=${totalLinksTo}, inbox=${pendingInbox}, actions=${activeActions}, tasks=${activeTasks}, last_updated=${stats.last_updated || 'unknown'}`);
});
