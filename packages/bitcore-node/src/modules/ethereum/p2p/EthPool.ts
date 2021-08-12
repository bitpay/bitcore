import { CryptoRpc } from 'crypto-rpc';
import _ from 'lodash';
import Web3 from 'web3';
import logger from '../../../logger';

/**
 * Pool of ETH CryptoRpcs used to distribute load among utilized RPC endpoints
 */
export class EthPool {
  protected config: any;
  protected chain: string;
  protected network: string;
  protected providers: Array<CryptoRpc> = [];
  protected subscriptions: Array<any> = [];
  protected eventStore: Array<any> = [];
  protected index: number = 0;

  /**
   * @constructor
   *
   * @param chain Chain of the Crypto Rpcs
   * @param network Network of the Crypto Rpcs
   * @param config Config with main provider and trusted peers
   */
  constructor(chain = 'ETH', network: string, config: any) {
    this.chain = chain;
    this.network = network;
    this.config = config || {};
    this._setupRpcs();
  }

  /**
   * Creates array of CryptoRpc providers from config values
   */
  protected _setupRpcs = (): void => {
    const { trustedPeers } = this.config[this.network];
    const baseRpcConfig = { chain: this.chain, currencyConfig: {} };
    const rpc = new CryptoRpc(_.merge(baseRpcConfig, this.config[this.network].provider), {}).get(this.chain);

    this.disconnectListeners(); // Disconnect any active listeners
    this.providers = []; // Clear existing providers
    this.providers.push(rpc);

    if (trustedPeers && trustedPeers.length > 0)
      this.providers = this.providers.concat(
        trustedPeers.map(peer => new CryptoRpc(_.merge(baseRpcConfig, peer)).get(this.chain))
      );

    logger.info(`Set up ${this.providers.length} peers in ETH pool`);
  };

  /**
   * Checks for disconnected web3 instances in the providers array
   */
  checkConnections = async (reconnect: boolean = true): Promise<boolean> => {
    const disconnected: CryptoRpc[] = [];
    for (const provider of this.providers)
      try {
        if (!(provider && (await provider.web3.eth.net.isListening()))) disconnected.push(provider);
      } catch (e) {
        disconnected.push(e);
      }

    if (disconnected.length > 0) {
      logger.warn(
        `Found ${disconnected.length} disconnected ${this.chain} ${this.network} RPCs, attempting to reconnect...`
      );
      if (reconnect) this._setupRpcs();
      return false;
    }
    return true;
  };

  /**
   * Set up a listener on all available CryptoRPC web3 connections
   *
   * @param event {string} - RPC event to register callback to
   * @param cb {(err, res?) => any} - Callback function that is executed when event fires
   */
  setupListeners = async (event: string, cb: (err, res?) => any): Promise<void> => {
    const { setEventStore, getEventStore } = this;
    for (const provider of this.providers) {
      this.subscriptions.push(await provider.web3.eth.subscribe(event));
      this.subscriptions[this.subscriptions.length - 1].subscribe((err, res) => {
        if (err) return cb(err);

        const eventStore = getEventStore();
        const isSimilar = (event, _res) =>
          typeof event === 'object' ? event[Object.keys(event)[0]] === _res[Object.keys(res)[0]] : event === res;

        // Check if the event has already been received by another RPC endpoint within the last 10s
        if (!eventStore.some(event => isSimilar(event, res))) {
          eventStore.push(res);
          // Remove item from storage after 15s (approx 3 blocks).
          // If a duplicate item comes in after this timeout, it will still be
          // filtered out by the database's unique indexes.
          setTimeout(() => setEventStore(eventStore.filter(event => isSimilar(event, res))), 15000);
          cb(err, res);
        }
      });
    }
  };

  /**
   * Disconnect all active listeners
   */
  disconnectListeners = (): void => {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  };

  /**
   * Checks existing connection statuses and gets a random RPC from the providers array
   *
   * @returns {CryptoRpc} A CryptoRPC object from the providers array
   */
  getRpc = (): CryptoRpc => {
    this.checkConnections();
    return this.providers[(this.index = this.index === this.providers.length - 1 ? 0 : this.index + 1)];
  };

  /**
   * Gets the array of CryptoRPC providers in the Eth Pool
   *
   * @returns {Array<CryptoRpc>} Array of CryptoRPC providers
   */
  getRpcs = (): Array<CryptoRpc> => this.providers;

  /**
   * Gets an instance of web3 from a random CryptoRpc provider
   *
   * @returns {Web3} An instance of web3
   */
  getWeb3 = (): Web3 => this.getRpc().web3;

  /**
   * Gets the event store. Utilized to treat incoming subscription events
   * on a first come, first serve basis and prevent duplicates.
   *
   * @returns {Array<any>} Results of events
   */
  protected getEventStore = (): Array<any> => this.eventStore;

  /**
   * Replace the event store array
   *
   * @param eventStore {Array<any>} New event store array
   */
  protected setEventStore = (eventStore: Array<any>) => (this.eventStore = eventStore);
}
