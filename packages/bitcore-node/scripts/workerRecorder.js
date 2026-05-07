#!/usr/bin/env node

/**
 * Records the number of times each line is hit by the worker.
 * Intended to find where code stalls.
 */

import fs from 'fs';
import inspector from 'inspector';
import { timestamp } from '@bitpay-labs/bitcore-logging';
import { FullClusteredWorker } from '../build/src/workers/all.js';
import { ClusteredApiWorker } from '../build/src/workers/api.js';
import { P2pWorker } from '../build/src/workers/p2p.js';
import { PruningWorker } from '../build/src/workers/pruning.js';

const session = new inspector.Session();
session.connect();

const logFile = `lineHits-${timestamp()}.log`;

const args = process.argv.slice(2);
if (args.includes('--help') || args[0] === 'help') {
  console.log('USAGE: node ./workerRecorder.js <worker: api, p2p, all, or pruning>');
  process.exit(0);
}

const worker = args[0];

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

/* When the worker exits, log the line data to  */
process.on('exit', () => {
  session.post('Profiler.takePreciseCoverage', (err, { result } = {}) => {
    if (err || !result) {
      console.error('[Worker Recorder] Error:', err);
      return;
    }
    console.log('[Worker Recorder] Collecting line hits...');

    let logContent = '';
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
      const lineOffsets = buildLineOffsets(source);
      // null = no range touched this line, 0 = range exists but count 0, N = hit N times
      const lineHits = new Array(lines.length).fill(null);

      // Count the hit counts based on function range data
      for (const func of script.functions) {
        for (const range of func.ranges) {
          const startLine = offsetToLine(lineOffsets, range.startOffset);
          const endLine = offsetToLine(lineOffsets, range.endOffset);
          for (let l = startLine; l <= endLine; l++) {
            lineHits[l] = Math.max(lineHits[l] ?? 0, range.count);
          }
        }
      }

      // File headers separate files
      logContent += `\n\n${'='.repeat(80)}`;
      logContent += `\n${filePath}`;
      logContent += `\n${'='.repeat(80)}`;

      // Annotates files with hit counts
      for (let i = 0; i < lines.length; i++) {
        const hits = lineHits[i];
        let hitsStr;
        if (hits === null) hitsStr = '      ';         // no data
        else hitsStr = `\x1b[32m${hits}\x1b[0m`.padStart(14) + ' '; // green: hit N times

        const lineNum = String(i + 1).padStart(4);
        logContent += `\n${lineNum} ${hitsStr}| ${lines[i]}`;
      };
    }

    fs.writeFileSync(logFile, logContent);
  });
});

// Start profiling
session.post('Profiler.enable');
session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });

// Start the worker
switch (worker) {
  case 'api':
    console.log('[Worker Recorder] Starting API worker');
    ClusteredApiWorker();
    break;
  case 'p2p':
    console.log('[Worker Recorder] Starting P2P worker');
    P2pWorker();
    break;
  case 'pruning':
    console.log('[Worker Recorder] Starting pruning worker');
    PruningWorker();
    break;
  case 'all':
  default:
    console.log('[Worker Recorder] Starting full clustered worker');
    FullClusteredWorker();
    break;
}
