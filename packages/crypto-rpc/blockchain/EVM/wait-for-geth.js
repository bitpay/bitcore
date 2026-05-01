#!/usr/bin/env node
/**
 * Wait for geth to be ready (not indexing) before proceeding.
 * Polls eth_blockNumber until geth responds without errors.
 */
import http from 'http';
/* eslint-disable @typescript-eslint/no-require-imports */

const GETH_URL = process.env.GETH_URL || 'http://geth:8545';
const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;

function rpcCall(method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const url = new URL(GETH_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 8545,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForGeth() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const res = await rpcCall('eth_blockNumber');
      if (res.result !== undefined) {
        console.log(`Geth ready after ${i} attempt(s). Block: ${parseInt(res.result, 16)}`);
        return;
      }
      console.log(`Attempt ${i}/${MAX_RETRIES}: geth not ready yet (${JSON.stringify(res.error || res)})`);
    } catch (e) {
      console.log(`Attempt ${i}/${MAX_RETRIES}: connection failed (${(e as Error).message})`);
    }
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  }
  console.error('Geth did not become ready in time');
  process.exit(1);
}

waitForGeth();
