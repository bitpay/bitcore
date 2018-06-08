import { expect } from 'chai';
import { Subject } from 'rxjs';
import { ITransactionModel } from '../../../../src/models/transaction';
import { TEST_BLOCK } from '../../../data/test-block';
import { IBlockModel } from '../../../../src/models/block';
import { TEST_TX } from '../../../data/test-tx';
import { sleep } from '../../../../src/utils/async';
import { EventEmitter } from 'events';
import { P2pRunner, StandardP2p } from '../../../../src/services/p2p';
import { AdapterProvider } from '../../../../src/providers/adapter';
import { CoreBlock, CoreTransaction } from '../../../../src/types/namespaces/ChainAdapter';

const TEST_CORE_BLOCK = AdapterProvider.get({ chain: 'BTC' }).convertBlock({
  chain: 'BTC',
  network: 'testnet',
}, TEST_BLOCK);

const TEST_CORE_TX = AdapterProvider.get({ chain: 'BTC' }).convertTx({
  chain: 'BTC',
  network: 'testnet',
}, TEST_TX, TEST_BLOCK);

describe('P2P Service', () => {
  it('should write blocks from p2p', done => {
    const blocks: Subject<CoreBlock> = new Subject();
    const TransactionModel = mockTransactionModel();
    const BlockModel = mockBlockModel({
      addBlock: async block => {
        expect(block).to.deep.equal(TEST_CORE_BLOCK);
        done();
        return undefined as any;
      }
    });
    const Fakeblock = mockP2p({
      blocks: () => blocks,
      start: async () => {
        blocks.next(TEST_CORE_BLOCK);
      }
    });

    new P2pRunner('GOB', 'p-hound', BlockModel, TransactionModel, Fakeblock).start();
  });

  it('should write transactions from p2p', done => {
    const transactions: Subject<CoreTransaction> = new Subject();
    const BlockModel = mockBlockModel();
    const TransactionModel = mockTransactionModel({
      batchImport: async (txs, _) => {
        expect(txs[0]).to.deep.equal(TEST_CORE_TX);
        expect(txs.length).to.equal(1);
        done();
      },
    });
    const Fakeblock = mockP2p({
      transactions: () => transactions,
      start: async () => {
        transactions.next(TEST_CORE_TX);
      },
    });

    new P2pRunner('GOB', 'p-hound', BlockModel, TransactionModel, Fakeblock).start();
  });

  it('should sync blocks in order', done => {
    const db: number[] = [];

    const blocks: Subject<CoreBlock> = new Subject();
    const TransactionModel = mockTransactionModel();
    const BlockModel = mockBlockModel({
      addBlock: async block => {
        const idx = parseInt(block.header.hash);
        // simulate db taking a long time to write data
        await sleep((100 - idx)/2);
        db.push(idx);
        if (idx === 100) {
          expect(db).to.deep.equal(Array(100).fill(0).map((_, i) => i + 1));
          done();
        }
        return undefined as any;
      },
      getLocalTip: async () => {
        return { height: db.length } as IBlockModel;
      },
    });
    const Fakeblock = mockP2p({
      blocks: () => blocks,
      height: () => 100,
      sync: async () => {
        for (let i = 1; i <= 100; i += 1) {
          const block = JSON.parse(JSON.stringify(TEST_CORE_BLOCK));
          block.header.hash = i.toString();
          blocks.next(block);
        }
        return "100";
      },
    });

    new P2pRunner('GOB', 'p-hound', BlockModel, TransactionModel, Fakeblock).start();
  });

  it('should restart sync if new blocks have arrived', done => {
    let poolHeight = 50;
    const db: number[] = [];

    const blocks: Subject<CoreBlock> = new Subject();
    const TransactionModel = mockTransactionModel();
    const BlockModel = mockBlockModel({
      addBlock: async block => {
        db.push(parseInt(block.header.hash));
        if (db.length === 100) {
          expect(db).to.deep.equal(Array(100).fill(0).map((_, i) => i + 1));
          done();
        }
        return undefined as any;
      },
      getLocalTip: async () => {
        return { height: db.length } as IBlockModel;
      },
    });
    const Fakeblock = mockP2p({
      blocks: () => blocks,
      height: () => {
        return poolHeight;
      },
      sync: async () => {
        const start = poolHeight === 50 ? 1 : 51;
        const end = poolHeight;
        for (let i = start; i <= end; i += 1) {
          const block = JSON.parse(JSON.stringify(TEST_CORE_BLOCK));
          block.header.hash = i.toString();
          blocks.next(block);
          await sleep(10);
          if (poolHeight === 50 && i === 25) {
            poolHeight = 100;
          }
        }
        return end.toString();
      },
    });

    new P2pRunner('GOB', 'p-hound', BlockModel, TransactionModel, Fakeblock).start();
  });

  it('should recognize the end of a slow call to sync', done => {
    const events = new EventEmitter();
    const db: CoreBlock[] = [];
    const blocks: Subject<CoreBlock> = new Subject();
    const TransactionModel = mockTransactionModel();
    const BlockModel = mockBlockModel({
      addBlock: async block => {
        db.push(block);
        return undefined as any;
      },
      getLocalTip: async () => {
        return { height: db.length } as IBlockModel;
      },
    });
    const Fakeblock = Object.assign({
      set syncing(dosync) {
        if (dosync === false && db.length > 0) {
          expect(db).to.deep.equal([TEST_CORE_BLOCK]);
          done();
        }
      },
      get syncing() {
        return true;
      }
    }, mockP2p({
      blocks: () => blocks,
      start: async () => {
        blocks.next(TEST_CORE_BLOCK);
        await sleep(100);
        events.emit('sent-block', {});
      },
      height: () => 1,
      sync: () => new Promise(resolve => {
        events.on('sent-block', () => {
          resolve(TEST_CORE_BLOCK.header.hash);
        });
      }),
    }));

    new P2pRunner('GOB', 'p-hound', BlockModel, TransactionModel, Fakeblock).start();
  });
});

function mockP2p(extra?: Partial<StandardP2p>): StandardP2p {
  return Object.assign({
    blocks: () => new Subject(),
    transactions: () => new Subject(),
    start: async () => {},
    sync: async () => undefined,
    height: () => 0,
    parent: () => undefined,
    stop: async () => {},
    syncing: false,
  }, extra? extra : {});
}

function mockTransactionModel(extra?: Partial<ITransactionModel>): ITransactionModel {
  return Object.assign({
    batchImport: async () => {},
  } as any as ITransactionModel, extra? extra : {});
}

function mockBlockModel(extra?: Partial<IBlockModel>): IBlockModel {
  return Object.assign({
    addBlock: async () => {},
    getLocalTip: async () => {
      return {
        height: 0,
      } as IBlockModel;
    },
    getLocatorHashes: async () => [],
  } as any as IBlockModel, extra? extra : {});
}
