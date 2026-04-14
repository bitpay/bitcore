import { expect } from 'chai';
import * as sinon from 'sinon';
import { BitcoinP2PWorker } from '../../../../src/modules/bitcoin/p2p';
import { ChainStateProvider } from '../../../../src/providers/chain-state';
import { StateStorage } from '../../../../src/models/state';
import { Libs } from '../../../../src/providers/libs';
import { unitBeforeHelper, unitAfterHelper } from '../../../helpers/unit';

describe('BitcoinP2PWorker', function() {
  const sandbox = sinon.createSandbox();
  const chain = 'BTC';
  const network = 'regtest';

  before(unitBeforeHelper);
  after(unitAfterHelper);
  afterEach(() => sandbox.restore());

  function createWorker(overrides: Partial<{ prefetchSize: number; threads: number }> = {}) {
    const mockBitcoreLib = {
      Networks: { get: sandbox.stub().returns('regtest') },
      encoding: { BufferReader: sandbox.stub() },
      Block: sandbox.stub().callsFake((buf: Buffer) => ({
        hash: buf.toString('hex').substring(0, 8),
        header: { toObject: () => ({ hash: 'testhash', prevHash: '', time: Date.now() / 1000 }) },
        transactions: []
      }))
    };
    const mockMessages = function() {};
    (mockMessages as any).prototype = {};
    const mockPool = function() {};
    (mockPool as any).prototype = { on: sandbox.stub(), connect: sandbox.stub(), once: sandbox.stub() };
    const mockInventory = { TYPE: { BLOCK: 1, TX: 2 } };
    const mockBitcoreP2p = {
      Messages: mockMessages,
      Pool: mockPool,
      Inventory: mockInventory
    };
    sandbox.stub(Libs, 'get').returns({ lib: mockBitcoreLib, p2p: mockBitcoreP2p } as any);

    const chainConfig = {
      trustedPeers: [],
      parentChain: undefined,
      forkHeight: undefined,
      rpc: { host: 'localhost', port: 8332, username: 'test', password: 'test' },
      ...overrides
    };
    return new BitcoinP2PWorker({ chain, network, chainConfig });
  }

  function setupSyncStubs(tipHeight = 100) {
    sandbox.stub(StateStorage, 'collection').value({
      findOne: sandbox.stub().resolves({ initialSyncComplete: [`${chain}:${network}`] }),
      findOneAndUpdate: sandbox.stub().resolves()
    });
    sandbox.stub(ChainStateProvider, 'getLocalTip').resolves({ height: tipHeight } as any);
    sandbox.stub(ChainStateProvider, 'getLocatorHashes').resolves([Array(65).join('0')]);
  }

  describe('useMultiThread()', function() {
    it('should return true when CPU cores > 2 and threads not configured', function() {
      const worker = createWorker();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cpuStub = sandbox.stub(require('os'), 'cpus');
      cpuStub.returns(new Array(8)); // 8 cores
      expect(worker.useMultiThread()).to.equal(true);
    });

    it('should return false when threads is 0', function() {
      const worker = createWorker({ threads: 0 });
      expect(worker.useMultiThread()).to.equal(false);
    });

    it('should return true when threads is > 0', function() {
      const worker = createWorker({ threads: 4 });
      expect(worker.useMultiThread()).to.equal(true);
    });
  });

  describe('sync() with prefetching (single-thread mode)', function() {
    it('should prefetch blocks in parallel during sync', async function() {
      const worker = createWorker({ prefetchSize: 3, threads: 0 });

      const getBlockStartTimes: { hash: string; time: number }[] = [];
      const processOrder: string[] = [];

      const blockData: Record<string, any> = {};
      for (let i = 0; i < 5; i++) {
        const hash = `hash_${i}`;
        blockData[hash] = { hash, header: { toObject: () => ({ hash, prevHash: `hash_${i - 1}`, time: Date.now() / 1000 }) }, transactions: [] };
      }

      const headers = Object.keys(blockData).map(hash => ({ hash }));

      sandbox.stub(worker as any, 'getBlock').callsFake(async (hash: string) => {
        getBlockStartTimes.push({ hash, time: Date.now() });
        await new Promise(r => setTimeout(r, 50));
        return blockData[hash];
      });

      sandbox.stub(worker as any, 'processBlock').callsFake(async (block: any) => {
        processOrder.push(block.hash);
        await new Promise(r => setTimeout(r, 10));
      });

      setupSyncStubs();

      let headerCallCount = 0;
      sandbox.stub(worker as any, 'getHeadersForSync').callsFake(async () => {
        headerCallCount++;
        return headerCallCount === 1 ? headers : [];
      });

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      // Blocks processed in sequential order
      expect(processOrder).to.deep.equal(['hash_0', 'hash_1', 'hash_2', 'hash_3', 'hash_4']);

      // First 3 getBlock calls started nearly simultaneously (prefetched)
      expect(getBlockStartTimes.length).to.equal(5);
      const firstThreeStartTimes = getBlockStartTimes.slice(0, 3).map(t => t.time);
      const timeDiff = Math.max(...firstThreeStartTimes) - Math.min(...firstThreeStartTimes);
      expect(timeDiff).to.be.lessThan(20);
    });

    it('should process blocks sequentially even with prefetch', async function() {
      const worker = createWorker({ prefetchSize: 5, threads: 0 });

      const processOrder: number[] = [];
      const headers = Array.from({ length: 5 }, (_, i) => ({ hash: `block_${i}` }));

      sandbox.stub(worker as any, 'getBlock').callsFake(async (hash: string) => {
        const idx = parseInt(hash.split('_')[1]);
        // Later blocks resolve faster to test ordering
        await new Promise(r => setTimeout(r, (5 - idx) * 20));
        return { hash, header: { toObject: () => ({ hash, prevHash: '', time: Date.now() / 1000 }) }, transactions: [] };
      });

      sandbox.stub(worker as any, 'processBlock').callsFake(async (block: any) => {
        const idx = parseInt(block.hash.split('_')[1]);
        processOrder.push(idx);
      });

      setupSyncStubs();

      let headerCallCount = 0;
      sandbox.stub(worker as any, 'getHeadersForSync').callsFake(async () => {
        headerCallCount++;
        return headerCallCount === 1 ? headers : [];
      });

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      expect(processOrder).to.deep.equal([0, 1, 2, 3, 4]);
    });

    it('should work with prefetchSize=0 (disabled)', async function() {
      const worker = createWorker({ prefetchSize: 0, threads: 0 });

      const getBlockCalls: number[] = [];
      const headers = Array.from({ length: 3 }, (_, i) => ({ hash: `blk_${i}` }));

      sandbox.stub(worker as any, 'getBlock').callsFake(async (hash: string) => {
        getBlockCalls.push(Date.now());
        return { hash, header: { toObject: () => ({ hash, prevHash: '', time: Date.now() / 1000 }) }, transactions: [] };
      });

      sandbox.stub(worker as any, 'processBlock').callsFake(async () => {
        await new Promise(r => setTimeout(r, 30));
      });

      setupSyncStubs();

      let headerCallCount = 0;
      sandbox.stub(worker as any, 'getHeadersForSync').callsFake(async () => {
        headerCallCount++;
        return headerCallCount === 1 ? headers : [];
      });

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      // Sequential: each getBlock starts after previous processBlock completes
      for (let i = 1; i < getBlockCalls.length; i++) {
        expect(getBlockCalls[i] - getBlockCalls[i - 1]).to.be.at.least(25);
      }
    });

    it('should use default prefetchSize of 10 when not configured', async function() {
      const worker = createWorker({ threads: 0 });

      let concurrentFetches = 0;
      let maxConcurrentFetches = 0;
      const headers = Array.from({ length: 15 }, (_, i) => ({ hash: `h_${i}` }));

      sandbox.stub(worker as any, 'getBlock').callsFake(async (hash: string) => {
        concurrentFetches++;
        maxConcurrentFetches = Math.max(maxConcurrentFetches, concurrentFetches);
        await new Promise(r => setTimeout(r, 20));
        concurrentFetches--;
        return { hash, header: { toObject: () => ({ hash, prevHash: '', time: Date.now() / 1000 }) }, transactions: [] };
      });

      sandbox.stub(worker as any, 'processBlock').callsFake(async () => {
        await new Promise(r => setTimeout(r, 5));
      });

      setupSyncStubs();

      let headerCallCount = 0;
      sandbox.stub(worker as any, 'getHeadersForSync').callsFake(async () => {
        headerCallCount++;
        return headerCallCount === 1 ? headers : [];
      });

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      expect(maxConcurrentFetches).to.be.greaterThan(1);
      expect(maxConcurrentFetches).to.be.at.most(10);
    });
  });

  describe('sync() dual-mode behavior', function() {
    it('should delegate to multiThreadSync when initial sync not complete and threads > 0', async function() {
      const worker = createWorker({ threads: 4 });
      const mtSyncStub = sandbox.stub((worker as any).multiThreadSync, 'sync').resolves(true);

      // initialSyncComplete = false
      sandbox.stub(StateStorage, 'collection').value({
        findOne: sandbox.stub().resolves({ initialSyncComplete: [] }),
        findOneAndUpdate: sandbox.stub().resolves()
      });
      sandbox.stub(ChainStateProvider, 'getLocalTip').resolves({ height: 100 } as any);
      sandbox.stub(ChainStateProvider, 'getLocatorHashes').resolves([Array(65).join('0')]);
      sandbox.stub(worker as any, 'getHeadersForSync').resolves([]);

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      expect(mtSyncStub.calledOnce).to.equal(true);
    });

    it('should use single-thread sync when threads=0 even if initial sync not complete', async function() {
      const worker = createWorker({ threads: 0, prefetchSize: 0 });
      const mtSyncStub = sandbox.stub((worker as any).multiThreadSync, 'sync').resolves(true);

      sandbox.stub(StateStorage, 'collection').value({
        findOne: sandbox.stub().resolves({ initialSyncComplete: [] }),
        findOneAndUpdate: sandbox.stub().resolves()
      });
      sandbox.stub(ChainStateProvider, 'getLocalTip').resolves({ height: 100 } as any);
      sandbox.stub(ChainStateProvider, 'getLocatorHashes').resolves([Array(65).join('0')]);
      sandbox.stub(worker as any, 'getHeadersForSync').resolves([]);
      sandbox.stub(worker as any, 'getBlock').resolves({});
      sandbox.stub(worker as any, 'processBlock').resolves();

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      expect(mtSyncStub.called).to.equal(false);
    });

    it('should use single-thread sync when initial sync is already complete', async function() {
      const worker = createWorker({ threads: 4 });
      const mtSyncStub = sandbox.stub((worker as any).multiThreadSync, 'sync').resolves(true);

      // Set the in-memory flag directly (simulates INITIALSYNCDONE event having fired)
      (worker as any).initialSyncComplete = true;
      setupSyncStubs();

      let headerCallCount = 0;
      sandbox.stub(worker as any, 'getHeadersForSync').callsFake(async () => {
        headerCallCount++;
        return [];
      });

      (worker as any).isSyncingNode = true;
      (worker as any).isSyncing = false;
      await worker.sync();

      expect(mtSyncStub.called).to.equal(false);
    });
  });
});
