#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as prompt from '@clack/prompts';

const args = process.argv.slice(2);

if (['help', '--help'].includes(args[0])) {
  console.log(`USAGE: ./workerRecordAnalyzer <logfile> [options]\n
Options:
  --include <path>  Only include records from the specified path
  --file <path>     Output data for specified file
  --sort <type>     Sort files with the given criteria:
                      total (default): total lines executed
                      most-hit-line: most executed line
                      average: average executions per line
                      abc: alphabetical order
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

const sortTypeIndex = args.indexOf('--sort');
let sortType = 'total';
if (sortTypeIndex !== -1) {
  sortType = args[sortTypeIndex + 1];
  args.splice(sortTypeIndex, 2);
}

let logFile = args[0];
if (logFile === undefined) {
  async function selectFrom(folder) {
    const logFiles = fs.readdirSync(folder);

    const selectedLog = path.join(folder, await prompt.select({
      message: 'Select a log file to analyze',
      options: [
        { value: '..' },
        ...logFiles.map(file => ({ value: file }))
      ]
    }));
    if (fs.statSync(selectedLog).isFile()) {
      return selectedLog;
    }
    return await selectFrom(selectedLog);
  }

  logFile = await selectFrom('.');
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

const lineData = sections.map(section => {
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

let criteria;
switch (sortType) {
  case 'most-hit-line':
    criteria = (a, b) => Math.max(...b.lines.map(l => l.hits || 0)) - Math.max(...a.lines.map(l => l.hits || 0));
    break;
  case 'average':
    criteria = (a, b) => (b.totalHits / b.lines.length).toFixed(2) - (a.totalHits / a.lines.length).toFixed(2);
    break;
  case 'abc':
    criteria = (a, b) => a.filePath.localeCompare(b.filePath);
    break;
  case 'total':
  default:
    criteria = (a, b) => b.totalHits - a.totalHits;
}

const sortedFiles = lineData
  .filter(f => f.totalHits >= 1)
  .sort(criteria);

const hitsWidth = Math.max(String(sortedFiles[0].totalHits).length, 'Total Hits'.length);

// Recursively select a file and go back to file list until exit
async function selectFile() {
  let criteria;
  let message;
  switch (sortType) {
    case 'most-hit-line':
      criteria = f => Math.max(...f.lines.map(l => l.hits || 0));
      message = 'Sorted by file with the most executed line';
      break;
    case 'average':
      criteria = f => (f.totalHits / f.lines.length).toFixed(2);
      message = 'Sorted by average executions per a line of a file';
      break;
    case 'abc':
      criteria = f => f.totalHits;
      message = 'Sorted by alphabetical order';
      break;
    case 'total':
    default:
      criteria = f => f.totalHits;
      message = 'Sorted by total executions of all the lines of a file';
  }

  outputFile(await prompt.select({
    message,
    options: sortedFiles.map(
      f => ({
        value: f.filePath,
        label: `${String(criteria(f)).padStart(hitsWidth)} ${f.filePath}`
      })),
  }));
  const exit = await prompt.select({
    message: '',
    options: [
      { value: false, label: 'Continue' },
      { value: true, label: 'Exit' },
    ],
  });

  if (exit) process.exit(0);
  selectFile();
}

await selectFile();

function outputFile(filePath) {
  const header = '='.repeat(80) + '\n' + filePath + '\n' + '='.repeat(80) + '\n';
  const headerIndex = logData.indexOf(header);
  prompt.note('\n' +
    logData.slice(
      headerIndex,
      logData.indexOf('='.repeat(80), headerIndex + header.length)
    )
  );
}
