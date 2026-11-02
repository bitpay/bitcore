#!/usr/bin/env node
'use strict';

// CLI dispatcher for the npm-workspaces migration acceptance checks
// (docs/workspaces/acceptance-spec.md §4). Each mode's actual
// logic lives in ./lib/<mode>.cjs so it can also be exercised directly by
// the fixtures under test/workspaces/.
//
// Usage:
//   node scripts/workspaces/verify.cjs manifests [--structure-only]
//   node scripts/workspaces/verify.cjs lock
//   node scripts/workspaces/verify.cjs engines
//   node scripts/workspaces/verify.cjs links
//   node scripts/workspaces/verify.cjs artifacts --stage=build
//   node scripts/workspaces/verify.cjs artifacts --stage=test-fixtures --workspace=<scoped-name>

const path = require('path');

const MODES = ['manifests', 'lock', 'engines', 'links', 'artifacts'];

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const flags = { structureOnly: false, stage: null, workspace: null };
  for (const arg of rest) {
    if (arg === '--structure-only') {
      flags.structureOnly = true;
    } else if (arg.startsWith('--stage=')) {
      flags.stage = arg.slice('--stage='.length);
    } else if (arg.startsWith('--workspace=')) {
      flags.workspace = arg.slice('--workspace='.length);
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }
  return { mode, flags };
}

function main() {
  const rootDir = path.resolve(__dirname, '..', '..');
  let mode, flags;
  try {
    ({ mode, flags } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`[verify] ${err.message}`);
    console.error(`[verify] Usage: node scripts/workspaces/verify.cjs <${MODES.join('|')}> [flags]`);
    process.exitCode = 2;
    return;
  }

  if (!MODES.includes(mode)) {
    console.error(`[verify] Unknown mode "${mode}". Expected one of: ${MODES.join(', ')}.`);
    process.exitCode = 2;
    return;
  }

  let result;
  try {
    if (mode === 'manifests') {
      result = require('./lib/manifests.cjs').run({ rootDir, structureOnly: flags.structureOnly });
    } else if (mode === 'lock') {
      result = require('./lib/lock.cjs').run({ rootDir });
    } else if (mode === 'engines') {
      result = require('./lib/engines.cjs').run({ rootDir });
    } else if (mode === 'links') {
      result = require('./lib/links.cjs').run({ rootDir });
    } else if (mode === 'artifacts') {
      result = require('./lib/artifacts.cjs').run({ rootDir, stage: flags.stage, workspace: flags.workspace });
    }
  } catch (err) {
    console.error(`[verify:${mode}] Unexpected error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
    return;
  }

  // acceptance-spec §4: link resolution "records both [the lexical resolved
  // path and the canonical real path] for every internal edge" -- required
  // evidence, not opt-in verbosity, so it is printed regardless of pass/fail.
  if (result.report) {
    console.log(`[verify:${mode}] resolution report (${result.report.length} internal edge(s)):`);
    for (const entry of result.report) {
      console.log(
        `  - ${entry.workspace} <- ${entry.consumer}: lexical=${entry.lexicalPath} real=${entry.realPath}${entry.ok ? '' : ' (FAILED)'}`
      );
    }
  }

  if (result.ok) {
    console.log(`[verify:${mode}] PASS`);
    if (result.exceptions && result.exceptions.length > 0) {
      console.log(`[verify:${mode}] documented exceptions:`);
      for (const exception of result.exceptions) {
        console.log(`  - ${exception.name}@${exception.version} (engines.node: ${exception.range})`);
      }
    }
    return;
  }

  console.error(`[verify:${mode}] FAIL (${result.failures.length} problem(s)):`);
  for (const failure of result.failures) {
    console.error(failure);
  }
  process.exitCode = 1;
}

main();
