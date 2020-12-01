import { ObjectId } from 'mongodb';
import { RippleAPI } from 'ripple-lib';
import { BaseModule } from '../..';
import logger from '../../../logger';
import { RippleStateProvider } from './csp';

export class RippleEventAdapter {
  stopping = false;
  clients: RippleAPI[] = [];
  constructor(protected services: BaseModule['bitcoreServices']) {}

  async start() {
    this.stopping = false;
    console.log('Starting websocket adapter for Ripple');

    this.services.Event.events.on('stop', () => {
      this.stop();
    });

    this.services.Event.events.on('start', async () => {
      const networks = this.services.Config.chainNetworks()
        .filter(c => c.chain === 'XRP')
        .map(c => c.network);
      const chain = 'XRP';
      const csp = this.services.CSP.get({ chain }) as RippleStateProvider;

      for (let network of networks) {
        try {
          const client = await csp.getClient(network);

          client.on('ledger', async ledger => {
            if (this.stopping) {
              return;
            }
            this.services.Event.blockEvent.emit('block', { chain, network, ...ledger });
          });

          client.connection.on('disconnected', () => {
            if (!this.stopping) {
              client.connection.reconnect();
            }
          });

          client.connection.on('transaction', async tx => {
            if (this.stopping) {
              return;
            }
            const address = tx.transaction.Account;
            const transformedTx = { ...csp.transform(tx, network), wallets: new Array<ObjectId>() };
            if ('chain' in transformedTx) {
              const transformedCoins = csp.transformToCoins(tx, network);
              const { transaction, coins } = await csp.tag(chain, network, transformedTx, transformedCoins);
              this.services.Event.txEvent.emit('tx', { chain, network, ...transaction });
              if (coins && coins.length) {
                for (const coin of coins) {
                  this.services.Event.addressCoinEvent.emit('coin', { address, coin });
                }
              }
            }
          });

          await client.connection.request({
            method: 'subscribe',
            streams: ['ledger', 'transactions_proposed']
          });
        } catch (e) {
          logger.error('Error connecting to XRP', e.message);
        }
      }
    });
  }

  async stop() {
    this.stopping = true;
    for (const client of this.clients) {
      client.connection.removeAllListeners();
      client.disconnect();
    }
  }
}
