import { expect } from 'chai';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOL_ERROR_MESSAGES } from '../lib/sol/error_messages.js';
import { SolRpc } from '../lib/sol/SolRpc.js';
import { instructionKeys, parseJsonParsedInstructions } from '../lib/sol/transaction-parser.js';

const SYSTEM = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const ASSOCIATED_TOKEN = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';

describe('parseJsonParsedInstructions', function() {
  it('parses a system transfer the way top-level transferSol is shaped', function() {
    const parsed = parseJsonParsedInstructions([
      { programId: SYSTEM, program: 'system', parsed: { type: 'transfer', info: { source: 'S', destination: 'D', lamports: 5000 } } }
    ]);
    expect(parsed[instructionKeys.TRANSFER_SOL]).to.deep.equal([{ amount: 5000, currency: 'SOL', destination: 'D', source: 'S' }]);
  });

  it('parses a token transfer the way top-level transferToken is shaped', function() {
    const parsed = parseJsonParsedInstructions([
      { programId: TOKEN, program: 'spl-token', parsed: { type: 'transfer', info: { authority: 'A', source: 'S', destination: 'D', amount: '42' } } }
    ]);
    expect(parsed[instructionKeys.TRANSFER_TOKEN]).to.deep.equal([{ authority: 'A', destination: 'D', source: 'S', amount: 42 }]);
  });

  it('parses a token transferChecked the way top-level transferCheckedToken is shaped', function() {
    // jsonParsed nests the amount and decimals under tokenAmount (shape taken from a mainnet tx)
    const parsed = parseJsonParsedInstructions([
      {
        programId: TOKEN,
        program: 'spl-token',
        parsed: {
          type: 'transferChecked',
          info: {
            authority: 'A', source: 'S', destination: 'D', mint: 'M',
            tokenAmount: { amount: '74683783', decimals: 9, uiAmount: 0.074683783, uiAmountString: '0.074683783' }
          }
        }
      }
    ]);
    expect(parsed[instructionKeys.TRANSFER_CHECKED_TOKEN]).to.deep.equal([{ authority: 'A', destination: 'D', mint: 'M', source: 'S', amount: 74683783, decimals: 9 }]);
  });

  it('still reads a transferChecked amount and decimals given directly on info', function() {
    const parsed = parseJsonParsedInstructions([
      { programId: TOKEN, program: 'spl-token', parsed: { type: 'transferChecked', info: { authority: 'A', source: 'S', destination: 'D', mint: 'M', amount: '42', decimals: 6 } } }
    ]);
    expect(parsed[instructionKeys.TRANSFER_CHECKED_TOKEN]).to.deep.equal([{ authority: 'A', destination: 'D', mint: 'M', source: 'S', amount: 42, decimals: 6 }]);
  });

  it('keeps instructions it does not parse under unknown, with their program address', function() {
    const createAccount = { programId: SYSTEM, program: 'system', parsed: { type: 'createAccount', info: {} } };
    const parsed = parseJsonParsedInstructions([createAccount]);
    expect(parsed[instructionKeys.UNKNOWN]).to.deep.equal([{ ...createAccount, programAddress: SYSTEM }]);
  });

  it('returns a memo as the plain string jsonParsed gives, unlike the object top-level memos are parsed into', function() {
    const parsed = parseJsonParsedInstructions([{ programId: MEMO, program: 'spl-memo', parsed: 'hi' }]);
    expect(parsed[instructionKeys.MEMO]).to.deep.equal(['hi']);
  });

  it('keeps associated token account instructions under unknown', function() {
    const create = { programId: ASSOCIATED_TOKEN, program: 'spl-associated-token-account', parsed: { type: 'create', info: {} } };
    const parsed = parseJsonParsedInstructions([create]);
    expect(parsed[instructionKeys.UNKNOWN]).to.deep.equal([{ ...create, programAddress: ASSOCIATED_TOKEN }]);
  });

  it('keeps compute budget instructions under unknown', function() {
    // jsonParsed doesn't parse compute budget instructions, so they come with raw accounts and data
    const setComputeUnitLimit = { programId: COMPUTE_BUDGET, accounts: [], data: 'K1FDJ7', stackHeight: null };
    const parsed = parseJsonParsedInstructions([setComputeUnitLimit]);
    expect(parsed[instructionKeys.UNKNOWN]).to.deep.equal([{ ...setComputeUnitLimit, programAddress: COMPUTE_BUDGET }]);
  });
});

const MAINNET_TXID = '428cM3eFWDQbzs5uDVHPngKGdBmVUqjSRABxRnkoZUPMymQXQuJp1tzzx55t4pArK8vo9jWXh5SdWpC5nZySXwWY';
const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/sol/inner-instructions-mainnet-tx.json');

// Answers each JSON-RPC request with the recorded response for the same method and encoding
const startReplayServer = async (exchanges) => {
  const keyOf = ({ method, params }) => `${method}:${params?.[1]?.encoding ?? ''}`;
  const responses = new Map(exchanges.map(({ request, response }) => [keyOf(request), response]));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    requests.push(keyOf(request));
    const recorded = responses.get(keyOf(request));
    res.writeHead(recorded ? 200 : 500, { 'content-type': 'application/json' });
    res.end(JSON.stringify(recorded ? { ...recorded, id: request.id } : { error: `no fixture for ${keyOf(request)}` }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, requests, port: server.address().port };
};

describe('SolRpc.getTransaction inner instructions (recorded mainnet tx)', function() {
  let replay;
  let tx;

  before(async function() {
    replay = await startReplayServer(JSON.parse(fs.readFileSync(fixturePath, 'utf8')));
    const solRpc = new SolRpc({ chain: 'SOL', protocol: 'http', host: '127.0.0.1', port: replay.port, wsPort: 1, includeInnerInstructions: true });
    tx = await solRpc.getTransaction({ txid: MAINNET_TXID });
  });

  after(function() {
    replay.server.close();
  });

  it('returns inner token transfers with the top-level instruction they ran under', function() {
    expect(tx.innerInstructions[instructionKeys.TRANSFER_TOKEN]).to.deep.equal([
      { topLevelInstructionIndex: 3, authority: '8sKQHfjNhvmAw94PhfvfMcytmqW6jmxvwieYyzXCCPu', destination: '8gFZKWfWHcaLekuCoe7qNY8qdLwRKvsdRxU4zMHsBsMR', source: 'H292B1VbSvD6GuUmSvUvfQstg1Acfzog796uQ7d1ccCw', amount: 246454992 },
      { topLevelInstructionIndex: 3, authority: 'F7p3dFrjRTbtRp8FRF6qHLomXbKRBzpvBLjtQcfcgmNe', destination: 'A3C9xwv4Hfx92M5HQpxUiibSqCa5pYhD2kTwnU5fEPq', source: 'Q4UmPB9hKMw3ERqksavS9oEpNo2eWG4ffkWg7wHa9j6', amount: 20080459 }
    ]);
  });

  it('returns the inner SOL transfer', function() {
    expect(tx.innerInstructions[instructionKeys.TRANSFER_SOL]).to.deep.equal([
      { topLevelInstructionIndex: 4, amount: 246454992, currency: 'SOL', destination: 'BYVjw5fBJv7HhtZbGDSe1GYXqVUrk8uspRn1fqrLZwAr', source: 'F7p3dFrjRTbtRp8FRF6qHLomXbKRBzpvBLjtQcfcgmNe' }
    ]);
  });

  it('keeps every other inner instruction under unknown with its top-level index', function() {
    const unknown = tx.innerInstructions[instructionKeys.UNKNOWN];
    expect(unknown.map(({ topLevelInstructionIndex }) => topLevelInstructionIndex)).to.deep.equal([2, 2, 2, 2, 3, 3, 4]);
  });

  it('gives inner transfers the same keys as top-level ones, since bitpay merges the two lists', function() {
    const keysOf = entry => Object.keys(entry).filter(key => key !== 'topLevelInstructionIndex').sort();
    expect(keysOf(tx.innerInstructions[instructionKeys.TRANSFER_SOL][0])).to.deep.equal(['amount', 'currency', 'destination', 'source']);
    expect(keysOf(tx.innerInstructions[instructionKeys.TRANSFER_TOKEN][0])).to.deep.equal(['amount', 'authority', 'destination', 'source']);
  });

  it('fetches the tx as jsonParsed once, in addition to the base64 fetch', function() {
    expect(replay.requests.filter(key => key.startsWith('getTransaction:'))).to.deep.equal(['getTransaction:base64', 'getTransaction:jsonParsed']);
  });

  it('still returns the base64 meta and the lookup-table account keys', function() {
    expect(tx.meta.preBalances.every(balance => typeof balance === 'bigint')).to.be.true;
    expect(tx.accountKeys).to.be.an('array').that.is.not.empty;
  });
});

describe('SolRpc.getTransaction without inner instructions requested (recorded mainnet tx)', function() {
  let replay;
  let solRpc;

  beforeEach(async function() {
    replay = await startReplayServer(JSON.parse(fs.readFileSync(fixturePath, 'utf8')));
    solRpc = new SolRpc({ chain: 'SOL', protocol: 'http', host: '127.0.0.1', port: replay.port, wsPort: 1 });
  });

  afterEach(function() {
    replay.server.close();
  });

  it('makes only the base64 fetch and leaves innerInstructions out by default', async function() {
    const tx = await solRpc.getTransaction({ txid: MAINNET_TXID });
    expect(tx).not.to.have.property('innerInstructions');
    expect(replay.requests.filter(key => key.startsWith('getTransaction:'))).to.deep.equal(['getTransaction:base64']);
  });

  it('returns innerInstructions when the call asks for them', async function() {
    const tx = await solRpc.getTransaction({ txid: MAINNET_TXID, includeInnerInstructions: true });
    expect(tx.innerInstructions[instructionKeys.TRANSFER_SOL]).to.have.lengthOf(1);
    expect(replay.requests.filter(key => key.startsWith('getTransaction:'))).to.deep.equal(['getTransaction:base64', 'getTransaction:jsonParsed']);
  });
});

describe('SolRpc.getTransaction when the jsonParsed fetch comes back empty', function() {
  let replay;

  before(async function() {
    // A node that has the tx in base64 but returns null for it as jsonParsed, e.g. one behind a load balancer that's lagging
    const exchanges = JSON.parse(fs.readFileSync(fixturePath, 'utf8')).map(exchange =>
      exchange.request.params?.[1]?.encoding === 'jsonParsed' ? { ...exchange, response: { ...exchange.response, result: null } } : exchange
    );
    replay = await startReplayServer(exchanges);
  });

  after(function() {
    replay.server.close();
  });

  it('throws rather than returning {}, which would read as no inner instructions', async function() {
    const solRpc = new SolRpc({ chain: 'SOL', protocol: 'http', host: '127.0.0.1', port: replay.port, wsPort: 1 });
    let error;
    try {
      await solRpc.getTransaction({ txid: MAINNET_TXID, includeInnerInstructions: true });
    } catch (err) {
      error = err;
    }
    expect(error?.message).to.equal(SOL_ERROR_MESSAGES.INNER_INSTRUCTIONS_UNAVAILABLE);
  });
});
