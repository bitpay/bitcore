#!/usr/bin/env node

/**
 * Records the number of times each line is hit by the worker.
 * Intended to find where code stalls.
 */

import fs from 'fs';
import inspector from 'inspector';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const session = new inspector.Session();
session.connect();

const logFile = `executionLog-${new Date().toISOString()}.json`;

const args = process.argv.slice(2);
if (args.includes('--help') || args[0] === 'help') {
  console.log('USAGE: node ./workerRecorder.js <worker>\n' +
    '  <worker> worker to start: api, p2p, pruning, or all');
  process.exit(0);
}

const pausedIdx = args.indexOf('--paused');
let paused;
if (pausedIdx === -1) {
  paused = false;
} else {
  paused = true;
  args.splice(pausedIdx, 1);
}

const worker = args[0] || 'all';

function buildLineOffsets(source) {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

// Binary search: find the line index for a given character offset
function offsetToLine(lineOffsets, offset) {
  let lo = 0, hi = lineOffsets.length - 1;
  while (lo < hi) {
    // eslint-disable-next-line no-bitwise
    const mid = (lo + hi + 1) >> 1;
    if (lineOffsets[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const programExecution = {};
function save() {
  session.post('Profiler.takePreciseCoverage', (err, { result } = {}) => {
    if (err || !result) {
      console.error('[Worker Recorder] Error:', err);
      return;
    }
    console.log('[Worker Recorder] Collecting line hits...');

    for (const script of result) {
      const url = script.url;
      if (!url.startsWith('file://')) continue;

      const filePath = url.slice(7);

      let source;
      try {
        source = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lines = source.split('\n');
      if (!programExecution[filePath]) programExecution[filePath] = lines.map(l => ({ line: l, executions: 0 }));
      const fileExecution = programExecution[filePath];

      const lineOffsets = buildLineOffsets(source);

      // Count the hit counts based on function range data
      for (const func of script.functions) {
        for (const range of func.ranges) {
          const startLine = offsetToLine(lineOffsets, range.startOffset);
          const endLine = offsetToLine(lineOffsets, range.endOffset);
          for (let l = startLine; l <= endLine; l++) {
            fileExecution[l].executions += range.count;
          }
        }
      }
    }
  });
}

/* When the worker exits, log the line data to  */
process.on('exit', () => {
  save();
  fs.writeFileSync(logFile, JSON.stringify(programExecution));
});

function pause() {
  if (!paused) {
    console.log('[Worker Recorder] Pausing');
    save();
    paused = true;
  } else {
    console.log('[Worker Recorder] Already paused');
  }
}

function record() {
  if (paused) {
    console.log('[Worker Recorder] Recording');
    // Don't include previous sampling taken while paused
    session.post('Profiler.takePreciseCoverage');
    paused = false;
  } else {
    console.log('[Worker Recorder] Already recording');
  }
}

process.stdin.setRawMode(true);
process.stdin.resume();

process.stdin.on('data', (key) => {
  switch (getKeyName(key[0])) {
    case '^C':
      process.exit(0);
      break;
    case 'Delete':
      process.stdout.write('\b');
      break;
    case 'p':
      pause();
      break;
    case 'r':
      record();
      break;
    default:
      process.stdout.write(key);
      break;
  }
});

const getKeyName = (code) => {
  const specials = {
    9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space', 3: '^C',
    37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 127: 'Delete'
  };

  return specials[code] || String.fromCharCode(code);
};

console.log(getKeyName(9));  // 'Tab'
console.log(getKeyName(65)); // 'a'

// Start profiling
session.post('Profiler.enable');
session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });


// Start the worker
console.log(`[Worker Recorder] Starting ${worker.toString()}`);
const Worker = Object.values(require(`../build/src/workers/${worker}.js`))[0];
Worker();

// function testProgram() {
//   if (Date.now() % 2) {
//     console.log('[Test] Even');
//   } else {
//     console.log('[Test] Odd');
//   }
//   setTimeout(testProgram, 500);
// }
// testProgram();
