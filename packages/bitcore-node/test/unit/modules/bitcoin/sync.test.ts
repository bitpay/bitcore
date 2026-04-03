import { expect } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { UtxoMultiThreadSync } from '../../../../src/modules/bitcoin/sync';
import { unitBeforeHelper, unitAfterHelper } from '../../../helpers/unit';

describe('UtxoMultiThreadSync', function() {
  const sandbox = sinon.createSandbox();
  const chain = 'BTC';
  const network = 'regtest';

  before(unitBeforeHelper);
  after(unitAfterHelper);
  afterEach(() => sandbox.restore());

  function createSync(overrides: any = {}) {
    const processOrder: string[] = [];
    const config = {
      rpc: { host: 'localhost', port: 8332, username: 'test', password: 'test' },
      threads: 2,
      ...overrides
    };
    const callbacks = {
      getHeaders: sandbox.stub().resolves([]),
      processBlock: sandbox.stub().callsFake(async (block: any) => {
        processOrder.push(block.hash || 'unknown');
        await new Promise(r => setTimeout(r, 5));
      }),
      getLocalTip: sandbox.stub().resolves({ height: 100 }),
      deserializeBlock: sandbox.stub().callsFake((rawHex: string) => ({
        hash: rawHex.substring(0, 8),
        header: { toObject: () => ({ hash: rawHex.substring(0, 8), prevHash: '', time: Date.now() / 1000 }) },
        transactions: []
      }))
    };

    const sync = new UtxoMultiThreadSync({ chain, network, config, callbacks });
    return { sync, callbacks, processOrder };
  }

  describe('ordered block processing', function() {
    it('should process blocks in height order even when received out of order', async function() {
      const { sync, callbacks, processOrder } = createSync();

      const headers = [
        { hash: 'aaa' },
        { hash: 'bbb' },
        { hash: 'ccc' }
      ];

      let headerCallCount = 0;
      callbacks.getHeaders.callsFake(async () => {
        headerCallCount++;
        return headerCallCount === 1 ? headers : [];
      });

      // Mock worker threads: override getWorkerThread to create fake threads
      const fakeThreads: EventEmitter[] = [];
      sandbox.stub(sync as any, 'getWorkerThread').callsFake(() => {
        const fakeThread = new EventEmitter();
        (fakeThread as any).threadId = fakeThreads.length + 1;
        (fakeThread as any).postMessage = sandbox.stub().callsFake((msg: any) => {
          if (msg.message === 'start') {
            setTimeout(() => fakeThread.emit('message', { message: 'ready' }), 5);
          } else if (msg.message === 'shutdown') {
            // no-op
          } else {
            // Simulate fetching with varying delay — blocks arrive out of order
            const delay = msg.hash === 'aaa' ? 60 : msg.hash === 'bbb' ? 10 : 30;
            setTimeout(() => {
              fakeThread.emit('message', {
                message: 'sync',
                hash: msg.hash,
                height: msg.height,
                rawBlock: msg.hash + '00000000', // fake raw hex
                threadId: (fakeThread as any).threadId
              });
            }, delay);
          }
        });
        fakeThreads.push(fakeThread);
        return fakeThread;
      });

      await sync.sync();

      // Even though bbb (height 102) arrives first and ccc (103) arrives second,
      // processing should be in order: aaa (101), bbb (102), ccc (103)
      expect(processOrder).to.deep.equal(['aaa00000', 'bbb00000', 'ccc00000']);
    });
  });

  describe('thread management', function() {
    it('should initialize the configured number of threads', async function() {
      const { sync, callbacks } = createSync({ threads: 3 });

      callbacks.getHeaders.resolves([]);

      const threads: any[] = [];
      sandbox.stub(sync as any, 'getWorkerThread').callsFake(() => {
        const fakeThread = new EventEmitter();
        (fakeThread as any).threadId = threads.length + 1;
        (fakeThread as any).postMessage = sandbox.stub().callsFake((msg: any) => {
          if (msg.message === 'start') {
            setTimeout(() => fakeThread.emit('message', { message: 'ready' }), 5);
          }
        });
        threads.push(fakeThread);
        return fakeThread;
      });

      await sync.sync();

      expect(threads.length).to.equal(3);
    });

    it('should emit INITIALSYNCDONE when sync completes', async function() {
      const { sync, callbacks } = createSync();
      let syncDone = false;
      sync.once('INITIALSYNCDONE', () => { syncDone = true; });

      callbacks.getHeaders.resolves([]);

      sandbox.stub(sync as any, 'getWorkerThread').callsFake(() => {
        const fakeThread = new EventEmitter();
        (fakeThread as any).threadId = 1;
        (fakeThread as any).postMessage = sandbox.stub().callsFake((msg: any) => {
          if (msg.message === 'start') {
            setTimeout(() => fakeThread.emit('message', { message: 'ready' }), 5);
          }
        });
        return fakeThread;
      });

      await sync.sync();

      expect(syncDone).to.equal(true);
    });
  });
});
