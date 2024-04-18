import { expect } from 'chai';
import sinon from 'sinon';
import { MongoBound } from '../../../src/models/base';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { IBtcTransaction, TransactionStorage } from '../../../src/models/transaction';
import { PruningService } from '../../../src/services/pruning';
const Pruning = new PruningService({ transactionModel: TransactionStorage, coinModel: CoinStorage });
import '../../../src/utils/polyfills';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { RPC } from '../../../src/rpc';

describe('Pruning Service', function() {
  const suite = this;
  this.timeout(30000);
  const sandbox = sinon.createSandbox();
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
    Pruning.registerRpcs();
    Pruning.rpcs['BTC:mainnet'] = new RPC('user', 'pw', 'host', 'port');
    process.env.DRYRUN = 'false';
  });
  afterEach(() => {
    process.env.DRYRUN = undefined;
    sandbox.restore();
  });
  const invalidTx = {
    chain: 'BTC',
    network: 'mainnet',
    blockHeight: -3,
    txid: 'invalidCoin'
  } as MongoBound<IBtcTransaction>;

  const invalidCoin = {
    chain: 'BTC',
    network: 'mainnet',
    mintTxid: 'invalidCoin',
    spentTxid: 'spentInMempool',
    mintHeight: -1
  } as ICoin;

  const mempoolCoin = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: -1,
    mintTxid: 'spentInMempool',
    spentTxid: 'spentInMempoolAgain'
  } as ICoin;

  const mempoolCoin2 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: -1,
    mintTxid: 'spentInMempoolAgain'
  } as ICoin;

  const oldMempoolTx = {
    chain: 'BTC',
    network: 'mainnet',
    blockHeight: -1,
    txid: 'oldMempoolTx',
    blockTimeNormalized: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  } as MongoBound<IBtcTransaction>;

  const oldMempoolTxOutput = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: -1,
    mintTxid: 'oldMempoolTx',
    spentTxid: 'oldMempoolTx2'
  } as ICoin;

  const oldMempoolTx2Output = { // output that spends oldMempoolTxOutput
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: -1,
    mintTxid: 'oldMempoolTx2',
    spentTxid: ''
  } as ICoin;

  const parentTxOutput1 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: 1234,
    mintTxid: 'parentTx',
    spentHeight: -1,
    spentTxid: 'oldMempoolTx' // this output is an input for oldMempoolTx
  } as ICoin;

  const parentTxOutput2 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: 1234,
    mintTxid: 'parentTx',
    spentHeight: -1,
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

    return [invalidCoin, mempoolCoin, mempoolCoin2];
  }

  async function insertOldTx(i: any = 0) {
    await CoinStorage.collection.insertOne({ ...parentTxOutput1, spentTxid: modTxid(parentTxOutput1.spentTxid, i) });
    await CoinStorage.collection.insertOne({ ...parentTxOutput2, spentTxid: modTxid(parentTxOutput2.spentTxid, i) });
    await TransactionStorage.collection.insertOne({ ...oldMempoolTx, txid: modTxid(oldMempoolTx.txid, i) });
    await CoinStorage.collection.insertOne({ ...oldMempoolTxOutput, mintTxid: modTxid(oldMempoolTxOutput.mintTxid, i), spentTxid: modTxid(oldMempoolTxOutput.spentTxid, i) });
    await CoinStorage.collection.insertOne({ ...oldMempoolTx2Output, mintTxid: modTxid(oldMempoolTx2Output.mintTxid, i) });
  }

  it('should detect coins that should be invalid but are not', async () => {
    await insertBadCoins();
    const { chain, network } = invalidCoin;
    await Pruning.processAllInvalidTxs(chain, network);
    const shouldBeInvalid = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
      .toArray();
    for (const coin of shouldBeInvalid) {
      expect(coin.mintHeight).eq(-3);
    }
    expect(shouldBeInvalid.length).eq(3);
  });

  it('should mark detected coins as invalid', async () => {
    await insertBadCoins();
    const { chain, network } = invalidCoin;
    await Pruning.processAllInvalidTxs(chain, network);
    const shouldBeInvalid = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [invalidCoin.mintTxid, mempoolCoin.mintTxid, mempoolCoin2.mintTxid] } })
      .toArray();
    for (const coin of shouldBeInvalid) {
      expect(coin.mintHeight).eq(-3);
    }
    expect(shouldBeInvalid.length).eq(3);
  });

  it('should remove old transactions', async () => {
    sandbox.stub(RPC.prototype, 'getTransaction').resolves(null);
    await insertOldTx();
    const { chain, network } = oldMempoolTx;

    const count = await TransactionStorage.collection.countDocuments({
      chain,
      network,
      blockHeight: -1,
      blockTimeNormalized: { $lt: new Date() }
    });
    expect(count).eq(1);
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

    expect(shouldBeExpiredTx.length).eq(1);
    expect(shouldBeExpiredTx.every(tx => tx.blockHeight === -5)).to.equal(true);
    expect(shouldBeExpiredCoins.length).eq(2);
    expect(shouldBeExpiredCoins.every(coin => coin.mintHeight === -5)).to.equal(true);
    expect(parentTxOutputs.length).eq(2);
    expect(parentTxOutputs.filter(coin => coin.spentHeight === -2).length).to.equal(1);
  });

  it('should skip removing transactions still in mempool', async () => {
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
      blockHeight: -1,
      blockTimeNormalized: { $lt: new Date() }
    });
    expect(count).eq(3);
    await Pruning.processOldMempoolTxs(chain, network, 29);

    const processedTxs = await TransactionStorage.collection
      .find({ chain, network, txid: { $in: [modTxid(oldMempoolTx.txid, 0), modTxid(oldMempoolTx.txid, 1), modTxid(oldMempoolTx.txid, 2)] } })
      .toArray();
    const processedCoins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [modTxid(oldMempoolTxOutput.mintTxid, 0), modTxid(oldMempoolTx2Output.mintTxid, 0), modTxid(oldMempoolTxOutput.mintTxid, 1), modTxid(oldMempoolTx2Output.mintTxid, 1), modTxid(oldMempoolTxOutput.mintTxid, 2), modTxid(oldMempoolTx2Output.mintTxid, 2)] } })
      .toArray();

    expect(processedTxs.length).eq(3);
    expect(processedTxs.filter(tx => tx.blockHeight === -5).length).eq(2);
    expect(processedTxs.filter(tx => tx.blockHeight === -1).length).eq(1); // still in mempool
    expect(processedCoins.length).eq(6);
    expect(processedCoins.filter(coin => coin.mintHeight === -5).length).eq(4);
    expect(processedCoins.filter(coin => coin.mintHeight === -1).length).eq(2); // still in mempool
  });

  it('should skip removing transactions on rpc error', async () => {
    const rpcStub = sandbox.stub(RPC.prototype, 'getTransaction')
    rpcStub.onCall(0).rejects({ code: -1, message: 'hahaha' });
    await insertOldTx();
    const { chain, network } = oldMempoolTx;

    const count = await TransactionStorage.collection.countDocuments({
      chain,
      network,
      blockHeight: -1,
      blockTimeNormalized: { $lt: new Date() }
    });
    expect(count).eq(1);
    await Pruning.processOldMempoolTxs(chain, network, 29);

    const shouldBeGoneTx = await TransactionStorage.collection
      .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
      .toArray();
    const shouldBeGoneCoins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [oldMempoolTxOutput.mintTxid, oldMempoolTx2Output.mintTxid] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(1);
    expect(shouldBeGoneCoins.length).eq(2);
  });

  it('should skip removing transactions if coin has >0 confs', async () => {
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
      blockHeight: -1,
      blockTimeNormalized: { $lt: new Date() }
    });
    expect(count).eq(1);
    await Pruning.processOldMempoolTxs(chain, network, 29);

    const shouldBeGoneTx = await TransactionStorage.collection
      .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
      .toArray();
    const shouldBeGoneCoins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [oldMempoolTxOutput.mintTxid, oldMempoolTx2Output.mintTxid] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(1);
    expect(shouldBeGoneCoins.length).eq(2);
  });
});
