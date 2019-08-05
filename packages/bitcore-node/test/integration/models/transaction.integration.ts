import { expect } from 'chai';
import { resetDatabase } from '../../helpers';
import { TransactionStorage, SpendOp, IBtcTransaction } from '../../../src/models/transaction';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { SpentHeightIndicators } from '../../../src/types/Coin';

describe('Transaction Model', function() {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('should mark transactions invalid that were in the mempool, but no longer valid', async () => {
    const chain = 'BCH';
    const network = 'integration';
    const blockTx = {
      chain,
      network,
      blockHeight: 1,
      txid: '01234'
    };
    const blockTxOutputs = {
      chain,
      network,
      mintHeight: 1,
      mintTxid: '01234',
      mintIndex: 0,
      spentHeight: -1,
      spentTxid: '12345'
    };

    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as IBtcTransaction);
    await CoinStorage.collection.insertOne(blockTxOutputs as ICoin);

    const badMempoolTx = {
      chain,
      network,
      blockHeight: -1,
      txid: '12345'
    };
    const badMempoolOutputs = {
      chain,
      network,
      mintHeight: -1,
      mintTxid: '12345',
      mintIndex: 0,
      spentHeight: -1
    };

    // insert a valid mempool tx, with a valid output, which will be marked invalid by block2 tx
    await TransactionStorage.collection.insertOne(badMempoolTx as IBtcTransaction);
    await CoinStorage.collection.insertOne(badMempoolOutputs as ICoin);

    const block2TxOutputs = {
      chain,
      network,
      mintHeight: 2,
      mintTxid: '123456',
      mintIndex: 0,
      spentHeight: -1
    };

    const spentOps = new Array<SpendOp>();

    spentOps.push({
      updateOne: {
        filter: {
          chain,
          network,
          mintIndex: blockTxOutputs.mintIndex,
          mintTxid: blockTxOutputs.mintTxid,
          spentHeight: { $lt: 0 }
        },
        update: { $set: { spentHeight: block2TxOutputs.mintHeight, spentTxid: block2TxOutputs.mintTxid } }
      }
    });

    await TransactionStorage.pruneMempool({
      chain,
      network,
      initialSyncComplete: true,
      spendOps: spentOps
    });

    const badTxs = await TransactionStorage.collection.find({ chain, network, txid: badMempoolTx.txid }).toArray();
    expect(badTxs.length).to.eq(1);
    expect(badTxs[0].txid).to.eq(badMempoolTx.txid);
    expect(badTxs[0].blockHeight).to.eq(SpentHeightIndicators.conflicting);

    const goodTxs = await TransactionStorage.collection.find({ chain, network, txid: blockTx.txid }).toArray();
    expect(goodTxs.length).to.eq(1);
    expect(goodTxs[0].txid).to.eq(blockTx.txid);
    expect(goodTxs[0].blockHeight).to.eq(blockTx.blockHeight);
  });
});
