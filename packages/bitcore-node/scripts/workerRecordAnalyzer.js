#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as prompt from '@clack/prompts';

const args = process.argv.slice(2);

if (['help', '--help'].includes(args[0])) {
  console.log(`USAGE: ./workerRecordAnalyzer <logfile> [options]\n
Options:
  --include <path>  Only include records from the specified path
  --recent          Use the most recent log file in the current directory
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

let logFile;
const recentIndex = args.indexOf('--recent');
if (recentIndex !== -1) {
  args.splice(recentIndex, 1);
  const dirFiles = fs
    .readdirSync('.')
    .filter(f => f.startsWith('executionLog-') && f.endsWith('.json'));

  const start = 'executionLog-'.length;
  let newest = 0;
  let index;
  for (let i = 0; i < dirFiles.length; i++) {
    const file = dirFiles[i];
    const time = new Date(file.substring(start, file.length - 5)).getTime();
    if (time > newest) {
      newest = time;
      index = i;
    }
  }
  logFile = dirFiles[index];
} else {
  logFile = args[0];
};

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
let executionData = JSON.parse(logData);
if (include !== undefined) {
  executionData = Object.fromEntries(
    Object.entries(executionData)
      .filter(([filePath]) => filePath.includes(include))
  );
}
const metaData = {};
for (const filePath in executionData) {
  const total = executionData[filePath].reduce((a, b) => a + b.executions, 0);
  metaData[filePath] = {
    total,
    average: total / executionData[filePath].length,
    most: Math.max(...executionData[filePath].map(l => l.executions)),
  };
}

let sortedFiles = Object.keys(executionData)
  .filter(filePath => executionData[filePath].some(d => d.executions >= 1));
switch (sortType) {
  case 'most-hit-line':
    sortedFiles = sortedFiles.sort((fileA, fileB) => metaData[fileB].most - metaData[fileA].most);
    break;
  case 'average':
    sortedFiles = sortedFiles.sort((fileA, fileB) => metaData[fileB].average - metaData[fileA].average);
    break;
  case 'abc':
    sortedFiles = sortedFiles.sort((fileA, fileB) => fileA.localeCompare(fileB));
    break;
  case 'total':
  default:
    sortedFiles = sortedFiles.sort((fileA, fileB) => metaData[fileB].total - metaData[fileA].total);
}

// Recursively select a file and go back to file list until exit
async function selectFile() {
  let criteria;
  let message;
  switch (sortType) {
    case 'most-hit-line':
      criteria = f => metaData[f].most;
      message = 'Sorted by file with the most executed line';
      break;
    case 'average':
      criteria = f => metaData[f].average.toFixed(2);
      message = 'Sorted by average executions per a line of a file';
      break;
    case 'abc':
      // Show total file executions even though the files aren't sorted by executions
      criteria = f => metaData[f].total;
      message = 'Sorted by alphabetical order';
      break;
    case 'total':
    default:
      criteria = f => metaData[f].total;
      message = 'Sorted by total executions of all the lines of a file';
  }

  outputFile(await prompt.select({
    message,
    options: sortedFiles.map(
      filePath => ({
        value: filePath,
        label: `${String(criteria(filePath)).padStart(8)} ${filePath}`
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
  const fileExecution = executionData[filePath];
  const padding = Math.max(Math.floor(Math.log10(metaData[filePath].most)) + 1, 2);
  let file = '';
  for (let i = 0; i < fileExecution.length; i++) {
    let start;
    if (fileExecution[i].executions > 0) {
      if (fileExecution[i].executions === metaData[filePath].most) {
        // yellow for most executed line(s)
        start = `\x1b[33m${String(fileExecution[i].executions).padStart(padding)}\x1b[0m`;
      } else {
        // green for other executed lines
        start = `\x1b[32m${String(fileExecution[i].executions).padStart(padding)}\x1b[0m`;
      }
    } else {
      start = ' '.repeat(padding);
    }
    file += `\n${start}  ${fileExecution[i].line}`;
  }
  prompt.note(file);
}
