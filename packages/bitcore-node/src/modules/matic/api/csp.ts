import { CryptoRpc } from 'crypto-rpc';
import { Readable } from 'stream';
import Web3 from 'web3';
import * as worker from 'worker_threads';
import Config from '../../../config';
import logger from '../../../logger';
import { ETHStateProvider } from '../../../modules/ethereum/api/csp';
import { IChainConfig, IEthNetworkConfig } from '../../../types/Config';
import { StreamWalletTransactionsParams } from '../../../types/namespaces/ChainStateProvider';
import { Erc20RelatedFilterTransform } from '../../ethereum/api/erc20Transform';
import { InternalTxRelatedFilterTransform } from '../../ethereum/api/internalTxTransform';
import { PopulateReceiptTransform } from '../../ethereum/api/populateReceiptTransform';
import { EthListTransactionsStream } from '../../ethereum/api/transform';
import { EthTransactionStorage } from '../../ethereum/models/transaction';
export interface EventLog<T> {
  event: string;
  address: string;
  returnValues: T;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  raw?: { data: string; topics: any[] };
}

export class MATICStateProvider extends ETHStateProvider {
  config: IChainConfig<IEthNetworkConfig>;
  static rpcs = {} as { [network: string]: { rpc: CryptoRpc; web3: Web3 } };

  constructor(public chain: string = 'MATIC') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<IEthNetworkConfig>;
  }

  async getWeb3(network: string): Promise<{ rpc: CryptoRpc; web3: Web3 }> {
    try {
      if (MATICStateProvider.rpcs[network]) {
        await MATICStateProvider.rpcs[network].web3.eth.getBlockNumber();
      }
    } catch (e) {
      delete MATICStateProvider.rpcs[network];
    }
    if (!MATICStateProvider.rpcs[network]) {
      logger.info(`Making a new connection for ${this.chain}:${network}`);
      const providerIdx = worker.threadId % (this.config[network].providers || []).length;
      const providerConfig = this.config[network].provider || this.config[network].providers![providerIdx];
      const rpcConfig = { ...providerConfig, chain: this.chain, currencyConfig: {} };
      const rpc = new CryptoRpc(rpcConfig, {}).get(this.chain);
      MATICStateProvider.rpcs[network] = { rpc, web3: rpc.web3 };
    }
    return MATICStateProvider.rpcs[network];
  }

  async getERC20TokenInfo(network: string, tokenAddress: string) {
    const token = await MATIC.erc20For(network, tokenAddress);
    const [name, decimals, symbol] = await Promise.all([
      token.methods.name().call(),
      token.methods.decimals().call(),
      token.methods.symbol().call()
    ]);

    return {
      name,
      decimals,
      symbol
    };
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams) {
    const { network, wallet, res, args } = params;
    const { web3 } = await this.getWeb3(network);
    const query = MATIC.getWalletTransactionQuery(params);

    let transactionStream = new Readable({ objectMode: true });
    const walletAddresses = (await this.getWalletAddresses(wallet._id!)).map(waddres => waddres.address);
    const ethTransactionTransform = new EthListTransactionsStream(walletAddresses);
    const populateReceipt = new PopulateReceiptTransform();

    transactionStream = EthTransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true);

    if (!args.tokenAddress && wallet._id) {
      const internalTxTransform = new InternalTxRelatedFilterTransform(web3, wallet._id);
      transactionStream = transactionStream.pipe(internalTxTransform);
    }

    if (args.tokenAddress) {
      const erc20Transform = new Erc20RelatedFilterTransform(web3, args.tokenAddress);
      transactionStream = transactionStream.pipe(erc20Transform);
    }

    transactionStream
      .pipe(populateReceipt)
      .pipe(ethTransactionTransform)
      .pipe(res);
  }
}

export const MATIC = new MATICStateProvider();
