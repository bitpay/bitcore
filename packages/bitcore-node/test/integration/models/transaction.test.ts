import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as crypto from 'crypto';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { IBtcTransaction, SpendOp, TransactionStorage } from '../../../src/models/transaction';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import { unprocessedEthBlocks } from '../../data/ETH/unprocessedBlocksETH';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Transaction Model', function() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);

  async function makeMempoolTxChain(chain: string, network: string, startingTxid: string, chainLength = 1) {
    let txid = startingTxid;
    let nextTxid = crypto
      .createHash('sha256')
      .update(txid + 1)
      .digest()
      .toString('hex');
    const allTxids = new Array<string>();
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

  it('should mark transactions invalid that were in the mempool, but no longer valid', async () => {
    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as IBtcTransaction);
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
  });

  it('should mark a chain of transactions invalid that were in the mempool, but no longer valid', async () => {
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
    // the replaced tx is marked as conflicting, all the rest still pending to be cleaned up by pruning service
    expect(badTxs[0].blockHeight).to.eq(SpentHeightIndicators.conflicting);
    expect(badTxs[0].replacedByTxid).to.exist;
    expect(badTxs.slice(1).every(tx => tx.blockHeight === SpentHeightIndicators.pending)).to.equal(true);

    const goodTxs = await TransactionStorage.collection.find({ chain, network, txid: blockTx.txid }).toArray();
    expect(goodTxs.length).to.eq(1);
    expect(goodTxs[0].txid).to.eq(blockTx.txid);
    expect(goodTxs[0].blockHeight).to.eq(blockTx.blockHeight);
  });

  // skipping because it's the same test as the previous one with the pruning service invalidating the massive chain
  it.skip('should mark a massive chain of transactions invalid that were in the mempool, but no longer valid', async () => {
    // insert a valid tx, with a valid output
    await TransactionStorage.collection.insertOne(blockTx as IBtcTransaction);
    await CoinStorage.collection.insertOne(blockTxOutputs as ICoin);
    const chainLength = 2000;
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
  });

  describe('#batchImport', () => {
    const chain = 'ETH';
    const network = 'regtest';

    const wallet = new ObjectId();
    const address = '0x3Ec3dA6E14BE9518A9a6e92DdCC6ACfF2CEFf4ef';
    
    beforeEach(async () => {
      await WalletAddressStorage.collection.insertOne({
        chain,
        network,
        wallet,
        address,
        processed: true
      });
    });

    it('should update eth transactions with related wallet id correctly (incoming)', async () => {
      const block = unprocessedEthBlocks[0] as any; // block containing an eth transfer to 0x3Ec3dA6E14BE9518A9a6e92DdCC6ACfF2CEFf4ef
      await EVMTransactionStorage.batchImport({ ...block });
      const walletTxs = await EVMTransactionStorage.collection.find({ chain, network, wallets: wallet }).toArray();
      expect(walletTxs.length).eq(1);
    });

    it('should update erc20 transactions with related wallet id correctly (incoming)', async () => {
      const block = unprocessedEthBlocks[1] as any; // block containing an ERC20 transfer to 0x3Ec3dA6E14BE9518A9a6e92DdCC6ACfF2CEFf4ef
      await EVMTransactionStorage.batchImport({ ...block });
      const walletTxs = await EVMTransactionStorage.collection.find({ chain, network, wallets: wallet }).toArray();
      expect(walletTxs.length).eq(1);
    });
  });

  describe('#pruneMempool (EVM)', () => {
    const chain = 'ETH';
    const network = 'regtest';
    const from = '0x3Ec3dA6E14BE9518A9a6e92DdCC6ACfF2CEFf4ef';

    const mempoolTx = (txid: string, nonce: number) =>
      ({ chain, network, txid, from, nonce, blockHeight: SpentHeightIndicators.pending }) as any;

    // pruneMempool writes with w:0, so the update can land after the call returns
    async function waitForBlockHeight(txid: string, blockHeight: number) {
      for (let i = 0; i < 50; i++) {
        const tx = await EVMTransactionStorage.collection.findOne({ chain, network, txid });
        if (tx?.blockHeight === blockHeight) {
          return tx;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      return EVMTransactionStorage.collection.findOne({ chain, network, txid });
    }

    beforeEach(async () => {
      await EVMTransactionStorage.collection.insertMany([
        mempoolTx('replaced', 7),
        mempoolTx('other-nonce', 8)
      ]);
    });

    it('should mark a pending tx with the same sender and nonce as conflicting', async () => {
      await EVMTransactionStorage.pruneMempool({
        chain,
        network,
        height: 100,
        initialSyncComplete: true,
        txs: [{ txid: 'mined', from, nonce: 7 } as any]
      });

      const replaced = await waitForBlockHeight('replaced', SpentHeightIndicators.conflicting);
      expect(replaced!.blockHeight).to.eq(SpentHeightIndicators.conflicting);
      expect(replaced!.replacedByTxid).to.eq('mined');

      const otherNonce = await EVMTransactionStorage.collection.findOne({ chain, network, txid: 'other-nonce' });
      expect(otherNonce!.blockHeight).to.eq(SpentHeightIndicators.pending);
      expect(otherNonce!.replacedByTxid).to.not.exist;
    });

    it('should not touch the mempool before initial sync is complete', async () => {
      await EVMTransactionStorage.pruneMempool({
        chain,
        network,
        height: 100,
        initialSyncComplete: false,
        txs: [{ txid: 'mined', from, nonce: 7 } as any]
      });

      const replaced = await EVMTransactionStorage.collection.findOne({ chain, network, txid: 'replaced' });
      expect(replaced!.blockHeight).to.eq(SpentHeightIndicators.pending);
    });
  });

});
