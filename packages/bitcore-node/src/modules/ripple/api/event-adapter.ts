import logger from '../../../logger';
import { ObjectId } from 'mongodb';
import { BaseModule } from '../..';
import { RippleStateProvider } from './csp';
import { RippleAPI } from 'ripple-lib';
import { StateStorage } from '../../../models/state';
import { WalletAddressStorage } from '../../../models/walletAddress';

export class RippleEventAdapter {
  clients: RippleAPI[] = [];
  constructor(protected services: BaseModule['bitcoreServices']) {}

  async start() {
    console.log('Starting websocket adapter for Ripple');
    const networks = this.services.Config.chainNetworks()
      .filter(c => c.chain === 'XRP')
      .map(c => c.network);
    const chain = 'XRP';
    const csp = this.services.CSP.get({ chain }) as RippleStateProvider;

    for (let network of networks) {
      try {
        await StateStorage.collection.findOneAndUpdate(
          {},
          { $addToSet: { initialSyncComplete: `${chain}:${network}` } },
          { upsert: true }
        );
        const client = await csp.getClient(network);

        client.connection.on('transaction', async tx => {
          const address = tx.transaction.Account;
          const walletAddresses = await WalletAddressStorage.collection.find({ chain, network, address }).toArray();

          const transformed = { ...csp.transform(tx, network), wallets: new Array<ObjectId>() };
          const coin = { ...csp.transformToCoin(tx, network), wallets: new Array<ObjectId>() };
          transformed.wallets = walletAddresses.map(wa => wa.wallet);
          coin.wallets = walletAddresses.map(wa => wa.wallet);

          this.services.Event.txEvent.emit('tx', { chain, network, ...transformed });
          this.services.Event.addressCoinEvent.emit('coin', { address, coin });
        });

        client.connection.on('ledger', ledger => {
          this.services.Event.blockEvent.emit('block', { chain, network, ...ledger });
        });

        await client.connection.request({
          method: 'subscribe',
          streams: ['ledger', 'transactions_proposed']
        });
      } catch (e) {
        logger.error('Error connecting to XRP', e.message);
      }
    }
  }

  async stop() {
    for (const client of this.clients) {
      client.connection.removeAllListeners();
    }
  }
}
