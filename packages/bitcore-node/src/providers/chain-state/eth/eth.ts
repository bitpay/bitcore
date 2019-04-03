import Config from '../../../config';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { InternalStateProvider } from '../internal/internal';
import { ObjectID } from 'mongodb';
import Web3 from 'web3';
import { Storage } from '../../../services/storage';
import { EthTransactionStorage } from '../../../models/transaction/eth/ethTransaction';
import { ITransaction, EthTransactionJSON } from '../../../types/Transaction';

export class ETHStateProvider extends InternalStateProvider implements CSP.IChainStateService {
  config: any;

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  getWeb3(network: string) {
    const networkConfig = this.config[network];
    const provider = networkConfig.provider;
    const host = provider.host || 'localhost';
    const protocol = provider.protocol || 'http';
    const portString = provider.port || '8545';
    const connUrl = `${protocol}://${host}:${portString}`;
    let ProviderType;
    switch (provider.protocol) {
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

  async getTransaction(params: CSP.StreamTransactionParams) {
    try {
      let { chain, network, txId } = params;
      if (typeof txId !== 'string' || !chain || !network) {
        throw 'Missing required param';
      }
      network = network.toLowerCase();
      let query = { chain: chain, network, txid: txId };
      const tip = await this.getLocalTip(params);
      const tipHeight = tip ? tip.height : 0;
      const found = await EthTransactionStorage.collection.findOne(query);
      if (found) {
        let confirmations = 0;
        if (found.blockHeight && found.blockHeight >= 0) {
          confirmations = tipHeight - found.blockHeight + 1;
        }
        const convertedTx = EthTransactionStorage._apiTransform(found, { object: true }) as EthTransactionJSON;
        return { ...convertedTx, confirmations: confirmations };
      } else {
        return undefined;
      }
    } catch (err) {
      console.error(err);
    }
    return undefined;
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    const { network, rawTx } = params;
    const tx = await this.getWeb3(network).eth.sendSignedTransaction(rawTx);
    return tx;
  }

  async getWalletAddresses(walletId: ObjectID) {
    let query = { chain: this.chain, wallet: walletId };
    return WalletAddressStorage.collection
      .find(query)
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
  }

  async streamTransactions(params: CSP.StreamTransactionsParams) {
    const { chain, network, req, res, args } = params;
    let { blockHash, blockHeight } = args;
    if (!chain || !network) {
      throw 'Missing chain or network';
    }
    let query: any = {
      chain: chain,
      network: network.toLowerCase()
    };
    if (blockHeight !== undefined) {
      query.blockHeight = Number(blockHeight);
    }
    if (blockHash !== undefined) {
      query.blockHash = blockHash;
    }
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    return Storage.apiStreamingFind(EthTransactionStorage, query, args, req, res, t => {
      let confirmations = 0;
      if (t.blockHeight !== undefined && t.blockHeight >= 0) {
        confirmations = tipHeight - t.blockHeight + 1;
      }
      const convertedTx = EthTransactionStorage._apiTransform(t, { object: true }) as Partial<ITransaction>;
      return JSON.stringify({ ...convertedTx, confirmations: confirmations });
    });
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
