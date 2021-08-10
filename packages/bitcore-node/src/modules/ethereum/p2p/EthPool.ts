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

    this.providers = []; // Clear existing providers, if any
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
  checkConnections = (): void => {
    const disconnected = _.filter(this.providers, provider => !(provider && provider.web3.eth.net.isListening()));

    if (disconnected.length > 0) {
      logger.info(`Found ${disconnected.length} disconnected ${this.chain} ${this.network} RPCs, reconnecting...`);
      this._setupRpcs();
    }
  };

  /**
   * Checks existing connection statuses and gets a random RPC from the providers array
   *
   * @returns {CryptoRpc} A CryptoRPC object from the providers array
   */
  getRpc = (): CryptoRpc => {
    this.checkConnections();
    return _.shuffle(this.providers)[0];
  };

  /**
   * Gets an instance of web3 from a random CryptoRpc provider
   *
   * @returns {Web3} An instance of web3
   */
  getWeb3 = (): Web3 => this.getRpc().web3;
}
