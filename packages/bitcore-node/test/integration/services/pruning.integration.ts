import { expect } from 'chai';
import { MongoBound } from '../../../src/models/base';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { IBtcTransaction, TransactionStorage } from '../../../src/models/transaction';
import { PruningService } from '../../../src/services/pruning';
const Pruning = new PruningService({ transactionModel: TransactionStorage, coinModel: CoinStorage });
import '../../../src/utils/polyfills';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Pruning Service', function() {
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
    process.env.DRYRUN = 'false';
  });
  afterEach(() => {
    process.env.DRYRUN = undefined;
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

  async function insertBadCoins() {
    await TransactionStorage.collection.insertOne(invalidTx);
    await CoinStorage.collection.insertOne(invalidCoin);
    await CoinStorage.collection.insertOne(mempoolCoin);
    await CoinStorage.collection.insertOne(mempoolCoin2);

    return [invalidCoin, mempoolCoin, mempoolCoin2];
  }

  async function insertOldTx() {
    await TransactionStorage.collection.insertOne(oldMempoolTx);
    await CoinStorage.collection.insertOne(oldMempoolCoin);
    await CoinStorage.collection.insertOne(oldMempoolCoin2);
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

    const shouldBeGoneTx = await CoinStorage.collection
      .find({ chain, network, txid: { $in: [oldMempoolTx.txid] } })
      .toArray();
    const shouldBeGoneCoins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: [oldMempoolCoin.mintTxid, oldMempoolCoin2.mintTxid] } })
      .toArray();

    expect(shouldBeGoneTx.length).eq(0);
    expect(shouldBeGoneCoins.length).eq(0);
  });
});
