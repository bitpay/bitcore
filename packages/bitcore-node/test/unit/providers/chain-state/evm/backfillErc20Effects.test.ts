import { ObjectId } from 'bson';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  buildBackfillTransactionFilter,
  getBackfillDisposition,
  materializeBackfillTransactions,
  parseBackfillOptions,
  processBlock,
  updateBackfillTransaction,
  validateLocalBlockTransactions
} from '../../../../../scripts/backfillErc20Effects';
import {
  ERC20_TRANSFER_TOPIC,
  attachErc20EffectsToTransactions
} from '../../../../../src/providers/chain-state/evm/erc20Effects';
import { EVMBlockStorage } from '../../../../../src/providers/chain-state/evm/models/block';
import { EVMTransactionStorage } from '../../../../../src/providers/chain-state/evm/models/transaction';
import type { Erc20Effects, IEVMTransaction } from '../../../../../src/providers/chain-state/evm/types';
import type { BackfillOptions } from '../../../../../scripts/backfillErc20Effects';
import type { MongoBound } from '../../../../../src/models/base';

type StoredEvmTransaction = MongoBound<IEVMTransaction> & Required<Pick<MongoBound<IEVMTransaction>, '_id'>>;

const hash = (byte: string) => `0x${byte.repeat(32)}`;
const address = (byte: string) => `0x${byte.repeat(20)}`;
const BLOCK_HASH = hash('11');
const OTHER_BLOCK_HASH = hash('22');
const TXID = hash('33');
const topicAddress = (value: string) => `0x${'0'.repeat(24)}${value.slice(2).toLowerCase()}`;
const uintWord = (value: bigint | number) => `0x${BigInt(value).toString(16).padStart(64, '0')}`;

function erc20Effects(overrides: Partial<Erc20Effects> = {}): Erc20Effects {
  return {
    blockHash: BLOCK_HASH,
    version: 1,
    items: [{
      type: 'ERC20:transfer',
      from: address('aa'),
      to: address('bb'),
      amount: '10',
      contractAddress: address('cc'),
      logIndex: 2,
      callStack: 'log:2'
    }],
    ...overrides
  };
}

function tx(overrides: Record<string, any> = {}): StoredEvmTransaction {
  return {
    _id: new ObjectId(),
    chain: 'ETH',
    network: 'mainnet',
    txid: TXID,
    blockHeight: 100,
    blockHash: BLOCK_HASH,
    blockTime: new Date('2026-07-01T00:00:00.000Z'),
    blockTimeNormalized: new Date('2026-07-01T00:00:00.000Z'),
    fee: 1,
    value: 0,
    wallets: [],
    gasLimit: 21000,
    gasPrice: 1,
    nonce: 1,
    transactionIndex: 0,
    to: address('dd'),
    from: address('ee'),
    effects: [],
    erc20Effects: erc20Effects(),
    ...overrides
  } as StoredEvmTransaction;
}

function options(overrides: Partial<BackfillOptions> = {}): BackfillOptions {
  return {
    chain: 'ETH',
    network: 'mainnet',
    startHeight: 100,
    endHeight: 200,
    dryRun: false,
    concurrency: 4,
    delayMs: 100,
    forceCurrentVersion: false,
    ...overrides
  };
}

async function expectRejected(promise: Promise<any>, expected: RegExp) {
  try {
    await promise;
    expect.fail('Expected promise to reject');
  } catch (err: any) {
    expect(err.message || String(err)).to.match(expected);
  }
}

describe('ERC-20 effects historical backfill', function() {
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  it('requires an explicit bounded range and validates throttle controls', function() {
    expect(parseBackfillOptions([
      '--chain', 'eth',
      '--network', 'MAINNET',
      '--start-height', '100',
      '--end-height', '110',
      '--dry-run',
      '--concurrency', '8',
      '--delay-ms', '25',
      '--force-current-version'
    ])).to.deep.equal({
      chain: 'ETH',
      network: 'mainnet',
      startHeight: 100,
      endHeight: 110,
      dryRun: true,
      concurrency: 8,
      delayMs: 25,
      forceCurrentVersion: true
    });

    expect(() => parseBackfillOptions([
      '--chain', 'ETH',
      '--network', 'mainnet',
      '--start-height', '110',
      '--end-height', '100'
    ])).to.throw(/end-height/i);
  });

  it('builds an inclusion-bound, observed-value, monotonic-version CAS filter', function() {
    const row = tx();
    const observed = erc20Effects({ items: [] });
    const filter = buildBackfillTransactionFilter({ tx: row, observedErc20Effects: observed });

    expect(filter).to.include({
      _id: row._id,
      chain: 'ETH',
      network: 'mainnet',
      txid: TXID,
      blockHeight: 100,
      blockHash: BLOCK_HASH
    });
    expect(filter.$and[0]).to.deep.equal({
      $or: [
        { 'erc20Effects.version': { $exists: false } },
        { 'erc20Effects.version': { $lte: 1 } }
      ]
    });
    expect(filter.$and[1]).to.deep.equal({ erc20Effects: observed });
  });

  it('distinguishes current-version skip, force-current write, and newer-version protection', function() {
    const row = tx();
    const current = erc20Effects();

    expect(getBackfillDisposition({
      tx: row,
      observedErc20Effects: current,
      forceCurrentVersion: false
    })).to.equal('skipped-current');

    expect(getBackfillDisposition({
      tx: row,
      observedErc20Effects: current,
      forceCurrentVersion: true
    })).to.equal('write');

    expect(getBackfillDisposition({
      tx: row,
      observedErc20Effects: erc20Effects({ version: 2 }),
      forceCurrentVersion: true
    })).to.equal('skipped-newer');
  });

  it('rejects inconsistent local block/transaction state without attempting repair', function() {
    const block = { hash: BLOCK_HASH, height: 100, transactionCount: 1 };
    expect(() => validateLocalBlockTransactions(block, [])).to.throw(/transaction count mismatch/i);
    expect(() => validateLocalBlockTransactions(block, [tx({ blockHash: OTHER_BLOCK_HASH })])).to.throw(/inconsistent inclusion/i);
    expect(() => validateLocalBlockTransactions(
      { ...block, transactionCount: 2 },
      [tx(), tx({ _id: new ObjectId() })]
    )).to.throw(/duplicate local transaction/i);
    expect(() => validateLocalBlockTransactions(
      { ...block, transactionCount: 2 },
      [tx(), tx({ _id: new ObjectId(), txid: hash('44'), transactionIndex: 0 })]
    )).to.throw(/invalid transactionIndex/i);
  });

  it('aborts before transaction updates when RPC block membership differs from local inclusion', async function() {
    const row = tx({ erc20Effects: undefined });
    const localBlock = {
      chain: 'ETH',
      network: 'mainnet',
      hash: BLOCK_HASH,
      height: 100,
      transactionCount: 1,
      processed: true
    };
    const blockCursor = {
      limit: sandbox.stub().returnsThis(),
      toArray: sandbox.stub().resolves([localBlock])
    };
    sandbox.stub(EVMBlockStorage, 'collection').get(() => ({
      find: sandbox.stub().returns(blockCursor)
    } as any));

    const transactionCursor = {
      sort: sandbox.stub().returnsThis(),
      toArray: sandbox.stub().resolves([row])
    };
    const updateOne = sandbox.stub();
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
      find: sandbox.stub().returns(transactionCursor),
      updateOne
    } as any));

    const rpc = {
      send: sandbox.stub().resolves([]),
      getBlock: sandbox.stub().resolves({
        hash: BLOCK_HASH,
        transactions: [{ hash: hash('44') }]
      })
    } as any;

    await expectRejected(
      processBlock(options({ startHeight: 100, endHeight: 100, delayMs: 0 }), rpc, 100),
      /RPC transaction membership mismatch/i
    );

    expect(rpc.getBlock.calledOnce).to.equal(true);
    expect(updateOne.called).to.equal(false);
  });

  it('uses the same materializer as the live path and emits authoritative empty results', function() {
    const block = { hash: BLOCK_HASH, height: 100, transactionCount: 1 };
    const log = {
      address: address('cc'),
      blockHash: BLOCK_HASH,
      blockNumber: '0x64',
      data: uintWord(10),
      logIndex: '0x2',
      removed: false,
      topics: [ERC20_TRANSFER_TOPIC, topicAddress(address('aa')), topicAddress(address('bb'))],
      transactionHash: TXID,
      transactionIndex: '0x0'
    };
    const liveRow = tx({ erc20Effects: undefined });
    const backfillRow = tx({ _id: new ObjectId(), erc20Effects: undefined });

    attachErc20EffectsToTransactions({ block, transactions: [liveRow], logs: [log] });
    materializeBackfillTransactions({ block, transactions: [backfillRow], logs: [log] });

    expect(backfillRow.erc20Effects).to.deep.equal(liveRow.erc20Effects);

    const emptyRow = tx({ _id: new ObjectId(), erc20Effects: undefined });
    materializeBackfillTransactions({ block, transactions: [emptyRow], logs: [] });
    expect(emptyRow.erc20Effects).to.deep.equal({ blockHash: BLOCK_HASH, version: 1, items: [] });
  });

  it('writes only erc20Effects plus wallet merge semantics and invalidates relevant caches after change', async function() {
    const updateOne = sandbox.stub().resolves({ matchedCount: 1, modifiedCount: 1 });
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ updateOne } as any));
    const expire = sandbox.stub(EVMTransactionStorage, 'expireErc20BalanceCacheForTransaction').resolves();
    const row = tx();
    const wallet = new ObjectId();

    const result = await updateBackfillTransaction({
      options: options(),
      tx: row,
      observedErc20Effects: undefined,
      wallets: [wallet]
    });

    expect(result).to.equal('updated');
    expect(updateOne.calledOnce).to.equal(true);
    expect(updateOne.firstCall.args[1]).to.deep.equal({
      $set: { erc20Effects: row.erc20Effects },
      $addToSet: { wallets: { $each: [wallet] } }
    });
    expect(expire.calledOnce).to.equal(true);
  });

  it('is dry-run safe and does not issue a MongoDB update', async function() {
    const updateOne = sandbox.stub();
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ updateOne } as any));

    const result = await updateBackfillTransaction({
      options: options({ dryRun: true }),
      tx: tx(),
      observedErc20Effects: undefined,
      wallets: []
    });

    expect(result).to.equal('dry-run');
    expect(updateOne.called).to.equal(false);
  });

  it('skips a valid current row on rerun and never downgrades a newer parser version', async function() {
    const updateOne = sandbox.stub();
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ updateOne } as any));
    const row = tx();

    expect(await updateBackfillTransaction({
      options: options(),
      tx: row,
      observedErc20Effects: erc20Effects(),
      wallets: []
    })).to.equal('skipped-current');

    expect(await updateBackfillTransaction({
      options: options({ forceCurrentVersion: true }),
      tx: row,
      observedErc20Effects: erc20Effects({ version: 2 }),
      wallets: []
    })).to.equal('skipped-newer');

    expect(updateOne.called).to.equal(false);
  });

  it('accepts a same-version live-write race only when it converged to identical inclusion-bound output', async function() {
    const row = tx();
    const updateOne = sandbox.stub().resolves({ matchedCount: 0, modifiedCount: 0 });
    const findOne = sandbox.stub().resolves({ ...row, erc20Effects: erc20Effects() });
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ updateOne, findOne } as any));

    const result = await updateBackfillTransaction({
      options: options(),
      tx: row,
      observedErc20Effects: undefined,
      wallets: []
    });

    expect(result).to.equal('raced-converged');
  });

  it('binds a post-convergence wallet merge to the exact current MongoDB snapshot', async function() {
    const lowerBlockHash = hash('ab');
    const upperBlockHash = `0x${lowerBlockHash.slice(2).toUpperCase()}`;
    const lowerTxid = hash('cd');
    const upperTxid = `0x${lowerTxid.slice(2).toUpperCase()}`;
    const row = tx({
      txid: upperTxid,
      blockHash: upperBlockHash,
      erc20Effects: erc20Effects({ blockHash: upperBlockHash })
    });
    const wallet = new ObjectId();
    const updateOne = sandbox.stub();
    updateOne.onFirstCall().resolves({ matchedCount: 0, modifiedCount: 0 });
    updateOne.onSecondCall().resolves({ matchedCount: 1, modifiedCount: 1 });
    const current = {
      ...row,
      txid: lowerTxid,
      blockHash: lowerBlockHash,
      erc20Effects: erc20Effects({ blockHash: lowerBlockHash })
    };
    const findOne = sandbox.stub().resolves(current);
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ updateOne, findOne } as any));

    const result = await updateBackfillTransaction({
      options: options(),
      tx: row,
      observedErc20Effects: undefined,
      wallets: [wallet]
    });

    expect(result).to.equal('raced-converged');
    expect(updateOne.secondCall.args[0]).to.deep.equal({
      _id: current._id,
      chain: current.chain,
      network: current.network,
      txid: current.txid,
      blockHeight: current.blockHeight,
      blockHash: current.blockHash,
      erc20Effects: current.erc20Effects
    });
    expect(updateOne.secondCall.args[1]).to.deep.equal({
      $addToSet: { wallets: { $each: [wallet] } }
    });
  });

  it('fails safely when inclusion changes before publication', async function() {
    const row = tx();
    const updateOne = sandbox.stub().resolves({ matchedCount: 0, modifiedCount: 0 });
    const findOne = sandbox.stub().resolves({ ...row, blockHash: OTHER_BLOCK_HASH, erc20Effects: erc20Effects({ blockHash: OTHER_BLOCK_HASH }) });
    sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ updateOne, findOne } as any));

    await expectRejected(updateBackfillTransaction({
      options: options(),
      tx: row,
      observedErc20Effects: undefined,
      wallets: []
    }), /CAS lost/i);
  });
});
