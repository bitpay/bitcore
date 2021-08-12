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
  protected subscriptions: Array<any>;
  protected index: number;

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
    this.subscriptions = [];
    this.index = 0;
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
        _.map(trustedPeers, peer => new CryptoRpc(_.merge(baseRpcConfig, peer)).get(this.chain))
      );

    logger.info(`Set up ${this.providers.length} peers in ETH pool`);
  };

  /**
   * Checks for disconnected web3 instances in the providers array
   */
  checkConnections = async (reconnect: boolean = true): Promise<boolean> => {
    const disconnected: CryptoRpc[] = [];
    for (const provider of this.providers)
      if (!(provider && (await provider.web3.eth.net.isListening()))) disconnected.push(provider);

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
   * @param cb {(err, res) => any} - Callback function that is executed when event fires
   */
  setupListeners = async (event: string, cb: (err, res) => any): Promise<void> => {
    for (const provider of this.providers) {
      this.subscriptions.push(await provider.web3.eth.subscribe(event));
      this.subscriptions[this.subscriptions.length - 1].subscribe(cb);
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
   * @returns {Array<CryptoRpc>} Shuffled array of CryptoRPC providers
   */
  getRpcs = (): Array<CryptoRpc> => _.shuffle(this.providers);

  /**
   * Gets an instance of web3 from a random CryptoRpc provider
   *
   * @returns {Web3} An instance of web3
   */
  getWeb3 = (): Web3 => this.getRpc().web3;
}
