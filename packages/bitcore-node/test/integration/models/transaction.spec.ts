import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as crypto from 'crypto';
import { MongoBound } from '../../../src/models/base';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { IBtcTransaction, SpendOp, TransactionStorage } from '../../../src/models/transaction';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

async function makeMempoolTxChain(chain: string, network: string, startingTxid: string, chainLength = 1) {
  let txid = startingTxid;
  let nextTxid = crypto
    .createHash('sha256')
    .update(txid + 1)
    .digest()
    .toString('hex');
  let allTxids = new Array<string>();
  for (let i = 1; i <= chainLength; i++) {
    const badMempoolTx = {
      chain,
      network,
      blockHeight: -1,
      txid
    };
    const badMempoolOutputs = {
      chain,
      network,
      mintHeight: -1,
      mintTxid: txid,
      spentTxid: i != chainLength ? nextTxid : '',
      mintIndex: 0,
      spentHeight: -1
    };

    await TransactionStorage.collection.insertOne(badMempoolTx as IBtcTransaction);
    await CoinStorage.collection.insertOne(badMempoolOutputs as ICoin);
    allTxids.push(txid);
    txid = nextTxid;
    nextTxid = crypto
      .createHash('sha256')
      .update(txid + 1)
      .digest()
      .toString('hex');
  }
  return allTxids;
}

describe('Transaction Model', function() {
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
  });
  const chain = 'BCH';
  const network = 'integration';
  const blockTx = {
    chain,
    network,
    blockHeight: 1,
    _id: new ObjectId(),
    txid: '01234'
  };

  const blockTx2 = {
    chain,
    network,
    blockHeight: 1,
    _id: new ObjectId(),
    txid: '123456'
  };

  const blockTxOutputs = {
    chain,
    network,
    mintHeight: 1,
    mintTxid: blockTx.txid,
    _mintTx: blockTx._id,
    mintIndex: 0,
    spentHeight: -1,
    spentTxid: '12345', // to be invalidated by blockTx2
    _spentTx: blockTx2._id
  };

  const block2TxOutputs = {
    chain,
    network,
    mintHeight: 2,
    mintTxid: blockTx2.txid,
    _mintTx: blockTx2._id,
    mintIndex: 0,
    spentHeight: -1
  };

  it('should mark transactions invalid that were in the mempool, but no longer valid', async () => {
    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as MongoBound<IBtcTransaction>);
    await CoinStorage.collection.insertOne(blockTxOutputs as ICoin);

    const chainLength = 1;
    const txids = await makeMempoolTxChain(chain, network, blockTxOutputs.spentTxid, chainLength);

    const spentOps = new Array<SpendOp>();
    spentOps.push({
      updateOne: {
        filter: {
          chain,
          network,
          mintIndex: blockTxOutputs.mintIndex,
          _mintTx: blockTx._id,
          spentHeight: { $lt: 0 }
        },
        update: {
          $set: { spentHeight: block2TxOutputs.mintHeight, _spentTx: blockTx2._id, spentTxid: block2TxOutputs.mintTxid }
        }
      }
    });

    await TransactionStorage.pruneMempool({
      chain,
      network,
      initialSyncComplete: true,
      spendOps: spentOps
    });

    const badTxs = await TransactionStorage.collection.find({ chain, network, txid: { $in: txids } }).toArray();
    expect(badTxs.length).to.eq(chainLength);
    expect(badTxs.map(tx => tx.blockHeight)).to.deep.eq(new Array(chainLength).fill(SpentHeightIndicators.conflicting));

    const goodTxs = await TransactionStorage.collection.find({ chain, network, txid: blockTx.txid }).toArray();
    expect(goodTxs.length).to.eq(1);
    expect(goodTxs[0].txid).to.eq(blockTx.txid);
    expect(goodTxs[0].blockHeight).to.eq(blockTx.blockHeight);
  });

  it('should mark a chain of transactions invalid that were in the mempool, but no longer valid', async () => {
    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as MongoBound<IBtcTransaction>);
    await CoinStorage.collection.insertOne(blockTxOutputs as ICoin);
    const chainLength = 5;
    const txids = await makeMempoolTxChain(chain, network, blockTxOutputs.spentTxid, chainLength);

    const allRelatedCoins = await TransactionStorage.findAllRelatedOutputs(blockTx._id);
    expect(allRelatedCoins.length).to.eq(chainLength);

    const spentOps = new Array<SpendOp>();
    spentOps.push({
      updateOne: {
        filter: {
          chain,
          network,
          mintIndex: blockTxOutputs.mintIndex,
          _mintTx: blockTx._id,
          spentHeight: { $lt: 0 }
        },
        update: {
          $set: { spentHeight: block2TxOutputs.mintHeight, spentTxid: block2TxOutputs.mintTxid, _spentTx: blockTx2._id }
        }
      }
    });

    await TransactionStorage.pruneMempool({
      chain,
      network,
      initialSyncComplete: true,
      spendOps: spentOps
    });

    const badTxs = await TransactionStorage.collection.find({ chain, network, txid: { $in: txids } }).toArray();
    expect(badTxs.length).to.eq(chainLength);
    expect(badTxs.map(tx => tx.blockHeight)).to.deep.eq(new Array(chainLength).fill(SpentHeightIndicators.conflicting));

    const goodTxs = await TransactionStorage.collection.find({ chain, network, txid: blockTx.txid }).toArray();
    expect(goodTxs.length).to.eq(1);
    expect(goodTxs[0].txid).to.eq(blockTx.txid);
    expect(goodTxs[0].blockHeight).to.eq(blockTx.blockHeight);
  });

  it('should mark a massive chain of transactions invalid that were in the mempool, but no longer valid', async () => {
    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as MongoBound<IBtcTransaction>);
    await CoinStorage.collection.insertOne(blockTxOutputs as ICoin);
    const chainLength = 2000;
    const txids = await makeMempoolTxChain(chain, network, blockTxOutputs.spentTxid, chainLength);

    const allRelatedCoins = await TransactionStorage.findAllRelatedOutputs(blockTxOutputs._spentTx);
    expect(allRelatedCoins.length).to.eq(chainLength);

    const spentOps = new Array<SpendOp>();
    spentOps.push({
      updateOne: {
        filter: {
          chain,
          network,
          mintIndex: blockTxOutputs.mintIndex,
          _mintTx: blockTxOutputs._mintTx,
          spentHeight: { $lt: 0 }
        },
        update: {
          $set: {
            spentHeight: block2TxOutputs.mintHeight,
            spentTxid: block2TxOutputs.mintTxid,
            _spentTx: blockTxOutputs._mintTx
          }
        }
      }
    });

    await TransactionStorage.pruneMempool({
      chain,
      network,
      initialSyncComplete: true,
      spendOps: spentOps
    });

    const badTxs = await TransactionStorage.collection.find({ chain, network, txid: { $in: txids } }).toArray();
    expect(badTxs.length).to.eq(chainLength);
    expect(badTxs.map(tx => tx.blockHeight)).to.deep.eq(new Array(chainLength).fill(SpentHeightIndicators.conflicting));

    const goodTxs = await TransactionStorage.collection.find({ chain, network, txid: blockTx.txid }).toArray();
    expect(goodTxs.length).to.eq(1);
    expect(goodTxs[0].txid).to.eq(blockTx.txid);
    expect(goodTxs[0].blockHeight).to.eq(blockTx.blockHeight);
  });
});
