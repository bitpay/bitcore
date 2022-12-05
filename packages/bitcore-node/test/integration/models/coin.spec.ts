import { expect } from 'chai';
import * as crypto from 'crypto';
import { BitcoreLib } from 'crypto-wallet-core';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { IBtcTransaction, SpendOp, TransactionStorage } from '../../../src/models/transaction';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

function createNewTxid() {
  const seed = (Math.random() * 10000).toString();
  return crypto
    .createHash('sha256')
    .update(seed + 1)
    .digest()
    .toString('hex');
}

async function addTx(tx: IBtcTransaction, outputs: ICoin[]) {
  await TransactionStorage.collection.insertOne(tx as IBtcTransaction);
  await CoinStorage.collection.insertMany(outputs as ICoin[]);
}

async function makeMempoolTxChain(chain: string, network: string, startingTxid: string, chainLength = 1) {
  let txid = startingTxid;
  let nextTxid = createNewTxid();
  let allTxids = new Array<string>();
  for (let i = 1; i <= chainLength; i++) {
    const badMempoolTx = {
      chain,
      network,
      blockHeight: -1,
      txid
    };
    const badMempoolOutputs = [
      {
        chain,
        network,
        mintHeight: -1,
        mintTxid: txid,
        spentTxid: i != chainLength ? nextTxid : '',
        mintIndex: 0,
        spentHeight: -1
      }
    ];
    await addTx(badMempoolTx as IBtcTransaction, badMempoolOutputs as ICoin[]);
    allTxids.push(txid);
    txid = nextTxid;
    nextTxid = createNewTxid();
  }
  return allTxids;
}

describe('Coin Model', function() {
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
  });
  const chain = 'BTC';
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
  const block2TxOutputs = {
    chain,
    network,
    mintHeight: 2,
    mintTxid: '123456',
    mintIndex: 0,
    spentHeight: -1
  };

  it('should appropriately mark coins related to transactions that are in mempool, but no longer valid', async () => {
    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as IBtcTransaction);
    await CoinStorage.collection.insertOne(blockTxOutputs as ICoin);
    const chainLength = 5;
    const txids = await makeMempoolTxChain(chain, network, blockTxOutputs.spentTxid, chainLength);

    const allRelatedCoins = await TransactionStorage.findAllRelatedOutputs(blockTxOutputs.spentTxid);
    expect(allRelatedCoins.length).to.eq(chainLength);

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

    const badTxs = await TransactionStorage.collection.find({ chain, network, txid: { $in: txids } }).toArray();
    expect(badTxs.length).to.eq(chainLength);
    expect(badTxs.map(tx => tx.blockHeight)).to.deep.eq(new Array(chainLength).fill(SpentHeightIndicators.conflicting));

    const goodTxs = await TransactionStorage.collection.find({ chain, network, txid: blockTx.txid }).toArray();
    expect(goodTxs.length).to.eq(1);
    expect(goodTxs[0].txid).to.eq(blockTx.txid);
    expect(goodTxs[0].blockHeight).to.eq(blockTx.blockHeight);

    // Coins
    const badNewCoins = await CoinStorage.collection.find({ chain, network, mintTxid: { $in: txids } }).toArray();
    expect(badNewCoins.length).to.equal(badNewCoins.filter(c => c.spentHeight == SpentHeightIndicators.pending).length);

    const goodNewCoins = await CoinStorage.collection.find({ chain, network, mintTxid: blockTx.txid }).toArray();
    expect(goodNewCoins.length).to.equal(
      goodNewCoins.filter(c => c.spentHeight == SpentHeightIndicators.unspent).length
    );
  });

  it('should appropriately mark coins related to transactions that are RBFed', async () => {
    const privateKey = new BitcoreLib.PrivateKey('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy');

    const utxo1 = {
      txId: createNewTxid(),
      outputIndex: 0,
      address: '17XBj6iFEsf8kzDMGQk5ghZipxX49VXuaV',
      script: '76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac',
      satoshis: 50000
    };

    // create tx with mutliple outputs
    const tx1 = new BitcoreLib.Transaction()
      .from(utxo1)
      .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 15000)
      .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 13000)
      .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 11000)
      .sign(privateKey);

    // import transaction in block 1
    await TransactionStorage.batchImport({
      txs: [tx1],
      height: 1,
      initialSyncComplete: true,
      chain: 'BTC',
      network: 'integration'
    });

    // insert mempool tx using all outputs from last tx
    const mempoolTxid = createNewTxid();
    const mempoolTx = {
      chain,
      network,
      blockHeight: -1, // pending
      txid: mempoolTxid
    } as IBtcTransaction;
    const mempoolOutputs = Array.from({ length: 3 }, (_v, i) => i).map(i => {
      return {
        chain,
        network,
        mintHeight: -1,
        mintTxid: mempoolTxid,
        mintIndex: i,
        spentHeight: SpentHeightIndicators.unspent
      } as ICoin;
    });
    await addTx(mempoolTx, mempoolOutputs);
    
    // update existing outputs to be spent by mempool tx
    await CoinStorage.collection.updateMany(
      { chain, network, mintTxid: tx1.hash },
      { $set: { spentTxid: mempoolTxid, spentHeight: SpentHeightIndicators.pending } }
    );

    // create new tx that uses one of the inputs
    const utxo2 = [
      {
        txId: tx1.hash,
        outputIndex: 0,
        address: '1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK',
        script: '76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac',
        satoshis: 15000
      }
    ];
    const tx2 = new BitcoreLib.Transaction()
      .from(utxo2)
      .to('bc1qm0jxvjvj6pzcc64lu4k7vccsg2x22pj60zke6c', 15000)
      .sign(privateKey);

    // import transaction in block 2
    await TransactionStorage.batchImport({
      txs: [tx2],
      height: 2,
      initialSyncComplete: true,
      chain: 'BTC',
      network: 'integration'
    });

    const tx1Outputs = await CoinStorage.collection.find({ chain, network, mintTxid: tx1.hash }).toArray();

    const spentCoin = tx1Outputs.find(c => c.spentTxid === tx2.hash && c.spentHeight === 2);
    expect(spentCoin).to.exist;

    const unspentCoins = tx1Outputs.filter(c => c.spentHeight < SpentHeightIndicators.minimum);
    expect(unspentCoins.length).to.equal(2);
    expect(unspentCoins.filter(c => c.spentHeight === SpentHeightIndicators.unspent && !c.spentTxid).length).to.equal(2);

    const mempoolCoins = await CoinStorage.collection.find({ chain, network, mintTxid: mempoolTxid }).toArray();
    expect(mempoolCoins.length).to.equal(3);
    expect(mempoolCoins.filter(c => c.mintHeight === SpentHeightIndicators.conflicting).length).to.equal(3);
  });
});
