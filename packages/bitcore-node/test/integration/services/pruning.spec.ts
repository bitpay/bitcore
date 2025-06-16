import { describe, test, before, after } from 'node:test';
import assert from 'assert';
import { ObjectId } from 'bson';
import sinon from 'sinon';
import { MongoBound } from '../../../src/models/base';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { IBtcTransaction, TransactionStorage } from '../../../src/models/transaction';
import { PruningService } from '../../../src/services/pruning';
import '../../../src/utils/polyfills';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { RPC } from '../../../src/rpc';
import { SpentHeightIndicators } from '../../../src/types/Coin';
import logger from '../../../src/logger';

const Pruning = new PruningService({ transactionModel: TransactionStorage, coinModel: CoinStorage });

test('Pruning Service', { timeout: 30000 }, async function(t) {
  const sandbox = sinon.createSandbox();
  before(intBeforeHelper);
  after(async () => intAfterHelper(t));

  t.beforeEach(async () => {
    await resetDatabase();
    Pruning.lastRunTimeInvalid = 0;
    Pruning.lastRunTimeOld = 0;
    Pruning.registerRpcs();
    Pruning.rpcs['BTC:mainnet'] = new RPC('user', 'pw', 'host', 'port');
    sandbox.stub(Pruning.rpcs['BTC:mainnet'], 'getBlockHeight').resolves(1240);
    process.env.DRYRUN = 'false';
    sandbox.spy(logger, 'info');
    sandbox.spy(logger, 'warn');
    sandbox.spy(logger, 'error');
  });
  t.afterEach(() => {
    process.env.DRYRUN = undefined;
    sandbox.restore();
  });

  const replacementTx = {
    chain: 'BTC',
    network: 'mainnet',
    blockHeight: 1234,
    txid: 'replacementTx',
  } as MongoBound<IBtcTransaction>;

  const invalidTx = {
    chain: 'BTC',
    network: 'mainnet',
    blockHeight: SpentHeightIndicators.conflicting,
    txid: 'invalidCoin',
    replacedByTxid: 'replacementTx'
  } as MongoBound<IBtcTransaction>;

  const invalidCoin = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: SpentHeightIndicators.pending,
    mintTxid: 'invalidCoin',
    spentHeight: SpentHeightIndicators.pending,
    spentTxid: 'spentInMempool'
  } as ICoin;

  const mempoolCoin = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: SpentHeightIndicators.pending,
    mintTxid: 'spentInMempool',
    spentHeight: SpentHeightIndicators.pending,
    spentTxid: 'spentInMempoolAgain'
  } as ICoin;

  const mempoolCoin2 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: SpentHeightIndicators.pending,
    mintTxid: 'spentInMempoolAgain'
  } as ICoin;

  const oldMempoolTx = {
    chain: 'BTC',
    network: 'mainnet',
    blockHeight: SpentHeightIndicators.pending,
    txid: 'oldMempoolTx',
    blockTimeNormalized: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  } as MongoBound<IBtcTransaction>;

  const oldMempoolTxOutput = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: SpentHeightIndicators.pending,
    mintTxid: 'oldMempoolTx',
    spentTxid: 'oldMempoolTx2'
  } as ICoin;

  const oldMempoolTx2Output = { // output that spends oldMempoolTxOutput
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: SpentHeightIndicators.pending,
    mintTxid: 'oldMempoolTx2',
    spentTxid: ''
  } as ICoin;

  const parentTxOutput1 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: 1234,
    mintTxid: 'parentTx',
    spentHeight: SpentHeightIndicators.pending,
    spentTxid: 'oldMempoolTx' // this output is an input for oldMempoolTx
  } as ICoin;

  const parentTxOutput2 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: 1234,
    mintTxid: 'parentTx',
    spentHeight: SpentHeightIndicators.pending,
    spentTxid: 'imaginaryTx' // another imaginary tx spent this output. This is here to make sure we don't mark this output as unspent
  } as ICoin;

  function modTxid(orig, i) {
    return orig + (i ? '_' + i : '');
  }

  async function insertBadCoins() {
    await TransactionStorage.collection.insertOne(invalidTx);
    await CoinStorage.collection.insertOne(invalidCoin);
    await CoinStorage.collection.insertOne(mempoolCoin);
    await CoinStorage.collection.insertOne(mempoolCoin2);
    await TransactionStorage.collection.insertOne(replacementTx);

    return [invalidCoin, mempoolCoin, mempoolCoin2];
  }

  async function insertOldTx(i: any = 0) {
    await CoinStorage.collection.insertOne({ ...parentTxOutput1, spentTxid: modTxid(parentTxOutput1.spentTxid, i) });
    await CoinStorage.collection.insertOne({ ...parentTxOutput2, spentTxid: modTxid(parentTxOutput2.spentTxid, i) });
    await TransactionStorage.collection.insertOne({ ...oldMempoolTx, txid: modTxid(oldMempoolTx.txid, i) });
    await CoinStorage.collection.insertOne({ ...oldMempoolTxOutput, mintTxid: modTxid(oldMempoolTxOutput.mintTxid, i), spentTxid: modTxid(oldMempoolTxOutput.spentTxid, i) });
    await CoinStorage.collection.insertOne({ ...oldMempoolTx2Output, mintTxid: modTxid(oldMempoolTx2Output.mintTxid, i) });
  }

  await t.test('processAllInvalidTxs', async function(t) {
    await t.test('should detect coins that should be invalid but are not', async () => {
      await insertBadCoins();
      const { chain, network } = invalidCoin;
      await Pruning.processAllInvalidTxs(chain, network);
      const shouldBeInvalid = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
        .toArray();
      for (const coin of shouldBeInvalid) {
        assert.strictEqual(coin.mintHeight, SpentHeightIndicators.conflicting, 'coin should be marked as conflicting');
      }
      assert.strictEqual(shouldBeInvalid.length, 3);
    });

    await t.test('should mark detected coins as invalid', async () => {
      await insertBadCoins();
      const { chain, network } = invalidCoin;
      await Pruning.processAllInvalidTxs(chain, network);
      const shouldBeInvalid = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
        .toArray();
      for (const coin of shouldBeInvalid) {
        assert.strictEqual(coin.mintHeight, SpentHeightIndicators.conflicting, 'coin should be marked as conflicting');
      }
      assert.strictEqual(shouldBeInvalid.length, 3);
    });

    await t.test('should not invalidate a mined tx', async function() {
      await insertBadCoins();
      const { chain, network } = invalidCoin;
      await Pruning.invalidateTx(chain, network, replacementTx);
      const shouldBeInvalidStill = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
        .toArray();
      assert.strictEqual(shouldBeInvalidStill.every(coin => coin.mintHeight === SpentHeightIndicators.pending), true, 'every coin should still be pending');
      assert.strictEqual(shouldBeInvalidStill.length, 3);
      const msg = `Tx ${replacementTx.txid} is already mined`;
      assert.notEqual((logger.warn as any).args.find((args: any) => args[0] === msg), null, 'logger should have warned');
    });

    await t.test('should not go into an infinite loop if there is a circular replacedByTxid reference', async function() {
      await insertBadCoins();
      await TransactionStorage.collection.insertOne({
        ...replacementTx,
        _id: new ObjectId(),
        txid: 'replacementTx2',
        blockHeight: SpentHeightIndicators.pending,
        replacedByTxid: replacementTx.txid
      });
      await TransactionStorage.collection.updateOne({
        txid: replacementTx.txid
      }, {
        $set: {
          replacedByTxid: 'replacementTx2'
        }
      });
      // at this point, invalidTx => replacementTx => replacementTx2 => replacementTx

      const { chain, network } = invalidCoin;
      await Pruning.processAllInvalidTxs(chain, network);
      const shouldBeInvalid = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
        .toArray();
      assert.strictEqual(shouldBeInvalid.every(coin => coin.mintHeight === SpentHeightIndicators.conflicting), true, 'every coin should still be pending');
      assert.strictEqual(shouldBeInvalid.length, 3);
    });

    await t.test('should not go into an infinite loop if there is a circular, unconfirmed replacedByTxid reference', async function() {
      await insertBadCoins();
      await TransactionStorage.collection.insertOne({
        ...replacementTx,
        _id: new ObjectId(),
        txid: 'replacementTx2',
        blockHeight: SpentHeightIndicators.pending,
        replacedByTxid: replacementTx.txid
      });
      await TransactionStorage.collection.updateOne({
        txid: replacementTx.txid
      }, {
        $set: {
          replacedByTxid: 'replacementTx2',
          blockHeight: SpentHeightIndicators.pending
        }
      });
      // at this point, invalidTx => replacementTx => replacementTx2 => replacementTx
      // but replacementTx is still unconfirmed

      const { chain, network } = invalidCoin;
      await Pruning.processAllInvalidTxs(chain, network);
      const shouldBePendingStill = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
        .toArray();
      assert.strictEqual(shouldBePendingStill.every(coin => coin.mintHeight === SpentHeightIndicators.pending), true, 'every coin should still be pending');
      assert.strictEqual(shouldBePendingStill.length, 3);
      const msg = `Skipping invalidation of ${invalidTx.txid} with immature replacement => ${invalidTx.replacedByTxid}`;
      assert.notEqual((logger.info as any).args.find((args: any) => args[0] === msg), null, 'should log skipping invalidation');
    });
  });

  describe('processOldMempoolTxs', async function() {
    await t.test('should remove old transactions', async () => {
      sandbox.stub(RPC.prototype, 'getTransaction').resolves(null);
      await insertOldTx();
      const { chain, network } = oldMempoolTx;

      const count = await TransactionStorage.collection.countDocuments({
        chain,
        network,
        blockHeight: -1,
        blockTimeNormalized: { $lt: new Date() }
      });
      assert.strictEqual(count, 1);
      await Pruning.processOldMempoolTxs(chain, network, 29);

      const shouldBeExpiredTx = await TransactionStorage.collection
        .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
        .toArray();
      const shouldBeExpiredCoins = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [oldMempoolTxOutput.mintTxid, oldMempoolTx2Output.mintTxid] } })
        .toArray();
      const parentTxOutputs = await CoinStorage.collection
        .find({ chain, network, mintTxid: parentTxOutput1.mintTxid })
        .toArray();

      assert.strictEqual(shouldBeExpiredTx.length, 1);
      assert.strictEqual(shouldBeExpiredTx.every(tx => tx.blockHeight === SpentHeightIndicators.expired), true, 'tx should be expired');
      assert.strictEqual(shouldBeExpiredCoins.length, 2);
      assert.strictEqual(shouldBeExpiredCoins.every(coin => coin.mintHeight === SpentHeightIndicators.expired), true, 'coins should be expired');
      assert.strictEqual(parentTxOutputs.length, 2);
      assert.strictEqual(parentTxOutputs.filter(coin => coin.spentHeight === SpentHeightIndicators.unspent).length, 1, 'parent tx output should be unspent');
    });

    await t.test('should skip removing transactions still in mempool', async () => {
      const rpcStub = sandbox.stub(RPC.prototype, 'getTransaction')
      rpcStub.onCall(0).resolves(null);
      rpcStub.onCall(1).resolves({});
      rpcStub.onCall(2).resolves(null);
      await insertOldTx(0);
      await insertOldTx(1);
      await insertOldTx(2);
      const { chain, network } = oldMempoolTx;

      const count = await TransactionStorage.collection.countDocuments({
        chain,
        network,
        blockHeight: SpentHeightIndicators.pending,
        blockTimeNormalized: { $lt: new Date() }
      });
      assert.strictEqual(count, 3);
      await Pruning.processOldMempoolTxs(chain, network, 29);

      const processedTxs = await TransactionStorage.collection
        .find({ chain, network, txid: { $in: [modTxid(oldMempoolTx.txid, 0), modTxid(oldMempoolTx.txid, 1), modTxid(oldMempoolTx.txid, 2)] } })
        .toArray();
      const processedCoins = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [modTxid(oldMempoolTxOutput.mintTxid, 0), modTxid(oldMempoolTx2Output.mintTxid, 0), modTxid(oldMempoolTxOutput.mintTxid, 1), modTxid(oldMempoolTx2Output.mintTxid, 1), modTxid(oldMempoolTxOutput.mintTxid, 2), modTxid(oldMempoolTx2Output.mintTxid, 2)] } })
        .toArray();

      assert.strictEqual(processedTxs.length, 3);
      assert.strictEqual(processedTxs.filter(tx => tx.blockHeight === SpentHeightIndicators.expired).length, 2, 'should have 2 expired txs');
      assert.strictEqual(processedTxs.filter(tx => tx.blockHeight === SpentHeightIndicators.pending).length, 1, 'should have 1 pending tx'); // still in mempool
      assert.strictEqual(processedCoins.length, 6);
      assert.strictEqual(processedCoins.filter(coin => coin.mintHeight === SpentHeightIndicators.expired).length, 4, 'should have 4 expired coins');
      assert.strictEqual(processedCoins.filter(coin => coin.mintHeight === SpentHeightIndicators.pending).length, 2, 'shoulds have 2 pending coins'); // still in mempool
    });

    await t.test('should skip removing transactions on rpc error', async () => {
      const rpcStub = sandbox.stub(RPC.prototype, 'getTransaction')
      rpcStub.onCall(0).rejects({ code: -1, message: 'hahaha' });
      await insertOldTx();
      const { chain, network } = oldMempoolTx;

      const count = await TransactionStorage.collection.countDocuments({
        chain,
        network,
        blockHeight: SpentHeightIndicators.pending,
        blockTimeNormalized: { $lt: new Date() }
      });
      assert.strictEqual(count, 1);
      await Pruning.processOldMempoolTxs(chain, network, 29);

      const shouldBeGoneTx = await TransactionStorage.collection
        .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
        .toArray();
      const shouldBeGoneCoins = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [oldMempoolTxOutput.mintTxid, oldMempoolTx2Output.mintTxid] } })
        .toArray();

      assert.strictEqual(shouldBeGoneTx.length, 1, 'should skip removing tx');
      assert.strictEqual(shouldBeGoneCoins.length, 2, 'should skip removing coins');
    });

    await t.test('should skip removing transactions if coin has >0 confs', async () => {
      const rpcStub = sandbox.stub(RPC.prototype, 'getTransaction')
      rpcStub.onCall(0).rejects({ code: -5, message: 'already exists' });
      const oldMempoolTx2OutputHeight = oldMempoolTx2Output.mintHeight;
      oldMempoolTx2Output.mintHeight = 1;
      await insertOldTx();
      oldMempoolTx2Output.mintHeight = oldMempoolTx2OutputHeight; // reset
      const { chain, network } = oldMempoolTx;

      const count = await TransactionStorage.collection.countDocuments({
        chain,
        network,
        blockHeight: SpentHeightIndicators.pending,
        blockTimeNormalized: { $lt: new Date() }
      });
      assert.strictEqual(count, 1);
      await Pruning.processOldMempoolTxs(chain, network, 29);

      const shouldBeGoneTx = await TransactionStorage.collection
        .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
        .toArray();
      const shouldBeGoneCoins = await CoinStorage.collection
        .find({ chain, network, mintTxid: { $in: [oldMempoolTxOutput.mintTxid, oldMempoolTx2Output.mintTxid] } })
        .toArray();

      assert.strictEqual(shouldBeGoneTx.length, 1, 'should skip removing tx');
      assert.strictEqual(shouldBeGoneCoins.length, 2, 'should skip removing coins');
    });
  });
});
