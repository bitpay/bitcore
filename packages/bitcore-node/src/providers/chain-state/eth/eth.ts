import Config from '../../../config';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { InternalStateProvider } from '../internal/internal';
import { ObjectID } from 'mongodb';
import Web3 from 'web3';
import { Storage } from '../../../services/storage';
import { Readable } from 'stream';
(Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for('Symbol.asyncIterator');

interface ParityBlockReward {
  author: string;
  rewardType: 'block';
  value: string;
}
interface ParityCall {
  callType: 'call';
  from: string;
  gas: string;
  input: string;
  to: string;
  value: string;
}
interface ParityTraceResponse {
  action: ParityBlockReward | ParityCall;
  blockHash: string;
  blockNumber: number;
  result?: { gasUsed: string; output: string };
  subtraces: number;
  traceAddress: [];
  transactionHash?: string;
  transactionPosition?: number;
  type: 'reward' | 'call';
}

export class ETHStateProvider extends InternalStateProvider implements CSP.IChainStateService {
  config: any;

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  getWeb3(network: string) {
    const networkConfig = this.config[network];
    const provider = networkConfig.provider;
    const portString = provider.port ? `:${provider.port}` : '';
    const connUrl = `${provider.protocool}://${provider.host}${portString}`;
    let ProviderType;
    switch (provider.protocool) {
      case 'wss':
        ProviderType = Web3.providers.WebsocketProvider;
        break;
      default:
        ProviderType = Web3.providers.HttpProvider;
        break;
    }
    return new Web3(new ProviderType(connUrl));
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    const balance = Number(await this.getWeb3(network).eth.getBalance(address));
    return { confirmed: balance, unconfirmed: 0, balance };
  }

  async getBlock(params: CSP.GetBlockParams) {
    const { network, blockId } = params;
    return this.getWeb3(network).eth.getBlock(Number(blockId)) as any;
  }

  async getTransaction(params: CSP.StreamTransactionParams) {
    const { network, txId } = params;
    const transaction = await this.getWeb3(network).eth.getTransaction(txId);
    return transaction as any;
  }

  async streamWalletTransactions(params: CSP.StreamWalletTransactionsParams) {
    const { network, wallet, req, res } = params;

    const web3 = this.getWeb3(network);

    function scan(fromHeight: number, toHeight: number, address: string) {
      return new Promise<Array<ParityTraceResponse>>(resolve =>
        web3.eth.currentProvider.send(
          {
            method: 'trace_filter',
            params: [
              {
                fromBlock: web3.utils.toHex(fromHeight),
                toBlock: web3.utils.toHex(toHeight),
                toAddress: [address.toLowerCase()]
              }
            ],
            jsonrpc: '2.0',
            id: 0
          },
          (_, data) => resolve(data.result as Array<ParityTraceResponse>)
        )
      );
    }

    async function* getTransactionsForAddress(address: string) {
      const txs = await scan(0, 100000, address);
      for (const tx of txs) {
        yield {
          id: null,
          txid: tx.transactionHash,
          fee: tx.result ? tx.result.gasUsed : null,
          category: 'receive',
          satoshis: tx.action.value,
          height: tx.blockNumber,
          address,
          outputIndex: tx.result ? tx.result.output : null
        };
      }
    }

    const addresses = await this.getWalletAddresses(wallet._id!);

    Storage.stream(
      new Readable({
        objectMode: true,
        read: async function() {
          for (const walletAddress of addresses) {
            const transactions = await getTransactionsForAddress(walletAddress.address);
            for await (const tx of transactions) {
              console.log(tx);
              this.push(tx);
            }
          }
          this.push(null);
        }
      }),
      req,
      res
    );
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    const { network, rawTx } = params;
    const tx = await this.getWeb3(network).eth.sendSignedTransaction(rawTx);
    return tx;
  }

  async getTransactionCount(params: { network: string; address: string }) {
    const { network, address } = params;
    const txCount = await this.getWeb3(network).eth.getTransactionCount(address);
    return txCount;
  }

  async getWalletAddresses(walletId: ObjectID) {
    let query = { chain: this.chain, wallet: walletId };
    return WalletAddressStorage.collection
      .find(query)
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
  }

  async getWalletBalance(params: CSP.GetWalletBalanceParams) {
    const { network } = params;
    if (params.wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(params.wallet._id);
    let addressBalancePromises = addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address })
    );
    let addressBalances = await Promise.all<{ confirmed: number; unconfirmed: number; balance: number }>(
      addressBalancePromises
    );
    let balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: prev.unconfirmed + cur.unconfirmed,
        confirmed: prev.confirmed + cur.confirmed,
        balance: prev.balance + cur.balance
      }),
      { unconfirmed: 0, confirmed: 0, balance: 0 }
    );
    return balance;
  }
}
