import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import { ObjectId } from 'bson';
import { expect } from 'chai';
import sinon from 'sinon';
import { Readable, Writable } from 'stream';
import { CacheStorage } from '../../../../../src/models/cache';
import { WalletAddressStorage } from '../../../../../src/models/walletAddress';
import { ChainStateProvider } from '../../../../../src/providers/chain-state';
import { BaseEVMStateProvider } from '../../../../../src/providers/chain-state/evm/api/csp';
import { Gnosis } from '../../../../../src/providers/chain-state/evm/api/gnosis';
import { PopulateEffectsForAddressTransform, PopulateEffectsTransform } from '../../../../../src/providers/chain-state/evm/api/populateEffectsTransform';
import { Erc20RelatedFilterTransform } from '../../../../../src/providers/chain-state/evm/api/erc20Transform';
import {
  ERC20_EFFECTS_VERSION,
  ERC20_TRANSFER_TOPIC,
  attachErc20EffectsToTransactions,
  getEffectiveEvmEffects,
  parseErc20TransferLogs,
  prepareErc20EffectsForPersistence
} from '../../../../../src/providers/chain-state/evm/erc20Effects';
import { EVMTransactionStorage } from '../../../../../src/providers/chain-state/evm/models/transaction';
import { EVMP2pWorker } from '../../../../../src/providers/chain-state/evm/p2p/p2p';
import { Config } from '../../../../../src/services/config';
import { Storage } from '../../../../../src/services/storage';
import type { Effect, IEVMTransactionInProcess } from '../../../../../src/providers/chain-state/evm/types';
import type { IEVMNetworkConfig } from '../../../../../src/types/Config';

const hash = (byte: string) => `0x${byte.repeat(32)}`;
const address = (byte: string) => `0x${byte.repeat(20)}`;
const topicAddress = (value: string) => `0x${'0'.repeat(24)}${value.slice(2).toLowerCase()}`;
const uintWord = (value: bigint | number) => `0x${BigInt(value).toString(16).padStart(64, '0')}`;

const BLOCK_HASH = hash('11');
const OTHER_BLOCK_HASH = hash('22');
const TX1 = hash('33');
const TX2 = hash('44');
const FROM = Web3.utils.toChecksumAddress(address('aa'));
const TO = Web3.utils.toChecksumAddress(address('bb'));
const OTHER = Web3.utils.toChecksumAddress(address('cc'));
const TOKEN = Web3.utils.toChecksumAddress(address('dd'));
const OTHER_TOKEN = Web3.utils.toChecksumAddress(address('ee'));
const ZERO = Web3.utils.toChecksumAddress(address('00'));

const nativeEffect: Effect = { from: FROM, to: TO, amount: '7', callStack: '0' };
const heuristicEffect: Effect = {
  type: 'ERC20:transfer',
  from: FROM,
  to: OTHER,
  amount: '999',
  contractAddress: OTHER_TOKEN,
  callStack: 'legacy'
};
const heuristicSafeTokenEffect: Effect = {
  type: 'ERC20:transfer',
  from: FROM,
  to: TO,
  amount: '999',
  contractAddress: TOKEN,
  callStack: 'legacy-safe'
};

function makeLog(overrides: Record<string, any> = {}) {
  return {
    address: TOKEN,
    blockHash: BLOCK_HASH,
    blockNumber: '0x64',
    data: uintWord(123),
    logIndex: '0x1',
    removed: false,
    topics: [ERC20_TRANSFER_TOPIC, topicAddress(FROM), topicAddress(TO)],
    transactionHash: TX1,
    transactionIndex: '0x0',
    ...overrides
  };
}

function makeTx(overrides: Record<string, any> = {}): IEVMTransactionInProcess {
  const time = new Date('2026-07-01T00:00:00.000Z');
  return {
    chain: 'ETH',
    network: 'mainnet',
    txid: TX1,
    blockHeight: 100,
    blockHash: BLOCK_HASH,
    blockTime: time,
    blockTimeNormalized: time,
    fee: 1,
    value: 0,
    wallets: [],
    gasLimit: 21000,
    gasPrice: 1,
    nonce: 1,
    transactionIndex: 0,
    to: TOKEN,
    from: FROM,
    data: '0x',
    internal: [],
    calls: [],
    effects: [nativeEffect, heuristicEffect],
    ...overrides
  } as IEVMTransactionInProcess;
}

function makeLocalTx(overrides: Record<string, any> = {}) {
  return Object.assign(makeTx(overrides), { _id: new ObjectId() });
}

function makeBlock(overrides: Record<string, any> = {}) {
  return {
    chain: 'ETH',
    network: 'mainnet',
    hash: BLOCK_HASH,
    height: 100,
    transactionCount: 1,
    ...overrides
  } as any;
}

function validCanonicalEffect(overrides: Record<string, any> = {}) {
  return {
    type: 'ERC20:transfer' as const,
    from: FROM,
    to: TO,
    amount: '123',
    contractAddress: TOKEN,
    logIndex: 1,
    callStack: 'log:1',
    ...overrides
  };
}

function enableConfig(strictReadActivationHeight?: number): IEVMNetworkConfig {
  return {
    erc20Effects: {
      materializationEnabled: true,
      strictReadActivationHeight
    }
  } as IEVMNetworkConfig;
}

async function expectRejected(promise: Promise<any>, expected: RegExp) {
  try {
    await promise;
    expect.fail('Expected promise to reject');
  } catch (err: any) {
    expect(err.message || String(err)).to.match(expected);
  }
}

async function collectObjects(stream: NodeJS.ReadableStream) {
  const rows: any[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', row => rows.push(row));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return rows;
}

function cursorWithRows(rows: any[]) {
  const cursor: any = { toArray: sinon.stub().resolves(rows) };
  cursor.project = sinon.stub().returns(cursor);
  return cursor;
}

function makeRpc(sendImplementation: (request: any, callback: (err: any, response?: any) => void) => void) {
  return {
    web3: { eth: {} },
    send: (request: any) => new Promise((resolve, reject) => {
      sendImplementation(request, (err, response) => {
        if (err || response?.error) {
          return reject(err || response.error);
        }
        resolve(response?.result);
      });
    }),
    getBlock: sinon.stub().resolves({ hash: BLOCK_HASH })
  } as any;
}

describe('Canonical ERC-20 effects', function() {
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  describe('pure Transfer-log parser', function() {
    it('parses one standard Transfer event into the Effect-compatible shape', function() {
      const parsed = parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [makeLog()]
      });

      expect(parsed.unsupportedTransferLogs).to.equal(0);
      expect(parsed.itemsByTransaction.get(TX1)).to.deep.equal([validCanonicalEffect()]);
    });

    it('preserves identical-looking sibling events and orders them by logIndex', function() {
      const parsed = parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [
          makeLog({ logIndex: '0x8', data: uintWord(5) }),
          makeLog({ logIndex: '0x2', data: uintWord(5) })
        ]
      });

      expect(parsed.itemsByTransaction.get(TX1)!.map(item => item.logIndex)).to.deep.equal([2, 8]);
      expect(parsed.itemsByTransaction.get(TX1)!.map(item => item.callStack)).to.deep.equal(['log:2', 'log:8']);
    });

    it('retains standard zero-address mint and burn events', function() {
      const parsed = parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [
          makeLog({
            logIndex: '0x1',
            topics: [ERC20_TRANSFER_TOPIC, topicAddress(ZERO), topicAddress(TO)]
          }),
          makeLog({
            logIndex: '0x2',
            topics: [ERC20_TRANSFER_TOPIC, topicAddress(FROM), topicAddress(ZERO)]
          })
        ]
      });

      const items = parsed.itemsByTransaction.get(TX1)!;
      expect(items[0].from).to.equal(ZERO);
      expect(items[1].to).to.equal(ZERO);
    });

    it('ignores and counts ERC-721-shaped four-topic Transfer logs', function() {
      const parsed = parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [makeLog({ topics: [ERC20_TRANSFER_TOPIC, topicAddress(FROM), topicAddress(TO), uintWord(7)], data: '0x' })]
      });

      expect(parsed.unsupportedTransferLogs).to.equal(1);
      expect(parsed.itemsByTransaction.size).to.equal(0);
    });

    it('ignores unrelated logs and counts nonstandard Transfer-shaped encodings', function() {
      const parsed = parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [
          makeLog({ logIndex: '0x1', topics: [hash('99')] }),
          makeLog({ logIndex: '0x2', topics: [ERC20_TRANSFER_TOPIC, hash('12'), topicAddress(TO)] }),
          makeLog({ logIndex: '0x3', data: '0x01' })
        ]
      });

      expect(parsed.unsupportedTransferLogs).to.equal(2);
      expect(parsed.itemsByTransaction.size).to.equal(0);
    });

    it('rejects malformed or inclusion-inconsistent log responses', function() {
      expect(() => parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [makeLog({ blockHash: OTHER_BLOCK_HASH })]
      })).to.throw(/block hash mismatch/i);

      expect(() => parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1],
        logs: [makeLog({ data: '0x0g' })]
      })).to.throw(/log data/i);
    });

    it('rejects duplicate block log identity even when transaction hashes differ', function() {
      expect(() => parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1, TX2],
        logs: [
          makeLog({ transactionHash: TX1, transactionIndex: '0x0', logIndex: '0x3' }),
          makeLog({ transactionHash: TX2, transactionIndex: '0x1', logIndex: '0x3' })
        ]
      })).to.throw(/duplicate log identity/i);
    });

    it('rejects a transactionIndex that contradicts the returned transactionHash', function() {
      expect(() => parseErc20TransferLogs({
        blockHash: BLOCK_HASH,
        blockHeight: 100,
        transactionHashes: [TX1, TX2],
        logs: [makeLog({ transactionHash: TX2, transactionIndex: '0x0' })]
      })).to.throw(/transactionIndex does not match transactionHash/i);
    });
  });

  describe('materialization and live confirmed-block path', function() {
    it('attaches a result to every confirmed transaction, including authoritative empty and failed rows', function() {
      const failed = makeTx({ txid: TX1, transactionIndex: 0, receipt: { status: false } });
      const indirect = makeTx({ txid: TX2, transactionIndex: 1, effects: [nativeEffect] });
      const result = attachErc20EffectsToTransactions({
        block: makeBlock({ transactionCount: 2 }),
        transactions: [failed, indirect],
        logs: [makeLog({ transactionHash: TX2, transactionIndex: '0x1', logIndex: '0x4' })]
      });

      expect(result.supportedTransferLogs).to.equal(1);
      expect(failed.effects).to.deep.equal([nativeEffect, heuristicEffect]);
      expect(failed.erc20Effects).to.deep.equal({ blockHash: BLOCK_HASH, version: 1, items: [] });
      expect(indirect.erc20Effects!.items[0]).to.include({ logIndex: 4, amount: '123' });
    });

    it('produces deterministic identical output when rerun for live or backfill use', function() {
      const left = makeTx();
      const right = makeTx();
      const logs = [makeLog({ logIndex: '0x9' }), makeLog({ logIndex: '0x2', data: uintWord(8) })];

      attachErc20EffectsToTransactions({ block: makeBlock(), transactions: [left], logs });
      attachErc20EffectsToTransactions({ block: makeBlock(), transactions: [right], logs: [...logs].reverse() });

      expect(left.erc20Effects).to.deep.equal(right.erc20Effects);
    });

    it('rejects an incomplete prepared transaction set before attaching results', function() {
      expect(() => attachErc20EffectsToTransactions({
        block: makeBlock({ transactionCount: 2 }),
        transactions: [makeTx()],
        logs: []
      })).to.throw(/transaction count/i);
    });

    it('rejects prepared transactions whose stored indexes do not match block order', function() {
      expect(() => attachErc20EffectsToTransactions({
        block: makeBlock({ transactionCount: 2 }),
        transactions: [
          makeTx({ txid: TX1, transactionIndex: 1 }),
          makeTx({ txid: TX2, transactionIndex: 0 })
        ],
        logs: []
      })).to.throw(/out of order/i);
    });

    it('uses an exact blockHash log filter where supported', async function() {
      const send = sandbox.spy((_request: any, callback: (err: any, response?: any) => void) => {
        callback(null, { result: [makeLog()] });
      });
      const tx = makeTx();
      await prepareErc20EffectsForPersistence({
        rpc: makeRpc(send),
        config: enableConfig(1000),
        block: makeBlock(),
        transactions: [tx]
      });

      expect(send.calledOnce).to.equal(true);
      expect(send.firstCall.args[0].params[0]).to.deep.equal({
        blockHash: BLOCK_HASH,
        topics: [ERC20_TRANSFER_TOPIC]
      });
      expect(tx.erc20Effects!.items).to.have.length(1);
    });

    it('uses the validated height fallback when an existing RPC adapter resolves an unsupported query as undefined', async function() {
      const send = sandbox.stub();
      send.onFirstCall().callsFake((_request, callback) => callback(null, {}));
      send.onSecondCall().callsFake((_request, callback) => callback(null, { result: [] }));
      const rpc = makeRpc(send);

      const result = await prepareErc20EffectsForPersistence({
        rpc,
        config: enableConfig(),
        block: makeBlock(),
        transactions: [makeTx()]
      });

      expect(result.usedHeightFallback).to.equal(true);
      expect(send.callCount).to.equal(2);
      expect(rpc.getBlock.calledOnceWithExactly(100)).to.equal(true);
    });

    it('falls back to an exact height and revalidates block identity when blockHash filters are unsupported', async function() {
      const send = sandbox.stub();
      send.onFirstCall().callsFake((_request, callback) => callback(null, { error: { message: 'blockHash filter unsupported' } }));
      send.onSecondCall().callsFake((_request, callback) => callback(null, { result: [] }));
      const rpc = makeRpc(send);
      const tx = makeTx();

      const result = await prepareErc20EffectsForPersistence({
        rpc,
        config: enableConfig(),
        block: makeBlock(),
        transactions: [tx]
      });

      expect(result.usedHeightFallback).to.equal(true);
      expect(send.secondCall.args[0].params[0]).to.deep.equal({
        fromBlock: '0x64',
        toBlock: '0x64',
        topics: [ERC20_TRANSFER_TOPIC]
      });
      expect(rpc.getBlock.calledOnceWithExactly(100)).to.equal(true);
      expect(tx.erc20Effects).to.deep.equal({ blockHash: BLOCK_HASH, version: 1, items: [] });
    });

    it('preserves master behavior and performs no log RPC when the feature is disabled', async function() {
      const send = sandbox.spy((_request: any, callback: (err: any, response?: any) => void) => callback(null, { result: [] }));
      const tx = makeTx();
      const result = await prepareErc20EffectsForPersistence({
        rpc: makeRpc(send),
        config: {} as IEVMNetworkConfig,
        block: makeBlock(),
        transactions: [tx]
      });

      expect(result.enabled).to.equal(false);
      expect(send.called).to.equal(false);
      expect(tx.erc20Effects).to.equal(undefined);
    });

    it('keeps pending transaction ingestion on the existing legacy path', function() {
      const pending = makeTx({ blockHeight: -1, blockHash: undefined, erc20Effects: undefined });
      const worker = Object.create(EVMP2pWorker.prototype) as any;
      worker.chain = 'ETH';
      worker.network = 'mainnet';
      worker.txModel = {
        convertRawTx: sandbox.stub().returns(pending),
        batchImport: sandbox.stub()
      };

      worker.processTransaction({ hash: TX1 } as any);

      expect(worker.txModel.batchImport.calledOnce).to.equal(true);
      expect(worker.txModel.batchImport.firstCall.args[0]).to.include({ height: -1 });
      expect(worker.txModel.batchImport.firstCall.args[0].txs[0].erc20Effects).to.equal(undefined);
    });

    it('does not call the existing persistence boundary when log acquisition fails', async function() {
      const worker = Object.create(EVMP2pWorker.prototype) as any;
      worker.chain = 'ETH';
      worker.network = 'mainnet';
      worker.chainConfig = enableConfig();
      worker.initialSyncComplete = true;
      worker.rpc = makeRpc((_request, callback) => callback(new Error('log acquisition failed')));
      worker.blockModel = { addBlock: sandbox.stub().resolves() };
      const tx = makeTx();

      await expectRejected(worker.processBlock(makeBlock(), [tx]), /log acquisition failed/i);
      expect(worker.blockModel.addBlock.called).to.equal(false);
      expect(tx.erc20Effects).to.equal(undefined);
    });

    it('does not persist when returned logs or fallback block identity mismatch the prepared block', async function() {
      const logMismatchWorker = Object.create(EVMP2pWorker.prototype) as any;
      logMismatchWorker.chain = 'ETH';
      logMismatchWorker.network = 'mainnet';
      logMismatchWorker.chainConfig = enableConfig();
      logMismatchWorker.initialSyncComplete = true;
      logMismatchWorker.rpc = makeRpc((_request, callback) => callback(null, { result: [makeLog({ blockHash: OTHER_BLOCK_HASH })] }));
      logMismatchWorker.blockModel = { addBlock: sandbox.stub().resolves() };

      await expectRejected(logMismatchWorker.processBlock(makeBlock(), [makeTx()]), /block hash mismatch/i);
      expect(logMismatchWorker.blockModel.addBlock.called).to.equal(false);

      const fallbackSend = sandbox.stub();
      fallbackSend.onFirstCall().callsFake((_request, callback) => callback(null, { error: { message: 'blockHash unsupported' } }));
      fallbackSend.onSecondCall().callsFake((_request, callback) => callback(null, { result: [] }));
      const fallbackRpc = makeRpc(fallbackSend);
      fallbackRpc.getBlock.resolves({ hash: OTHER_BLOCK_HASH });
      const identityWorker = Object.create(EVMP2pWorker.prototype) as any;
      identityWorker.chain = 'ETH';
      identityWorker.network = 'mainnet';
      identityWorker.chainConfig = enableConfig();
      identityWorker.initialSyncComplete = true;
      identityWorker.rpc = fallbackRpc;
      identityWorker.blockModel = { addBlock: sandbox.stub().resolves() };

      await expectRejected(identityWorker.processBlock(makeBlock(), [makeTx()]), /identity changed/i);
      expect(identityWorker.blockModel.addBlock.called).to.equal(false);
    });

    it('attaches canonical effects before invoking the existing single persistence path', async function() {
      const worker = Object.create(EVMP2pWorker.prototype) as any;
      worker.chain = 'ETH';
      worker.network = 'mainnet';
      worker.chainConfig = enableConfig();
      worker.initialSyncComplete = true;
      worker.rpc = makeRpc((_request, callback) => callback(null, { result: [makeLog()] }));
      worker.blockModel = { addBlock: sandbox.stub().resolves() };
      const tx = makeTx();

      await worker.processBlock(makeBlock(), [tx]);

      expect(worker.blockModel.addBlock.calledOnce).to.equal(true);
      expect(worker.blockModel.addBlock.firstCall.args[0].transactions[0].erc20Effects.items).to.deep.equal([
        validCanonicalEffect()
      ]);
    });
  });

  describe('shared read semantics', function() {
    async function streamGnosisTokenRows(transactions: any[]) {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(100));
      const cursor = Readable.from(transactions, { objectMode: true }) as any;
      cursor.sort = sandbox.stub().returns(cursor);
      cursor.addCursorFlag = sandbox.stub().returns(cursor);
      cursor.close = sandbox.stub().resolves();
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursor)
      } as any));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      provider.getWalletTransactionQuery = sandbox.stub().returns({
        chain: 'ETH', network: 'mainnet', wallets: new ObjectId()
      });
      sandbox.stub(ChainStateProvider, 'get').returns(provider);

      const chunks: string[] = [];
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({
        write(chunk, _encoding, done) {
          chunks.push(chunk.toString());
          done();
        }
      }) as any;
      const finished = new Promise<void>((resolve, reject) => {
        res.on('finish', resolve);
        res.on('error', reject);
      });

      await Gnosis.streamGnosisWalletTransactions({
        chain: 'ETH',
        network: 'mainnet',
        multisigContractAddress: TO,
        wallet: { _id: new ObjectId() },
        req,
        res,
        args: { tokenAddress: TOKEN }
      } as any);
      await finished;
      return chunks.join('').split('\n').filter(Boolean).map(row => JSON.parse(row));
    }

    it('replaces only legacy ERC-20 entries and preserves native/internal entries', function() {
      const tx = makeTx({
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: ERC20_EFFECTS_VERSION,
          items: [validCanonicalEffect()]
        }
      });

      expect(getEffectiveEvmEffects(tx, enableConfig(100))).to.deep.equal([nativeEffect, validCanonicalEffect()]);
    });

    it('treats valid empty items as authoritative zero', function() {
      const tx = makeTx({ erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [] } });
      expect(getEffectiveEvmEffects(tx, enableConfig(100))).to.deep.equal([nativeEffect]);
    });

    it('rejects structurally impossible canonical amounts and fails closed after activation', function() {
      const tx = makeTx({
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect({ amount: (2n ** 256n).toString() })]
        }
      });
      expect(getEffectiveEvmEffects(tx, enableConfig(100))).to.deep.equal([nativeEffect]);
    });

    it('uses historical fallback below activation and fails closed at or above activation', function() {
      const stale = makeTx({ erc20Effects: { blockHash: OTHER_BLOCK_HASH, version: 1, items: [validCanonicalEffect()] } });
      expect(getEffectiveEvmEffects(stale, enableConfig(101))).to.deep.equal([nativeEffect, heuristicEffect]);
      expect(getEffectiveEvmEffects(stale, enableConfig(100))).to.deep.equal([nativeEffect]);

      const missing = makeTx({ erc20Effects: undefined });
      expect(getEffectiveEvmEffects(missing, enableConfig(100))).to.deep.equal([nativeEffect]);

      const inconsistentConfirmed = makeTx({ blockHash: undefined, erc20Effects: undefined });
      expect(getEffectiveEvmEffects(inconsistentConfirmed, enableConfig(100))).to.deep.equal([nativeEffect]);
    });

    it('retains master heuristic behavior for pending transactions', function() {
      const pending = makeTx({ blockHeight: -1, blockHash: undefined, erc20Effects: undefined });
      expect(getEffectiveEvmEffects(pending, enableConfig(0))).to.deep.equal([nativeEffect, heuristicEffect]);
    });

    it('does not apply local strict-read normalization to external-provider rows', function() {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(0));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const external = makeTx({ _id: 'external-provider-row', erc20Effects: undefined });
      provider.populateEffects(external);
      const transformed = EVMTransactionStorage._apiTransform(external, { object: true }) as any;
      expect(transformed.effects).to.deep.equal([nativeEffect, heuristicEffect]);
    });

    it('applies the same normalizer to individual and block-stream local reads', async function() {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(100));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      provider._getTransaction = sandbox.stub().resolves({ tipHeight: 110, found: makeLocalTx() });
      provider.populateReceipt = sandbox.stub().callsFake(async tx => tx);

      const individual = await provider.getTransaction({ chain: 'ETH', network: 'mainnet', txId: TX1 });
      expect(individual.effects).to.deep.equal([nativeEffect]);
      expect(individual).not.to.have.property('erc20Effects');

      let blockRow: any;
      provider.getLocalTip = sandbox.stub().resolves({ height: 110 });
      sandbox.stub(Storage, 'apiStreamingFind').callsFake((_model, _query, _args, _req, _res, transform: any) => {
        blockRow = JSON.parse(transform(makeLocalTx()));
        return undefined as any;
      });
      await provider.streamTransactions({
        chain: 'ETH',
        network: 'mainnet',
        args: { blockHeight: 100 },
        req: {} as any,
        res: {} as any
      });
      expect(blockRow.effects).to.deep.equal([nativeEffect]);
    });

    it('drops wallet-history rows selected only by discarded heuristic ERC-20 effects', async function() {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(100));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const requestedAddress = OTHER;
      const cursor = Readable.from([makeLocalTx({ from: FROM, to: TOKEN })], { objectMode: true }) as any;
      cursor.sort = sandbox.stub().returns(cursor);
      cursor.addCursorFlag = sandbox.stub().returns(cursor);
      cursor.close = sandbox.stub().resolves();
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursor)
      } as any));
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({ objectMode: true, write(_chunk, _encoding, done) { done(); } }) as any;
      const populate = new PopulateEffectsForAddressTransform(provider, [requestedAddress]);

      const stream = await provider._buildWalletTransactionsStream({
        chain: 'ETH',
        network: 'mainnet',
        wallet: { _id: new ObjectId() },
        args: {},
        req,
        res
      }, {
        transactionStream: new PopulateEffectsTransform(provider),
        populateEffects: populate,
        walletAddresses: [requestedAddress]
      });

      const rows = await collectObjects(stream);
      expect(rows).to.deep.equal([]);
    });

    it('preserves arbitrary-address rows selected through legacy internal.action.to', async function() {
      sandbox.stub(Config, 'chainConfig').returns({
        erc20Effects: { materializationEnabled: false }
      } as IEVMNetworkConfig);
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const internalOnly = makeLocalTx({
        effects: [],
        erc20Effects: undefined,
        internal: [{
          action: { from: TOKEN, to: OTHER, value: '0' },
          abiType: undefined,
          traceAddress: [0]
        }]
      });
      let capturedQuery: any;
      const cursor = Readable.from([internalOnly], { objectMode: true }) as any;
      cursor.close = sandbox.stub().callsFake(() => cursor.destroy());
      sandbox.stub(EVMTransactionStorage, 'getTransactions').callsFake(params => {
        capturedQuery = params.query;
        return cursor;
      });

      const chunks: string[] = [];
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({
        write(chunk, _encoding, done) {
          chunks.push(chunk.toString());
          done();
        }
      }) as any;
      res.type = sandbox.stub().returns(res);
      const finished = new Promise<void>((resolve, reject) => {
        res.on('finish', resolve);
        res.on('error', reject);
      });

      await provider._buildAddressTransactionsStream({
        chain: 'ETH',
        network: 'mainnet',
        address: OTHER,
        args: {},
        req,
        res
      });
      await finished;

      const output = JSON.parse(chunks.join(''));
      expect(output).to.have.length(1);
      expect(output[0].txid).to.equal(TX1);
      expect(output[0].effects).to.deep.equal([]);
      expect(capturedQuery.$or).to.deep.include({
        chain: 'ETH',
        network: 'mainnet',
        'internal.action.to': OTHER
      });
    });

    it('does not synthesize missing legacy effects for arbitrary-address history', async function() {
      sandbox.stub(Config, 'chainConfig').returns({
        erc20Effects: { materializationEnabled: false }
      } as IEVMNetworkConfig);
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const storedEmptyEffects = makeLocalTx({
        to: OTHER,
        effects: [],
        erc20Effects: undefined,
        internal: [{
          action: { from: TOKEN, to: TO, value: '1' },
          abiType: undefined,
          traceAddress: [0]
        }]
      });
      expect(EVMTransactionStorage.getEffects(storedEmptyEffects)).to.have.length(1);

      const cursor = Readable.from([storedEmptyEffects], { objectMode: true }) as any;
      cursor.close = sandbox.stub().callsFake(() => cursor.destroy());
      sandbox.stub(EVMTransactionStorage, 'getTransactions').returns(cursor);

      const chunks: string[] = [];
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({
        write(chunk, _encoding, done) {
          chunks.push(chunk.toString());
          done();
        }
      }) as any;
      res.type = sandbox.stub().returns(res);
      const finished = new Promise<void>((resolve, reject) => {
        res.on('finish', resolve);
        res.on('error', reject);
      });

      await provider._buildAddressTransactionsStream({
        chain: 'ETH',
        network: 'mainnet',
        address: OTHER,
        args: {},
        req,
        res
      });
      await finished;

      const output = JSON.parse(chunks.join(''));
      expect(output).to.have.length(1);
      expect(output[0].txid).to.equal(TX1);
      expect(output[0].effects).to.deep.equal([]);
    });

    it('applies arbitrary-address limits after canonical normalization and relevance filtering', async function() {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(100));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const canonicalTx = makeLocalTx({
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect({ to: OTHER })]
        }
      });
      const staleHeuristicOnly = makeLocalTx({
        txid: TX2,
        from: FROM,
        to: TOKEN,
        effects: [heuristicEffect],
        erc20Effects: undefined
      });
      const secondCanonicalTx = makeLocalTx({
        txid: hash('55'),
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect({ to: OTHER, logIndex: 2, callStack: 'log:2' })]
        }
      });
      const sourceRows = [staleHeuristicOnly, canonicalTx, secondCanonicalTx];
      let cursor: any;
      let capturedQuery: any;
      let capturedOptions: any;
      sandbox.stub(EVMTransactionStorage, 'getTransactions').callsFake(params => {
        capturedQuery = params.query;
        capturedOptions = params.options;
        const databaseLimit = Number(params.options.limit);
        const returnedRows = databaseLimit > 0 ? sourceRows.slice(0, databaseLimit) : sourceRows;
        cursor = Readable.from(returnedRows, { objectMode: true }) as any;
        cursor.close = sandbox.stub().callsFake(() => cursor.destroy());
        return cursor;
      });

      const chunks: string[] = [];
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({
        write(chunk, _encoding, done) {
          chunks.push(chunk.toString());
          done();
        }
      }) as any;
      res.type = sandbox.stub().returns(res);
      const finished = new Promise<void>((resolve, reject) => {
        res.on('finish', resolve);
        res.on('error', reject);
      });

      await provider._buildAddressTransactionsStream({
        chain: 'ETH',
        network: 'mainnet',
        address: OTHER.toLowerCase(),
        args: { limit: 1 },
        req,
        res
      });
      await finished;

      const output = JSON.parse(chunks.join(''));
      expect(output).to.have.length(1);
      expect(output[0].txid).to.equal(TX1);
      expect(output[0].effects).to.deep.equal([nativeEffect, validCanonicalEffect({ to: OTHER })]);
      expect(capturedOptions).not.to.have.property('limit');
      expect(cursor.close.calledOnce).to.equal(true);
      expect(capturedQuery.$or).to.deep.include({
        chain: 'ETH',
        network: 'mainnet',
        'erc20Effects.items.to': { $in: [OTHER.toLowerCase(), OTHER] }
      });
    });

    it('preserves the magnitude and cursor-closing behavior of a negative address limit', async function() {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(100));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const first = makeLocalTx({
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect({ to: OTHER })]
        }
      });
      const second = makeLocalTx({
        txid: TX2,
        transactionIndex: 1,
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect({ to: OTHER, logIndex: 2, callStack: 'log:2' })]
        }
      });
      let cursor: any;
      let capturedOptions: any;
      sandbox.stub(EVMTransactionStorage, 'getTransactions').callsFake(params => {
        capturedOptions = params.options;
        cursor = Readable.from([first, second], { objectMode: true }) as any;
        cursor.close = sandbox.stub().callsFake(() => cursor.destroy());
        return cursor;
      });

      const chunks: string[] = [];
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({
        write(chunk, _encoding, done) {
          chunks.push(chunk.toString());
          done();
        }
      }) as any;
      res.type = sandbox.stub().returns(res);
      const finished = new Promise<void>((resolve, reject) => {
        res.on('finish', resolve);
        res.on('error', reject);
      });

      await provider._buildAddressTransactionsStream({
        chain: 'ETH',
        network: 'mainnet',
        address: OTHER,
        args: { limit: -1 },
        req,
        res
      });
      await finished;

      const output = JSON.parse(chunks.join(''));
      expect(output).to.have.length(1);
      expect(output[0].txid).to.equal(TX1);
      expect(capturedOptions).not.to.have.property('limit');
      expect(cursor.close.calledOnce).to.equal(true);
    });

    it('rejects exceptional numeric address limits instead of silently streaming without a limit', async function() {
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const getTransactions = sandbox.stub(EVMTransactionStorage, 'getTransactions');

      await expectRejected(provider._buildAddressTransactionsStream({
        chain: 'ETH',
        network: 'mainnet',
        address: OTHER,
        args: { limit: '1.5' },
        req: {} as any,
        res: {} as any
      }), /finite safe integer/i);

      expect(getTransactions.called).to.equal(false);
    });

    it('feeds canonical items into local token-history transforms', async function() {
      sandbox.stub(Config, 'chainConfig').returns(enableConfig(100));
      const provider = Object.create(BaseEVMStateProvider.prototype) as any;
      const populate = new PopulateEffectsTransform(provider);
      const tokenFilter = new Erc20RelatedFilterTransform(TOKEN);
      populate.pipe(tokenFilter);
      const rowsPromise = collectObjects(tokenFilter);
      populate.end(makeLocalTx({
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      }));
      const rows = await rowsPromise;
      expect(rows).to.have.length(1);
      expect(rows[0]).to.include({ from: FROM, to: TO, value: 123, callStack: 'log:1' });
    });

    it('extends Gnosis local token-history selection to canonical-only items', async function() {
      const cursor = Readable.from([], { objectMode: true }) as any;
      cursor.sort = sandbox.stub().returns(cursor);
      cursor.addCursorFlag = sandbox.stub().returns(cursor);
      cursor.close = sandbox.stub().resolves();
      let capturedQuery: any;
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().callsFake(query => {
          capturedQuery = query;
          return cursor;
        })
      } as any));
      sandbox.stub(ChainStateProvider, 'get').returns({
        getWalletTransactionQuery: sandbox.stub().returns({ chain: 'ETH', network: 'mainnet', wallets: new ObjectId() }),
        populateEffects: sandbox.stub().callsFake(tx => tx),
        populateReceipt: sandbox.stub().callsFake(tx => tx)
      } as any);
      const req = new Readable({ read() {} }) as any;
      const res = new Writable({ write(_chunk, _encoding, done) { done(); } }) as any;

      await Gnosis.streamGnosisWalletTransactions({
        chain: 'ETH',
        network: 'mainnet',
        multisigContractAddress: TO,
        wallet: { _id: new ObjectId() },
        req,
        res,
        args: { tokenAddress: TOKEN }
      } as any);

      expect(capturedQuery.$or).to.deep.include({
        chain: 'ETH',
        network: 'mainnet',
        'erc20Effects.items': {
          $elemMatch: {
            contractAddress: { $in: [TOKEN, TOKEN.toLowerCase()] },
            to: { $in: [TO, TO.toLowerCase()] }
          }
        }
      });
    });

    it('drops a Gnosis token row when an authoritative empty result removes its only token relationship', async function() {
      const rows = await streamGnosisTokenRows([makeLocalTx({
        to: TO,
        effects: [heuristicSafeTokenEffect],
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [] },
        receipt: { status: true }
      })]);

      expect(rows).to.deep.equal([]);
    });

    it('drops a Gnosis token row when a stale materialization leaves no valid normalized token relationship', async function() {
      const rows = await streamGnosisTokenRows([makeLocalTx({
        to: TO,
        effects: [heuristicSafeTokenEffect],
        erc20Effects: {
          blockHash: OTHER_BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect()]
        },
        receipt: { status: true }
      })]);

      expect(rows).to.deep.equal([]);
    });

    it('emits a valid canonical Gnosis token effect after normalization', async function() {
      const rows = await streamGnosisTokenRows([makeLocalTx({
        to: TO,
        effects: [heuristicSafeTokenEffect],
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [validCanonicalEffect()]
        },
        receipt: { status: true }
      })]);

      expect(rows).to.have.length(1);
      expect(rows[0]).to.include({ category: 'receive', satoshis: '123' });
      expect(rows[0].effects).to.deep.equal([validCanonicalEffect()]);
    });

    it('emits only Safe-related canonical siblings in Gnosis token history', async function() {
      const safeReceive = validCanonicalEffect({ amount: '5' });
      const safeSend = validCanonicalEffect({
        from: TO,
        to: OTHER,
        amount: '7',
        logIndex: 2,
        callStack: 'log:2'
      });
      const unrelated = validCanonicalEffect({
        from: FROM,
        to: OTHER,
        amount: '9',
        logIndex: 3,
        callStack: 'log:3'
      });
      const rows = await streamGnosisTokenRows([makeLocalTx({
        to: TO,
        effects: [heuristicSafeTokenEffect],
        erc20Effects: {
          blockHash: BLOCK_HASH,
          version: 1,
          items: [safeReceive, safeSend, unrelated]
        },
        receipt: { status: true }
      })]);

      expect(rows).to.have.length(2);
      expect(rows.map(row => row.effects[0].logIndex)).to.deep.equal([1, 2]);
      expect(rows.map(row => row.category)).to.deep.equal(['receive', 'send']);
      expect(rows.map(row => row.satoshis)).to.deep.equal(['5', -7]);
    });
  });

  describe('wallet association and balance-cache integration', function() {
    it('overlays prepared materialization and merges canonical wallets in the pre-fork parent-copy path', async function() {
      const childTxid = hash('ab');
      const parentTxid = `0x${childTxid.slice(2).toUpperCase()}`;
      const parentWallet = new ObjectId();
      const canonicalWallet = new ObjectId();
      const parentTx = makeLocalTx({
        chain: 'ETH',
        txid: parentTxid,
        from: OTHER,
        to: OTHER,
        wallets: [parentWallet]
      });
      const parentFind = sandbox.stub();
      parentFind.onFirstCall().returns(cursorWithRows([parentTx]));
      parentFind.onSecondCall().returns(cursorWithRows([makeLocalTx({
        chain: 'ARB',
        txid: childTxid,
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      })]));
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ find: parentFind } as any));
      const walletFind = sandbox.stub().returns({
        toArray: sandbox.stub().resolves([{ address: TO.toLowerCase(), wallet: canonicalWallet }])
      });
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({ find: walletFind } as any));
      const preparedTx = makeTx({
        chain: 'ARB',
        txid: childTxid,
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });

      const [operation] = await EVMTransactionStorage.addTransactions({
        txs: [preparedTx],
        height: 100,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      });

      expect(parentFind.firstCall.args[0]).to.deep.equal({ blockHeight: 100, chain: 'ETH', network: 'mainnet' });
      expect(walletFind.firstCall.args[0]).to.include({ chain: 'ARB', network: 'mainnet' });
      expect(walletFind.firstCall.args[0].address.$in).to.include(TO.toLowerCase());
      expect(operation.updateOne.filter).to.deep.equal({
        txid: { $in: [parentTxid, childTxid] },
        chain: 'ARB',
        network: 'mainnet'
      });
      expect(operation.updateOne.update.$set.from).to.equal(OTHER);
      expect(operation.updateOne.update.$set).not.to.have.property('_id');
      expect(operation.updateOne.update.$set).not.to.have.property('txid');
      expect(operation.updateOne.update.$set.chain).to.equal('ARB');
      expect(operation.updateOne.update.$set.network).to.equal('mainnet');
      expect(operation.updateOne.update.$set.erc20Effects).to.deep.equal(preparedTx.erc20Effects);
      expect(operation.updateOne.update.$set).not.to.have.property('wallets');
      expect(operation.updateOne.update.$addToSet.wallets.$each).to.deep.equal([canonicalWallet]);
      expect(operation.updateOne.update.$setOnInsert).to.deep.equal({ txid: childTxid });
    });

    it('uses insert-only empty wallets for a pre-fork authoritative empty materialization', async function() {
      const parentTx = makeLocalTx({ chain: 'ETH', wallets: [new ObjectId()] });
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([parentTx]))
      } as any));
      const walletFind = sandbox.stub();
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({ find: walletFind } as any));
      const preparedTx = makeTx({
        chain: 'ARB',
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [] }
      });

      const [operation] = await EVMTransactionStorage.addTransactions({
        txs: [preparedTx],
        height: 100,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      });

      expect(walletFind.called).to.equal(false);
      expect(operation.updateOne.update.$set.erc20Effects).to.deep.equal(preparedTx.erc20Effects);
      expect(operation.updateOne.update.$set).not.to.have.property('wallets');
      expect(operation.updateOne.update.$setOnInsert).to.deep.equal({ txid: preparedTx.txid, wallets: [] });
      expect(operation.updateOne.update).not.to.have.property('$addToSet');
    });

    it('retains pre-fork master behavior without copying a parent-owned materialization', async function() {
      const parentTx = makeLocalTx({
        chain: 'ETH',
        txid: TX2,
        wallets: [new ObjectId()],
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });
      const txFind = sandbox.stub();
      txFind.onFirstCall().returns(cursorWithRows([parentTx]));
      txFind.onSecondCall().returns(cursorWithRows([]));
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: txFind
      } as any));
      const walletFind = sandbox.stub();
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({ find: walletFind } as any));

      const [operation] = await EVMTransactionStorage.addTransactions({
        txs: [makeTx({ chain: 'ARB', txid: TX1, erc20Effects: undefined })],
        height: 100,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      });

      expect(walletFind.called).to.equal(false);
      expect(operation.updateOne.filter.txid).to.equal(TX2);
      expect(operation.updateOne.update.$set.wallets).to.deep.equal([]);
      expect(operation.updateOne.update.$set).not.to.have.property('erc20Effects');
      expect(operation.updateOne.update).not.to.have.property('$addToSet');
      expect(operation.updateOne.update).not.to.have.property('$setOnInsert');
    });

    it('sanitizes the parent copy and preserves a materialized pre-fork child identity and wallets', async function() {
      const childTxid = hash('ab');
      const parentTxid = `0x${childTxid.slice(2).toUpperCase()}`;
      const existingWallet = new ObjectId();
      const masterWallet = new ObjectId();
      const parentTx = makeLocalTx({ chain: 'ETH', txid: parentTxid, wallets: [new ObjectId()] });
      const childTx = makeLocalTx({
        chain: 'ARB',
        txid: childTxid,
        wallets: [existingWallet],
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });
      const txFind = sandbox.stub();
      txFind.onFirstCall().returns(cursorWithRows([parentTx]));
      txFind.onSecondCall().returns(cursorWithRows([childTx]));
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ find: txFind } as any));
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returns({ toArray: sandbox.stub().resolves([{ wallet: masterWallet }]) })
      } as any));

      const [operation] = await EVMTransactionStorage.addTransactions({
        txs: [makeTx({ chain: 'ARB', txid: childTxid, erc20Effects: undefined })],
        height: 100,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      });

      expect(txFind.secondCall.args[0]).to.deep.equal({
        chain: 'ARB',
        network: 'mainnet',
        txid: { $in: [parentTxid, childTxid] },
        erc20Effects: { $exists: true }
      });
      expect(operation.updateOne.filter).to.deep.equal({
        _id: childTx._id,
        txid: childTxid,
        chain: 'ARB',
        network: 'mainnet'
      });
      expect(operation.updateOne.upsert).to.equal(false);
      expect(operation.updateOne.update.$set.chain).to.equal('ARB');
      expect(operation.updateOne.update.$set.network).to.equal('mainnet');
      for (const field of ['_id', 'txid', 'wallets', 'erc20Effects']) {
        expect(operation.updateOne.update.$set).not.to.have.property(field);
      }
      expect(operation.updateOne.update.$addToSet.wallets.$each).to.deep.equal([masterWallet]);
      expect(operation.updateOne.update).not.to.have.property('$setOnInsert');
    });

    it('rejects pre-fork parent/prepared membership disagreement before wallet lookup', async function() {
      const parentTx = makeLocalTx({ chain: 'ETH', txid: TX2 });
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([parentTx]))
      } as any));
      const walletFind = sandbox.stub();
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({ find: walletFind } as any));

      await expectRejected(EVMTransactionStorage.addTransactions({
        txs: [makeTx({
          chain: 'ARB',
          txid: TX1,
          erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
        })],
        height: 100,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      }), /no prepared child transaction matches/i);

      expect(walletFind.called).to.equal(false);
    });

    it('rejects a prepared materialization bound to a different pre-fork parent inclusion', async function() {
      const parentTx = makeLocalTx({ chain: 'ETH', blockHash: OTHER_BLOCK_HASH });
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([parentTx]))
      } as any));
      const walletFind = sandbox.stub();
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({ find: walletFind } as any));

      await expectRejected(EVMTransactionStorage.addTransactions({
        txs: [makeTx({
          chain: 'ARB',
          erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
        })],
        height: 100,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      }), /does not match pre-fork parent inclusion/i);

      expect(walletFind.called).to.equal(false);
    });

    it('preserves a newer pre-fork child materialization while updating parent-owned fields and wallets and invalidating canonical caches', async function() {
      const childTxid = hash('ab');
      const parentTxid = `0x${childTxid.slice(2).toUpperCase()}`;
      const canonicalWallet = new ObjectId();
      const parentTx = makeLocalTx({ chain: 'ETH', txid: parentTxid, from: OTHER, to: OTHER });
      const childTx = makeLocalTx({
        chain: 'ARB',
        txid: childTxid,
        erc20Effects: { blockHash: BLOCK_HASH, version: 2, items: [validCanonicalEffect({ amount: '222' })] }
      });
      const txFind = sandbox.stub();
      txFind.onFirstCall().returns(cursorWithRows([parentTx]));
      txFind.onSecondCall().returns(cursorWithRows([childTx]));
      const bulkWrite = sandbox.stub().resolves();
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: txFind,
        update: sandbox.stub().resolves(),
        bulkWrite
      } as any));
      sandbox.stub(Config, 'get').returns({ maxPoolSize: 1 } as any);
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returns({ toArray: sandbox.stub().resolves([{ wallet: canonicalWallet }]) })
      } as any));
      const expireMaster = sandbox.stub(EVMTransactionStorage, 'expireBalanceCache').resolves();
      const expire = sandbox.stub(CacheStorage, 'expire').resolves();
      const preparedTx = makeTx({
        chain: 'ARB',
        txid: childTxid,
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });

      await EVMTransactionStorage.batchImport({
        txs: [preparedTx],
        height: 100,
        blockHash: BLOCK_HASH,
        chain: 'ARB',
        network: 'mainnet',
        parentChain: 'ETH',
        forkHeight: 200,
        initialSyncComplete: true
      });
      const operation = bulkWrite.firstCall.args[0][0];

      expect(txFind.secondCall.args[0]).to.deep.equal({
        chain: 'ARB',
        network: 'mainnet',
        txid: { $in: [parentTxid, childTxid] },
        erc20Effects: { $exists: true }
      });
      expect(operation.updateOne.update.$set.from).to.equal(OTHER);
      expect(operation.updateOne.update.$set).not.to.have.property('erc20Effects');
      expect(operation.updateOne.update.$addToSet.wallets.$each).to.deep.equal([canonicalWallet]);
      expect(expireMaster.calledOnce).to.equal(true);
      expect(expire.getCalls().map(call => call.args[0])).to.have.members([
        `getBalanceForAddress-ARB-mainnet-${FROM.toLowerCase()}-${TOKEN.toLowerCase()}`,
        `getBalanceForAddress-ARB-mainnet-${TO.toLowerCase()}-${TOKEN.toLowerCase()}`
      ]);
      expect(expire.getCalls().map(call => call.args[0])).not.to.include(
        `getBalanceForAddress-ARB-mainnet-${OTHER.toLowerCase()}-${OTHER_TOKEN.toLowerCase()}`
      );
      expect(bulkWrite.calledOnce).to.equal(true);
      expect(bulkWrite.calledBefore(expire)).to.equal(true);
    });

    it('preserves a newer ordinary materialization while updating master-owned fields and wallets and invalidating canonical caches', async function() {
      sandbox.stub(Config, 'chainConfig').returns({ leanTransactionStorage: false } as IEVMNetworkConfig);
      sandbox.stub(Config, 'get').returns({ maxPoolSize: 1 } as any);
      const canonicalWallet = new ObjectId();
      const versionCursor = cursorWithRows([makeLocalTx({
        blockHash: OTHER_BLOCK_HASH,
        erc20Effects: { blockHash: OTHER_BLOCK_HASH, version: 2, items: [validCanonicalEffect({ amount: '222' })] }
      })]);
      const txFind = sandbox.stub().returns(versionCursor);
      const bulkWrite = sandbox.stub().resolves();
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: txFind,
        update: sandbox.stub().resolves(),
        bulkWrite
      } as any));
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returns({ toArray: sandbox.stub().resolves([{ wallet: canonicalWallet }]) })
      } as any));
      const expireMaster = sandbox.stub(EVMTransactionStorage, 'expireBalanceCache').resolves();
      const expire = sandbox.stub(CacheStorage, 'expire').resolves();
      const tx = makeTx({
        fee: 99,
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });

      await EVMTransactionStorage.batchImport({
        txs: [tx],
        height: 100,
        blockHash: BLOCK_HASH,
        chain: 'ETH',
        network: 'mainnet',
        initialSyncComplete: true
      });
      const operation = bulkWrite.firstCall.args[0][0];

      expect(txFind.firstCall.args[0]).to.deep.equal({
        chain: 'ETH',
        network: 'mainnet',
        txid: { $in: [TX1] },
        erc20Effects: { $exists: true }
      });
      expect(versionCursor.project.firstCall.args[0]).to.deep.equal({ txid: 1, 'erc20Effects.version': 1 });
      expect(operation.updateOne.update.$set.fee).to.equal(99);
      expect(operation.updateOne.update.$set).not.to.have.property('erc20Effects');
      expect(operation.updateOne.update.$addToSet.wallets.$each).to.deep.equal([canonicalWallet]);
      expect(expireMaster.calledOnce).to.equal(true);
      expect(expire.getCalls().map(call => call.args[0])).to.have.members([
        `getBalanceForAddress-ETH-mainnet-${FROM.toLowerCase()}-${TOKEN.toLowerCase()}`,
        `getBalanceForAddress-ETH-mainnet-${TO.toLowerCase()}-${TOKEN.toLowerCase()}`
      ]);
      expect(expire.getCalls().map(call => call.args[0])).not.to.include(
        `getBalanceForAddress-ETH-mainnet-${OTHER.toLowerCase()}-${OTHER_TOKEN.toLowerCase()}`
      );
      expect(bulkWrite.calledOnce).to.equal(true);
      expect(bulkWrite.calledBefore(expire)).to.equal(true);
    });

    it('writes the current materialization over the same version and onto an existing row with no field', async function() {
      sandbox.stub(Config, 'chainConfig').returns({ leanTransactionStorage: false } as IEVMNetworkConfig);
      const current = { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect({ amount: '1' })] };
      const txFind = sandbox.stub().returns(cursorWithRows([
        makeLocalTx({ txid: TX1, erc20Effects: current }),
        makeLocalTx({ txid: TX2, erc20Effects: undefined })
      ]));
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ find: txFind } as any));
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([]))
      } as any));
      const first = makeTx({ txid: TX1, erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] } });
      const second = makeTx({ txid: TX2, erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [] } });

      const operations = await EVMTransactionStorage.addTransactions({
        txs: [first, second],
        height: 100,
        chain: 'ETH',
        network: 'mainnet',
        initialSyncComplete: true
      });

      expect(operations[0].updateOne.update.$set.erc20Effects).to.deep.equal(first.erc20Effects);
      expect(operations[1].updateOne.update.$set.erc20Effects).to.deep.equal(second.erc20Effects);
    });

    it('merges a canonical recipient wallet without case-normalizing unrelated master-owned addresses', async function() {
      sandbox.stub(Config, 'chainConfig').returns({ leanTransactionStorage: false } as IEVMNetworkConfig);
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([]))
      } as any));
      const canonicalWallet = new ObjectId();
      const unrelatedWallet = new ObjectId();
      const unrelatedTopLevel = OTHER;
      let walletQuery: any;
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().callsFake(query => {
          walletQuery = query;
          const rows = [
            { address: TO.toLowerCase(), wallet: canonicalWallet },
            { address: unrelatedTopLevel.toLowerCase(), wallet: unrelatedWallet }
          ].filter(row => query.address.$in.includes(row.address));
          return { toArray: sandbox.stub().resolves(rows) };
        })
      } as any));
      const tx = makeTx({
        to: unrelatedTopLevel,
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });

      const [operation] = await EVMTransactionStorage.addTransactions({
        txs: [tx],
        height: 100,
        blockTimeNormalized: tx.blockTimeNormalized,
        chain: 'ETH',
        network: 'mainnet',
        initialSyncComplete: true
      });

      expect(walletQuery.address.$in).to.include(TO.toLowerCase());
      expect(walletQuery.address.$in).to.include(unrelatedTopLevel);
      expect(walletQuery.address.$in).not.to.include(unrelatedTopLevel.toLowerCase());
      expect(operation.updateOne.update.$addToSet.wallets.$each).to.deep.equal([canonicalWallet]);
      expect(operation.updateOne.update.$set).not.to.have.property('wallets');
      expect(operation.updateOne.update.$set.effects).to.deep.equal([nativeEffect, heuristicEffect]);
      expect(operation.updateOne.update.$set.erc20Effects.items).to.deep.equal([validCanonicalEffect()]);
    });

    it('preserves canonical wallet ownership on an ordinary omitted-field write and merges master wallets in the same update', async function() {
      sandbox.stub(Config, 'chainConfig').returns({ leanTransactionStorage: false } as IEVMNetworkConfig);
      const canonicalWallet = new ObjectId();
      const masterWallet = new ObjectId();
      const storedCursor = cursorWithRows([makeLocalTx({
        wallets: [canonicalWallet],
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      })]);
      const txFind = sandbox.stub().returns(storedCursor);
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({ find: txFind } as any));
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([{ wallet: masterWallet }]))
      } as any));
      const tx = makeTx({ effects: [], erc20Effects: undefined });

      const [operation] = await EVMTransactionStorage.addTransactions({
        txs: [tx],
        height: 100,
        chain: 'ETH',
        network: 'mainnet',
        initialSyncComplete: true
      });

      expect(txFind.firstCall.args[0]).to.deep.equal({
        chain: 'ETH',
        network: 'mainnet',
        txid: { $in: [TX1] },
        erc20Effects: { $exists: true }
      });
      expect(operation.updateOne.update.$set).not.to.have.property('erc20Effects');
      expect(operation.updateOne.update.$set).not.to.have.property('wallets');
      expect(operation.updateOne.update.$addToSet.wallets.$each).to.deep.equal([masterWallet]);
    });

    it('uses exact master wallet lookup for unmaterialized confirmed and pending transactions', async function() {
      sandbox.stub(Config, 'chainConfig').returns({ leanTransactionStorage: false } as IEVMNetworkConfig);
      sandbox.stub(EVMTransactionStorage, 'collection').get(() => ({
        find: sandbox.stub().returns(cursorWithRows([]))
      } as any));
      const exactWallet = new ObjectId();
      const lowerOnlyWallet = new ObjectId();
      const mixedCaseAddress = '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb';
      const walletQueries: any[] = [];
      sandbox.stub(WalletAddressStorage, 'collection').get(() => ({
        find: sandbox.stub().callsFake(query => {
          walletQueries.push(query);
          const rows = [
            { address: mixedCaseAddress, wallet: exactWallet },
            { address: mixedCaseAddress.toLowerCase(), wallet: lowerOnlyWallet }
          ].filter(row => query.address.$in.includes(row.address));
          return { toArray: sandbox.stub().resolves(rows) };
        })
      } as any));
      const unmaterialized = makeTx({
        from: mixedCaseAddress,
        to: mixedCaseAddress,
        effects: [],
        erc20Effects: undefined
      });
      const pending = makeTx({
        from: mixedCaseAddress,
        to: mixedCaseAddress,
        effects: [],
        blockHeight: -1,
        blockHash: undefined,
        erc20Effects: undefined
      });

      const [confirmedOperation] = await EVMTransactionStorage.addTransactions({
        txs: [unmaterialized],
        height: 100,
        chain: 'ETH',
        network: 'mainnet',
        initialSyncComplete: true
      });
      const [pendingOperation] = await EVMTransactionStorage.addTransactions({
        txs: [pending],
        height: -1,
        chain: 'ETH',
        network: 'mainnet',
        initialSyncComplete: true
      });

      expect(walletQueries).to.have.length(2);
      for (const query of walletQueries) {
        expect(query.address.$in).to.include(mixedCaseAddress);
        expect(query.address.$in).not.to.include(mixedCaseAddress.toLowerCase());
      }
      for (const operation of [confirmedOperation, pendingOperation]) {
        expect(operation.updateOne.update.$set.wallets).to.deep.equal([exactWallet]);
        expect(operation.updateOne.update.$set).not.to.have.property('erc20Effects');
        expect(operation.updateOne.update).not.to.have.property('$addToSet');
      }
    });

    it('invalidates token-balance caches for canonical participants rather than discarded heuristic participants', async function() {
      const expire = sandbox.stub(CacheStorage, 'expire').resolves();
      const tx = makeTx({
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });

      await EVMTransactionStorage.expireBalanceCacheForTransaction({ chain: 'ETH', network: 'mainnet', tx });

      const keys = expire.getCalls().map(call => call.args[0]);
      expect(keys).to.include(`getBalanceForAddress-ETH-mainnet-${TO.toLowerCase()}-${TOKEN.toLowerCase()}`);
      expect(keys).not.to.include(`getBalanceForAddress-ETH-mainnet-${OTHER.toLowerCase()}-${OTHER_TOKEN.toLowerCase()}`);
    });

    it('limits backfill cache invalidation to canonical token participants and makes empty results a no-op', async function() {
      const expire = sandbox.stub(CacheStorage, 'expire').resolves();
      const tx = makeTx({
        erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [validCanonicalEffect()] }
      });

      await EVMTransactionStorage.expireErc20BalanceCacheForTransaction({ chain: 'ETH', network: 'mainnet', tx });

      expect(expire.getCalls().map(call => call.args[0])).to.have.members([
        `getBalanceForAddress-ETH-mainnet-${FROM.toLowerCase()}-${TOKEN.toLowerCase()}`,
        `getBalanceForAddress-ETH-mainnet-${TO.toLowerCase()}-${TOKEN.toLowerCase()}`
      ]);
      expire.resetHistory();

      await EVMTransactionStorage.expireErc20BalanceCacheForTransaction({
        chain: 'ETH',
        network: 'mainnet',
        tx: makeTx({ erc20Effects: { blockHash: BLOCK_HASH, version: 1, items: [] } })
      });
      expect(expire.called).to.equal(false);
    });
  });
});
