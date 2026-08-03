#!/usr/bin/env node

'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

// Run allow-scripts in a dedicated process group so interruption can terminate
// the active lifecycle command and all of its descendants. Lerna owns package
// selection, cwd, ordering, concurrency, output, and fail-fast orchestration.

const { spawn } = require('node:child_process');
const path = require('node:path');

const SIGNAL_STATUS = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143
};
const FORCE_KILL_DELAY_MS = 1000;

function processGroupExists(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

function signalProcessGroup(child, signal) {
  if (process.platform === 'win32') {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}

async function waitForProcessGroupExit(processGroupId, timeoutMs) {
  if (process.platform === 'win32') {
    return true;
  }
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  while (processGroupExists(processGroupId)) {
    if (deadline !== undefined && Date.now() >= deadline) {
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return true;
}

async function terminateRemainingProcessGroup(processGroupId, signalAlreadySent) {
  if (process.platform === 'win32' || !processGroupExists(processGroupId)) {
    return;
  }
  if (!signalAlreadySent) {
    try {
      process.kill(-processGroupId, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
  if (!await waitForProcessGroupExit(
    processGroupId,
    FORCE_KILL_DELAY_MS
  )) {
    try {
      process.kill(-processGroupId, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
    await waitForProcessGroupExit(processGroupId);
  }
}

async function runAllowedScripts({
  allowScriptsPath,
  cwd = process.cwd(),
  env = process.env
}) {
  const child = spawn(allowScriptsPath, ['run'], {
    cwd,
    detached: process.platform !== 'win32',
    env,
    stdio: 'inherit'
  });
  let requestedSignal;
  let forceKillTimer;
  const signalHandlers = new Map();
  for (const signal of Object.keys(SIGNAL_STATUS)) {
    const handler = () => {
      if (requestedSignal) {
        return;
      }
      requestedSignal = signal;
      signalProcessGroup(child, signal);
      forceKillTimer = setTimeout(() => {
        signalProcessGroup(child, 'SIGKILL');
      }, FORCE_KILL_DELAY_MS);
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  if (forceKillTimer) {
    clearTimeout(forceKillTimer);
  }
  await terminateRemainingProcessGroup(child.pid, Boolean(requestedSignal));
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }

  if (requestedSignal) {
    return SIGNAL_STATUS[requestedSignal];
  }
  if (result.signal) {
    return SIGNAL_STATUS[result.signal] || 1;
  }
  return result.code ?? 1;
}

async function main() {
  const rootPath = process.env.LERNA_ROOT_PATH;
  if (!rootPath) {
    throw new Error('LERNA_ROOT_PATH is required.');
  }
  const status = await runAllowedScripts({
    allowScriptsPath: path.join(
      rootPath,
      'node_modules',
      '.bin',
      'allow-scripts'
    )
  });
  process.exitCode = status;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  runAllowedScripts,
  signalProcessGroup,
  terminateRemainingProcessGroup,
  waitForProcessGroupExit
};
