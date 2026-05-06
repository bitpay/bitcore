#!/usr/bin/env node

import fs from 'fs';
import * as prompt from '@clack/prompts';

const args = process.argv.slice(2);

if (['help', '--help'].includes(args[0])) {
  console.log(`USAGE: ./workerRecordAnalyzer <logfile> [options]\n
Options:
  --include <path>  Only include records from the specified path
  --file <path>     Output data for specified file
`);
  process.exit(0);
}

const includeIndex = args.indexOf('--include');
let include = undefined;
if (includeIndex !== -1) {
  include = args[includeIndex + 1];
  args.splice(includeIndex, 2);
}

const fileIndex = args.indexOf('--file');
let file = undefined;
if (fileIndex !== -1) {
  file = args[fileIndex + 1];
  args.splice(fileIndex, 2);
}

let logFile = args[0];
if (logFile === undefined) {
  const logFiles = fs.readdirSync('.');

  const selectedLog = await prompt.select({
    message: 'Select a log file to analyze',
    options: logFiles.map(file => ({ value: file, name: file }))
  });

  logFile = selectedLog;
}

const logData = fs.readFileSync('./' + logFile, 'utf8');
if (file !== undefined) {
  outputFile(file);
  process.exit(0);
};

prompt.note('Analyzing ' + logFile + '...');
// eslint-disable-next-line no-control-regex
const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');

const separator = '\n\n' + '='.repeat(80) + '\n';

const sections = logData.split(separator).slice(1); // skip empty prefix

const content = sections.map(section => {
  const divider = '\n' + '='.repeat(80) + '\n';
  const dividerIdx = section.indexOf(divider);
  const filePath = section.slice(0, dividerIdx);
  if (include !== undefined && !filePath.startsWith(include)) return null;
  const linesRaw = section.slice(dividerIdx + divider.length);

  const lines = linesRaw.split('\n').filter(l => l.length > 0).map(rawLine => {
    const stripped = stripAnsi(rawLine);
    const pipeIdx = stripped.indexOf('| ');
    if (pipeIdx === -1) return null;

    const meta = stripped.slice(0, pipeIdx);
    const content = stripped.slice(pipeIdx + 2);
    const lineNum = parseInt(meta.slice(0, 4), 10);
    const hitsRaw = meta.slice(5).trim();
    const hits = hitsRaw === '' ? null : parseInt(hitsRaw, 10);

    return { lineNum, hits, content };
  }).filter(Boolean);

  const totalHits = lines.reduce((sum, l) => sum + (l.hits ?? 0), 0);
  return { filePath, lines, totalHits };
}).filter(f => f !== null);

const sortedFiles = content
  .filter(f => f.totalHits >= 1)
  .sort((a, b) => b.totalHits - a.totalHits);

const hitsWidth = Math.max(String(sortedFiles[0].totalHits).length, 'Total Hits'.length);

outputFile(await prompt.select({
  message: '',
  options: sortedFiles.map(
    f => ({
      value: f.filePath,
      label: `${String(f.totalHits).padStart(hitsWidth)} ${f.filePath}`
    })),
}));


function outputFile(filePath) {
  const header = '='.repeat(80) + '\n' + filePath + '\n' + '='.repeat(80) + '\n';
  const headerIndex = logData.indexOf(header);
  prompt.outro('\n' +
    logData.slice(
      headerIndex,
      logData.indexOf('='.repeat(80), headerIndex + header.length)
    )
  );
}
