import { BaseModule } from '../..';
import { RippleStateProvider } from './csp';
import { RippleAPI } from 'ripple-lib';

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
      const client = await csp.getClient(network);

      client.connection.on('transaction', tx => {
        this.services.Event.txEvent.emit('tx', { chain, network, ...tx });
      });

      client.connection.on('ledger', ledger => {
        this.services.Event.blockEvent.emit('block', { chain, network, ...ledger });
      });

      await client.connection.request({
        method: 'subscribe',
        streams: ['ledger', 'transactions_proposed']
      });
    }
  }

  async stop() {
    for (const client of this.clients) {
      client.connection.removeAllListeners();
    }
  }
}
