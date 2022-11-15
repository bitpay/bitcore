import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as _ from 'lodash';
import { FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { XRP } from '../../../src/modules/ripple/api/csp';
import { XrpBlockStorage } from '../../../src/modules/ripple/models/block';
import { XrpTransactionStorage } from '../../../src/modules/ripple/models/transaction';
import { IXrpCoin, IXrpTransaction } from '../../../src/modules/ripple/types';
import { RippleTxs } from '../../fixtures/rippletxs.fixture';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('Ripple Api', function() {
  const suite = this;
  const network = 'testnet';
  this.timeout(30000);

  before(intBeforeHelper);
  after(async () => {
    await intAfterHelper(suite);
    const client = await XRP.getClient(network);
    await client.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('should be able to get the ledger', async () => {
    const client = await XRP.getClient(network);
    const ledger = await client.getLedger();
    expect(ledger).to.exist;
    expect(ledger.ledgerHash).to.exist;
  });

  it('should be able to get local tip', async () => {
    const chain = 'XRP';

    await XrpBlockStorage.collection.insertOne({
      chain,
      network,
      height: 5,
      hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
      time: new Date(1526326784),
      timeNormalized: new Date(1526326784),
      transactionCount: 1,
      reward: 50,
      previousBlockHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
      nextBlockHash: '',
      size: 264,
      processed: true
    });

    const tip = await XRP.getLocalTip({ chain, network });
    expect(tip).to.exist;
    expect(tip.hash).to.exist;
    expect(tip.hash).to.eq('528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7');
  });

  it('should transform a ripple rpc response into a bitcore transaction', async () => {
    const txs = (RippleTxs as any) as Array<FormattedTransactionType>;
    for (const tx of txs) {
      const bitcoreTx = (await XRP.transform(tx, 'testnet')) as IXrpTransaction;
      expect(bitcoreTx).to.have.property('chain');
      expect(tx.address).to.eq(bitcoreTx.from);
      expect(tx.outcome.ledgerVersion).to.eq(bitcoreTx.blockHeight);
      expect(tx.outcome.fee).to.eq((bitcoreTx.fee / 1e6).toString());
      expect(Number(tx.outcome.balanceChanges[bitcoreTx.from][0].value)).to.be.lt(0);
      if (tx.outcome.deliveredAmount) {
        expect(Object.keys(tx.outcome.balanceChanges)).to.contain(bitcoreTx.to!);
        expect(tx.outcome.deliveredAmount!.value).to.eq((bitcoreTx.value / 1e6).toString());
        expect(Number(tx.outcome.balanceChanges[bitcoreTx.to!][0].value)).to.be.gt(0);
      }
    }
  });

  it('should tag txs from a wallet', async () => {
    const chain = 'XRP';
    const network = 'testnet';

    const txs = (RippleTxs as any) as Array<FormattedTransactionType>;
    const wallet = new ObjectId();
    const address = 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm';
    await WalletAddressStorage.collection.insertOne({
      chain,
      network,
      wallet,
      address,
      processed: true
    });
    for (const tx of txs) {
      const bitcoreTx = (await XRP.transform(tx, network)) as IXrpTransaction;
      const bitcoreCoins = XRP.transformToCoins(tx, network);
      const { transaction, coins } = await XRP.tag(chain, network, bitcoreTx, bitcoreCoins);
      expect(transaction.wallets.length).eq(1);
      expect(transaction.wallets[0].equals(wallet));
      let hasACoin = false;
      for (const coin of coins) {
        if (coin.address == address) {
          hasACoin = true;
          expect(coin.wallets.length).eq(1);
          expect(coin.wallets[0].equals(wallet));
        }
      }
      expect(hasACoin).eq(true);
    }
  });

  it('should save tagged transactions to the database', async () => {
    const chain = 'XRP';
    const network = 'testnet';

    const wallet = new ObjectId();
    const address = 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm';
    await WalletAddressStorage.collection.insertOne({
      chain,
      network,
      wallet,
      address,
      processed: true
    });

    const txs = (RippleTxs as any) as Array<FormattedTransactionType>;
    const blockTxs = new Array<IXrpTransaction>();
    const blockCoins = new Array<IXrpCoin>();

    for (const tx of txs) {
      const bitcoreTx = XRP.transform(tx, network) as IXrpTransaction;
      const bitcoreCoins = XRP.transformToCoins(tx, network);
      const { transaction, coins } = await XRP.tag(chain, network, bitcoreTx, bitcoreCoins);
      blockTxs.push(transaction);
      blockCoins.push(...coins);
    }
    await XrpTransactionStorage.batchImport({
      txs: blockTxs,
      coins: blockCoins,
      chain,
      network,
      initialSyncComplete: false
    });
    const walletTxs = await XrpTransactionStorage.collection.find({ chain, network, wallets: wallet }).toArray();

    expect(walletTxs.length).eq(txs.length);
  });
});
