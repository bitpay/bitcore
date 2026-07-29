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

    describe('erc20Effects persistence ownership', () => {
      const height = 300;
      const blockHash = `0x${'12'.repeat(32)}`;
      const from = `0x${'23'.repeat(20)}`;
      const to = `0x${'34'.repeat(20)}`;
      const canonicalFrom = `0x${'45'.repeat(20)}`;
      const canonicalTo = `0x${'56'.repeat(20)}`;
      const token = `0x${'67'.repeat(20)}`;
      const time = new Date('2026-07-02T00:00:00.000Z');

      function transaction(txid: string, overrides: Record<string, any> = {}) {
        return {
          chain,
          network,
          txid,
          blockHeight: height,
          blockHash,
          blockTime: time,
          blockTimeNormalized: time,
          fee: 1,
          value: 0,
          wallets: [],
          gasLimit: 21000,
          gasPrice: 1,
          nonce: 1,
          transactionIndex: 0,
          to,
          from,
          data: '0x',
          internal: [],
          calls: [],
          effects: [],
          ...overrides
        };
      }

      function materialization(version: number, amount: string) {
        return {
          blockHash,
          version,
          items: [{
            type: 'ERC20:transfer',
            from: canonicalFrom,
            to: canonicalTo,
            amount,
            contractAddress: token,
            logIndex: 1,
            callStack: 'log:1'
          }]
        };
      }

      it('preserves an already stored newer generation while updating fields and canonical wallets', async () => {
        const txid = `0x${'78'.repeat(32)}`;
        const canonicalWallet = new ObjectId();
        const version1 = materialization(1, '10');
        const version2 = materialization(2, '20');
        await WalletAddressStorage.collection.insertOne({
          chain,
          network,
          wallet: canonicalWallet,
          address: canonicalTo,
          processed: true
        });
        await EVMTransactionStorage.collection.insertOne(transaction(txid, { erc20Effects: version2 }) as any);

        await EVMTransactionStorage.batchImport({
          txs: [transaction(txid, { fee: 99, erc20Effects: version1 }) as any],
          height,
          blockHash,
          blockTime: time,
          blockTimeNormalized: time,
          chain,
          network,
          initialSyncComplete: false
        });

        const stored = await EVMTransactionStorage.collection.findOne({ chain, network, txid });
        expect(stored!.fee).to.equal(99);
        expect(stored!.erc20Effects).to.deep.equal(version2);
        expect(stored!.wallets.map(walletId => walletId.toString())).to.deep.equal([canonicalWallet.toString()]);
      });

      it('preserves canonical wallet ownership only on rows that already own erc20Effects', async () => {
        const materializedTxid = `0x${'89'.repeat(32)}`;
        const unmaterializedTxid = `0x${'9a'.repeat(32)}`;
        const canonicalWallet = new ObjectId();
        const replacedWallet = new ObjectId();
        const masterWallet = new ObjectId();
        const storedMaterialization = materialization(1, '10');
        await WalletAddressStorage.collection.insertOne({ chain, network, wallet: masterWallet, address: from, processed: true });
        await EVMTransactionStorage.collection.insertMany([
          transaction(materializedTxid, { wallets: [canonicalWallet], erc20Effects: storedMaterialization }),
          transaction(unmaterializedTxid, { wallets: [replacedWallet], transactionIndex: 1 })
        ] as any);

        await EVMTransactionStorage.batchImport({
          txs: [
            transaction(materializedTxid, { fee: 10, erc20Effects: undefined }) as any,
            transaction(unmaterializedTxid, { fee: 20, transactionIndex: 1, erc20Effects: undefined }) as any
          ],
          height,
          blockHash,
          blockTime: time,
          blockTimeNormalized: time,
          chain,
          network,
          initialSyncComplete: false
        });

        const materialized = await EVMTransactionStorage.collection.findOne({ chain, network, txid: materializedTxid });
        const unmaterialized = await EVMTransactionStorage.collection.findOne({ chain, network, txid: unmaterializedTxid });
        expect(materialized!.erc20Effects).to.deep.equal(storedMaterialization);
        expect(materialized!.wallets.map(walletId => walletId.toString()).sort()).to.deep.equal(
          [canonicalWallet.toString(), masterWallet.toString()].sort()
        );
        expect(unmaterialized).not.to.have.property('erc20Effects');
        expect(unmaterialized!.wallets.map(walletId => walletId.toString())).to.deep.equal([masterWallet.toString()]);
      });
    });

    describe('pre-fork materialized parent copies', () => {
      const parentChain = 'ETH';
      const childChain = 'ARB';
      const height = 100;
      const forkHeight = 200;
      const childTxid = `0x${'ab'.repeat(32)}`;
      const parentTxid = `0x${childTxid.slice(2).toUpperCase()}`;
      const blockHash = `0x${'22'.repeat(32)}`;
      const parentFrom = `0x${'33'.repeat(20)}`;
      const parentTo = `0x${'44'.repeat(20)}`;
      const canonicalFrom = `0x${'55'.repeat(20)}`;
      const canonicalTo = `0x${'66'.repeat(20)}`;
      const token = `0x${'77'.repeat(20)}`;
      const time = new Date('2026-07-01T00:00:00.000Z');

      const canonicalWallet = new ObjectId();

      function parentTransaction(wallets: ObjectId[] = []) {
        return {
          chain: parentChain,
          network,
          txid: parentTxid,
          blockHeight: height,
          blockHash,
          blockTime: time,
          blockTimeNormalized: time,
          fee: 1,
          value: 0,
          wallets,
          gasLimit: 21000,
          gasPrice: 1,
          nonce: 1,
          transactionIndex: 0,
          to: parentTo,
          from: parentFrom,
          data: '0x',
          internal: [],
          calls: [],
          effects: []
        };
      }

      function preparedChildTransaction() {
        return {
          ...parentTransaction(),
          chain: childChain,
          txid: childTxid,
          erc20Effects: {
            blockHash,
            version: 1,
            items: [{
              type: 'ERC20:transfer',
              from: canonicalFrom,
              to: canonicalTo,
              amount: '10',
              contractAddress: token,
              logIndex: 1,
              callStack: 'log:1'
            }]
          }
        };
      }

      beforeEach(async () => {
        await WalletAddressStorage.collection.insertOne({
          chain: childChain,
          network,
          wallet: canonicalWallet,
          address: canonicalTo,
          processed: true
        });
      });

      it('inserts a distinct child row without copying the parent Mongo identity or route', async () => {
        const parentInsert = await EVMTransactionStorage.collection.insertOne(parentTransaction() as any);
        const preparedTx = preparedChildTransaction();

        await EVMTransactionStorage.batchImport({
          txs: [preparedTx as any],
          height,
          blockTime: time,
          blockHash,
          blockTimeNormalized: time,
          parentChain,
          forkHeight,
          chain: childChain,
          network,
          initialSyncComplete: false
        });

        const parent = await EVMTransactionStorage.collection.findOne({ _id: parentInsert.insertedId });
        const child = await EVMTransactionStorage.collection.findOne({ txid: childTxid, chain: childChain, network });

        expect(parent).to.exist;
        expect(parent).not.to.have.property('erc20Effects');
        expect(child).to.exist;
        expect(child!._id!.toString()).not.to.equal(parentInsert.insertedId.toString());
        expect(child!.chain).to.equal(childChain);
        expect(child!.network).to.equal(network);
        expect(child!.txid).to.equal(childTxid);
        expect(child!.from).to.equal(parentFrom);
        expect(child!.erc20Effects).to.deep.equal(preparedTx.erc20Effects);
        expect(child!.wallets.map(walletId => walletId.toString())).to.deep.equal([canonicalWallet.toString()]);
      });


      it('updates a materialized child from an omitted-field pre-fork write without replacing its identity', async () => {
        const masterWallet = new ObjectId();
        await WalletAddressStorage.collection.insertOne({
          chain: childChain,
          network,
          wallet: masterWallet,
          address: parentTo,
          processed: true
        });
        const parentInsert = await EVMTransactionStorage.collection.insertOne(parentTransaction() as any);
        const preparedTx = preparedChildTransaction();
        await EVMTransactionStorage.batchImport({
          txs: [preparedTx as any],
          height,
          blockTime: time,
          blockHash,
          blockTimeNormalized: time,
          parentChain,
          forkHeight,
          chain: childChain,
          network,
          initialSyncComplete: false
        });
        const originalChild = await EVMTransactionStorage.collection.findOne({ txid: childTxid, chain: childChain, network });
        await EVMTransactionStorage.collection.updateOne({ _id: parentInsert.insertedId }, { $set: { fee: 9 } });
        const omittedTx: any = preparedChildTransaction();
        delete omittedTx.erc20Effects;

        await EVMTransactionStorage.batchImport({
          txs: [omittedTx],
          height,
          blockTime: time,
          blockHash,
          blockTimeNormalized: time,
          parentChain,
          forkHeight,
          chain: childChain,
          network,
          initialSyncComplete: false
        });

        const children = await EVMTransactionStorage.collection.find({
          chain: childChain,
          network,
          txid: { $in: [parentTxid, childTxid] }
        }).toArray();
        const child = children[0];
        expect(children).to.have.length(1);
        expect(child!._id!.toString()).to.equal(originalChild!._id!.toString());
        expect(child!.chain).to.equal(childChain);
        expect(child!.network).to.equal(network);
        expect(child!.txid).to.equal(childTxid);
        expect(child!.erc20Effects).to.deep.equal(originalChild!.erc20Effects);
        expect(child!.wallets.map(walletId => walletId.toString()).sort()).to.deep.equal(
          [canonicalWallet.toString(), masterWallet.toString()].sort()
        );
        expect(child!.fee).to.equal(9);
      });

      it('preserves an existing child identity, wallet, and newer materialization while adding the canonical wallet', async () => {
        const existingWallet = new ObjectId();
        const futureErc20Effects = {
          ...preparedChildTransaction().erc20Effects,
          version: 2,
          items: [{ ...preparedChildTransaction().erc20Effects.items[0], amount: '20' }]
        };
        const parentInsert = await EVMTransactionStorage.collection.insertOne(parentTransaction() as any);
        const childInsert = await EVMTransactionStorage.collection.insertOne({
          ...parentTransaction([existingWallet]),
          chain: childChain,
          txid: childTxid,
          erc20Effects: futureErc20Effects
        } as any);
        const preparedTx = preparedChildTransaction();

        await EVMTransactionStorage.batchImport({
          txs: [preparedTx as any],
          height,
          blockTime: time,
          blockHash,
          blockTimeNormalized: time,
          parentChain,
          forkHeight,
          chain: childChain,
          network,
          initialSyncComplete: false
        });

        const parent = await EVMTransactionStorage.collection.findOne({ _id: parentInsert.insertedId });
        const children = await EVMTransactionStorage.collection.find({
          chain: childChain,
          network,
          txid: { $in: [parentTxid, childTxid] }
        }).toArray();
        const child = children[0];

        expect(parent).to.exist;
        expect(parent).not.to.have.property('erc20Effects');
        expect(children).to.have.length(1);
        expect(child).to.exist;
        expect(child!._id!.toString()).to.equal(childInsert.insertedId.toString());
        expect(child!.txid).to.equal(childTxid);
        expect(child!.chain).to.equal(childChain);
        expect(child!.network).to.equal(network);
        expect(child!.erc20Effects).to.deep.equal(futureErc20Effects);
        expect(child!.wallets.map(walletId => walletId.toString()).sort()).to.deep.equal(
          [existingWallet.toString(), canonicalWallet.toString()].sort()
        );
      });
    });
  });

});
