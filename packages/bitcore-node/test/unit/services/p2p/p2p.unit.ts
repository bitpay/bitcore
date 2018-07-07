import { expect } from 'chai';
import { Bitcoin } from '../../../../src/types/namespaces/Bitcoin';
import { TEST_BLOCK } from '../../../data/test-block';
import { TEST_TX } from '../../../data/test-tx';
import { sleep } from '../../../../src/utils/async';
import { EventEmitter } from 'events';
import { P2pRunner, StandardP2p } from '../../../../src/services/p2p';
import { IBlock, Block } from '../../../../src/models/block';
import { Transaction } from '../../../../src/models/transaction';

describe('P2P Service', () => {
  it('should write blocks from p2p', done => {
    const blocks = new EventEmitter();
    const TransactionModel = mockTransactionModel();
    const FakeBlockModel = mockBlockModel({
      addBlock: async params => {
        expect(params.block).to.deep.equal(TEST_BLOCK);
        done();
        return undefined as any;
      }
    });
    const Fakeblock = mockP2p({
      stream: blocks,
      start: async () => {
        blocks.emit('block', TEST_BLOCK);
      }
    });

    new P2pRunner('GOB', 'p-hound', FakeBlockModel, TransactionModel, Fakeblock).start();
  });

  it('should write transactions from p2p', done => {
    const transactions = new EventEmitter();
    const FakeBlockModel = mockBlockModel();
    const TransactionModel = mockTransactionModel({
      batchImport: async params => {
        expect(params.txs[0]).to.deep.equal(TEST_TX);
        expect(params.txs.length).to.equal(1);
        done();
      }
    });
    const Fakeblock = mockP2p({
      stream: transactions,
      start: async () => {
        transactions.emit('tx', TEST_TX);
      }
    });

    new P2pRunner('GOB', 'p-hound', FakeBlockModel, TransactionModel, Fakeblock).start();
  });

  it('should sync blocks in order', done => {
    const db: string[] = [];

    const blocks = new EventEmitter();
    const TransactionModel = mockTransactionModel();
    const blockHashes = Array(100)
      .fill(0)
      .map((_, i) => `${i + 1}`);
    const FakeBlockModel = mockBlockModel({
      addBlock: async params => {
        const idx = parseInt(params.block.hash);
        // simulate db taking a long time to write data
        await sleep((100 - idx) / 2);
        db.push(idx.toString());
        if (idx === 100) {
          expect(db).to.deep.equal(blockHashes);
          done();
        }
        return undefined as any;
      },
      getLocalTip: async () => {
        return { height: db.length } as IBlock;
      }
    });

    let counter = 1;
    const FakeP2p = mockP2p({
      stream: blocks,
      height: () => 100,
      getMissingBlockHashes: async () => {
        if (counter === 1) {
          counter++;
          return blockHashes;
        } else {
          return [];
        }
      },
      getBlock: async i => {
        const block = JSON.parse(JSON.stringify(TEST_BLOCK));
        block.hash = i.toString();
        return block;
      }
    });

    new P2pRunner('GOB', 'p-hound', FakeBlockModel, TransactionModel, FakeP2p).start();
  });

  it('should restart sync if new blocks have arrived', done => {
    let poolHeight = 50;
    const db: string[] = [];

    const hashes = Array(100)
      .fill(0)
      .map((_, i) => `${i + 1}`);
    const TransactionModel = mockTransactionModel();
    const FakeBlockModel = mockBlockModel({
      addBlock: async params => {
        await sleep(10);
        db.push(params.block.hash);
        if (db.length === 100) {
          expect(db).to.deep.equal(hashes);
          done();
        }
        return undefined as any;
      },
      getLocalTip: async () => {
        return { height: db.length } as IBlock;
      }
    });

    let counter = 1;
    const FakeP2p = mockP2p({
      height: () => poolHeight,
      getMissingBlockHashes: async () => {
        if (counter == 1) {
          counter++;
          return hashes.slice(0, 50);
        } else if (counter == 2) {
          counter++;
          poolHeight = 100;
          return hashes.slice(50, 100);
        } else {
          return [];
        }
      },
      getBlock: async i => {
        const block = JSON.parse(JSON.stringify(TEST_BLOCK));
        block.hash = i.toString();
        return block;
      },
      start: async () => {}
    });

    new P2pRunner('GOB', 'p-hound', FakeBlockModel, TransactionModel, FakeP2p).start();
  });

  it('should recognize the end of a slow call to sync', done => {
    const events = new EventEmitter();
    const db: Bitcoin.Block[] = [];
    const blocks = new EventEmitter();
    const TransactionModel = mockTransactionModel();
    const FakeBlockModel = mockBlockModel({
      addBlock: async params => {
        db.push(params.block);
        return undefined as any;
      },
      getLocalTip: async () => {
        return { height: db.length } as IBlock;
      }
    });
    const Fakeblock = Object.assign(
      {
        set syncing(dosync) {
          if (dosync === false && db.length > 0) {
            expect(db).to.deep.equal([TEST_BLOCK]);
            done();
          }
        },
        get syncing() {
          return true;
        }
      },
      mockP2p({
        stream: blocks,
        start: async () => {
          blocks.emit('block', TEST_BLOCK);
          await sleep(100);
          events.emit('sent-block', {});
        },
        height: () => 1
      })
    );

    new P2pRunner('GOB', 'p-hound', FakeBlockModel, TransactionModel, Fakeblock).start();
  });
});

function mockP2p(extra?: Partial<StandardP2p>): StandardP2p {
  return Object.assign(
    {
      stream: new EventEmitter(),
      start: async () => {},
      height: () => 0,
      parent: () => undefined,
      stop: async () => {},
      syncing: false,
      getMissingBlockHashes: () => Promise.resolve([]),
      getBlock: i => Promise.resolve(i)
    },
    extra ? extra : {}
  );
}

function mockTransactionModel(extra?: Partial<Transaction>): Transaction {
  return Object.assign(
    ({
      batchImport: async () => {}
    } as any) as Transaction,
    extra ? extra : {}
  );
}

function mockBlockModel(extra?: Partial<Block>): Block {
  return Object.assign(
    ({
      handleReorg: async () => {},
      addBlock: async () => {},
      getLocalTip: async () => {
        return {
          height: 0
        } as IBlock;
      },
      getLocatorHashes: async () => []
    } as any) as Block,
    extra ? extra : {}
  );
}
