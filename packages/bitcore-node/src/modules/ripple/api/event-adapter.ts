import { ObjectId } from 'mongodb';
import { BaseModule } from '../..';
import logger from '../../../logger';
import { RippleStateProvider } from './csp';
import type { XrpRpc } from '@bitpay-labs/crypto-rpc/lib/xrp/XrpRpc';

export class RippleEventAdapter {
  stopping = false;
  clients: XrpRpc[] = [];
  constructor(protected services: BaseModule['bitcoreServices'], protected network: string) {}

  async start() {
    return;
    // TODO: Determine if we still want/need this.
    // It's effectively been disabled for a while (maybe forever?) until
    // I updated it so the listeners actually get created. However, I don't
    // want to blindly start listening for and handling the ledgers & txs
    // without thinking through the implications (BWS crash potential, etc).

    this.stopping = false;
    logger.info('Starting websocket adapter for Ripple');

    const networks = this.services.Config.chainNetworks()
      .filter(c => c.chain === 'XRP')
      .map(c => c.network);
    const chain = 'XRP';
    const network = this.network;
    const csp = this.services.CSP.get({ chain, network }) as RippleStateProvider;

    for (const network of networks) {
      try {
        const client = await csp.getClient(network);

        client.rpc.on('ledgerClosed', async ledger => {
          if (this.stopping) {
            return;
          }
          this.services.Event.blockEvent.emit('block', { chain, network, ...ledger });
        });

        client.rpc.on('disconnected', () => {
          if (!this.stopping) {
            client.rpc.connect();
          }
        });

        client.rpc.on('transaction', async (tx: any) => { // TODO: rm `any` type & fix type errors
          if (this.stopping) {
            return;
          }
          const address = tx.transaction.Account;
          const transformedTx = { ...csp.transform(tx, network), wallets: new Array<ObjectId>() };
          if ('chain' in transformedTx) {
            const transformedCoins = csp.transformToCoins(tx, network);
            const { transaction, coins } = await csp.tag(chain, network, transformedTx, transformedCoins);
            this.services.Event.txEvent.emit('tx', { ...transaction });
            for (const coin of (coins || [])) {
              this.services.Event.addressCoinEvent.emit('coin', { address, coin });
            }
          }
        });

        await client.asyncRequest('subscribe', { streams: ['ledger', 'transactions_proposed'] });
      } catch (e: any) {
        logger.error('Error connecting to XRP: %o', e);
      }
    }
  }

  async stop() {
    this.stopping = true;
    for (const client of this.clients) {
      client.rpc.removeAllListeners();
      await client.asyncRequest('unsubscribe', { streams: ['ledger', 'transactions_proposed'] });
      client.rpc.disconnect();
    }
  }
}
