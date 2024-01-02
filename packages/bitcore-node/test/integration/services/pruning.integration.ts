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

  const oldMempoolCoin = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: -1,
    mintTxid: 'oldMempoolTx',
    spentTxid: 'oldMempoolTx2'
  } as ICoin;

  const oldMempoolCoin2 = {
    chain: 'BTC',
    network: 'mainnet',
    mintHeight: -1,
    mintTxid: 'oldMempoolTx2',
    spentTxid: ''
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
    await TransactionStorage.collection.insertOne({ ...oldMempoolTx, txid: modTxid(oldMempoolTx.txid, i) });
    await CoinStorage.collection.insertOne({ ...oldMempoolCoin, mintTxid: modTxid(oldMempoolCoin.mintTxid, i), spentTxid: modTxid(oldMempoolCoin.spentTxid, i) });
    await CoinStorage.collection.insertOne({ ...oldMempoolCoin2, mintTxid: modTxid(oldMempoolCoin2.mintTxid, i) });
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

    const shouldBeGoneTx = await TransactionStorage.collection
      .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
      .toArray();
    const shouldBeGoneCoins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [oldMempoolCoin.mintTxid, oldMempoolCoin2.mintTxid] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(0);
    expect(shouldBeGoneCoins.length).eq(0);
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

    const shouldBeGoneTx = await TransactionStorage.collection
      .find({ chain, network, txid: { $in: [modTxid(oldMempoolTx.txid, 0), modTxid(oldMempoolTx.txid, 1), modTxid(oldMempoolTx.txid, 2)] } })
      .toArray();
    const shouldBeGoneCoins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [modTxid(oldMempoolCoin.mintTxid, 0), modTxid(oldMempoolCoin2.mintTxid, 0), modTxid(oldMempoolCoin.mintTxid, 1), modTxid(oldMempoolCoin2.mintTxid, 1), modTxid(oldMempoolCoin.mintTxid, 2), modTxid(oldMempoolCoin2.mintTxid, 2)] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(1);
    expect(shouldBeGoneCoins.length).eq(2);
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
      .find({ chain, network, mintTxid: { $in: [oldMempoolCoin.mintTxid, oldMempoolCoin2.mintTxid] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(1);
    expect(shouldBeGoneCoins.length).eq(2);
  });

  it('should skip removing transactions if coin has >0 confs', async () => {
    const rpcStub = sandbox.stub(RPC.prototype, 'getTransaction')
    rpcStub.onCall(0).rejects({ code: -5, message: 'already exists' });
    const oldMempoolCoin2Height = oldMempoolCoin2.mintHeight;
    oldMempoolCoin2.mintHeight = 1;
    await insertOldTx();
    oldMempoolCoin2.mintHeight = oldMempoolCoin2Height; // reset
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
      .find({ chain, network, mintTxid: { $in: [oldMempoolCoin.mintTxid, oldMempoolCoin2.mintTxid] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(1);
    expect(shouldBeGoneCoins.length).eq(2);
  });
});
