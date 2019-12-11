import logger from '../../../logger';
import { BaseModule } from '../..';
import { RippleStateProvider } from './csp';
import { RippleAPI } from 'ripple-lib';
import { StateStorage } from '../../../models/state';

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

        client.connection.on('transaction', tx => {
          const transformed = csp.transform(tx, network);
          this.services.Event.txEvent.emit('tx', { chain, network, ...transformed });
          const address = tx.transaction.Account;
          const coin = csp.transformToCoin(tx, network);
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
