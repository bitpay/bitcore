import { expect } from 'chai';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { Pruning } from '../../../src/services/pruning';
import { resetDatabase } from '../../helpers';
import '../../../src/utils/polyfills';

describe('Pruning Service', function() {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function insertBadCoins() {
    const invalidCoin = {
      chain: 'BTC',
      network: 'mainnet',
      mintTxid: 'invalidCoin',
      spentTxid: 'spentInMempool',
      mintHeight: -3
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

    await CoinStorage.collection.insertOne(invalidCoin);
    await CoinStorage.collection.insertOne(mempoolCoin);
    await CoinStorage.collection.insertOne(mempoolCoin2);

    return [invalidCoin, mempoolCoin, mempoolCoin2];
  }

  it('should detect coins that should be invalid but are not', async () => {
    await insertBadCoins();
    const shouldBeInvalid = Pruning.detectInvalidCoins('BTC', 'mainnet');
    let count = 0;
    for await (const shouldBeInvalidCoins of shouldBeInvalid) {
      count++;
      const txids = shouldBeInvalidCoins.map(c => c.mintTxid);
      expect(txids.length).eq(2);
      expect(txids[0]).eq('spentInMempool');
      expect(txids[1]).eq('spentInMempoolAgain');
    }
    expect(count).eq(1);
  });

  it('should mark detected coins as invalid', async () => {
    await insertBadCoins();
    const shouldBeInvalid = Pruning.detectInvalidCoins('BTC', 'mainnet');
    for await (const shouldBeInvalidCoins of shouldBeInvalid) {
      const txids = shouldBeInvalidCoins.map(c => c.mintTxid);
      await Pruning.clearInvalid(txids);
      const shouldBeUpdated = await CoinStorage.collection
        .find({ chain: 'BTC', network: 'mainnet', mintTxid: { $in: txids } })
        .toArray();
      expect(shouldBeUpdated.length).eq(2);
      expect(shouldBeUpdated[0].mintHeight).eq(-3);
      expect(shouldBeUpdated[1].mintHeight).eq(-3);
    }
  });
});
