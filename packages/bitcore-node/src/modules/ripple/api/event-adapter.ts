import { ObjectId } from 'mongodb';
import { RippleAPI } from 'ripple-lib';
import { BaseModule } from '../..';
import logger from '../../../logger';
import { ICoin } from '../../../models/coin';
import { StateStorage } from '../../../models/state';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { RippleStateProvider } from './csp';

export class RippleEventAdapter {
  stopping = false;
  clients: RippleAPI[] = [];
  constructor(protected services: BaseModule['bitcoreServices']) {}

  async start() {
    this.stopping = false;
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
          const transaction = { ...csp.transform(tx, network), wallets: new Array<ObjectId>() };
          const transformedCoins = csp.transformToCoins(tx, network);
          let involvedAddress = [address];
          let coins = new Array<Partial<ICoin>>();
          if (Array.isArray(transformedCoins)) {
            coins = transformedCoins.map(c => {
              return { ...c, wallets: new Array<ObjectId>() };
            });
            involvedAddress.push(...coins.map(c => c.address));
          }
          const walletAddresses = await WalletAddressStorage.collection
            .find({ chain, network, address: { $in: involvedAddress } })
            .toArray();

          if ('chain' in transaction) {
            transaction.wallets = walletAddresses.map(wa => wa.wallet);
          }
          this.services.Event.txEvent.emit('tx', { chain, network, ...transaction });
          if (coins && coins.length) {
            for (const coin of coins) {
              const coinWalletAddresses = walletAddresses.filter(
                wa => coin.address && wa.address.toLowerCase() === coin.address.toLowerCase()
              );
              if (coinWalletAddresses && coinWalletAddresses.length) {
                coin.wallets = coinWalletAddresses.map(wa => wa.wallet);
              }
              this.services.Event.addressCoinEvent.emit('coin', { address, coin });
            }
          }
        });

        client.connection.on('ledger', ledger => {
          this.services.Event.blockEvent.emit('block', { chain, network, ...ledger });
        });

        client.connection.on('disconnected', () => {
          if (!this.stopping) {
            client.connection.reconnect();
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
  }

  async stop() {
    this.stopping = true;
    for (const client of this.clients) {
      client.connection.removeAllListeners();
    }
  }
}
