import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { InternalStateProvider } from '../../../providers/chain-state/internal/internal';
import { RippleAPI } from 'ripple-lib';
import { Readable } from 'stream';
import { Storage } from '../../../services/storage';
import { ChainNetwork } from '../../../types/ChainNetwork';
import Config from '../../../config';
import { FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';

export class RippleStateProvider extends InternalStateProvider implements CSP.IChainStateService {
  config: any;
  static client?: RippleAPI;

  constructor(public chain: string = 'XRP') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  async getClient(network: string) {
    try {
      if (RippleStateProvider.client) {
        await RippleStateProvider.client.getLedger();
      }
    } catch (e) {
      RippleStateProvider.client = undefined;
    }
    if (!RippleStateProvider.client) {
      const networkConfig = this.config[network];
      const provider = networkConfig.provider;
      const host = provider.host || 'localhost';
      const protocol = provider.protocol || 'wss';
      const portString = provider.port;
      const connUrl = portString ? `${protocol}://${host}:${portString}` : `${protocol}://${host}`;
      RippleStateProvider.client = new RippleAPI({ server: connUrl });
      await RippleStateProvider.client.connect();
    }
    return RippleStateProvider.client;
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const client = await this.getClient(params.network);
    const info = await client.getAccountInfo(params.address);
    const confirmed = Number(info.xrpBalance);
    const balance = confirmed;
    const unconfirmed = 0;
    return { confirmed, unconfirmed, balance };
  }

  async getBlock(params: CSP.GetBlockParams) {
    const client = await this.getClient(params.network);
    const ledger = await client.getLedger({ includeTransactions: true, ledgerHash: params.blockId });
    return ledger as any;
  }

  async getFee(params: CSP.GetEstimateSmartFeeParams) {
    const client = await this.getClient(params.network);
    const fee = await client.getFee();
    return fee;
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    const client = await this.getClient(params.network);
    return client.submit(params.rawTx);
  }

  async getWalletBalance(params: CSP.GetWalletBalanceParams) {
    const { chain, network } = params;
    const addresses = await this.getWalletAddresses(params.wallet._id!);
    const balances = await Promise.all(
      addresses.map(a => this.getBalanceForAddress({ address: a.address, chain, network, args: {} }))
    );
    return balances.reduce(
      (total, current) => {
        total.balance += current.balance;
        total.confirmed += current.confirmed;
        total.unconfirmed += current.unconfirmed;
        return total;
      },
      { confirmed: 0, unconfirmed: 0, balance: 0 }
    );
  }

  streamTxs<T>(txs: Array<T>, stream: Readable) {
    for (let tx of txs) {
      stream.push(tx);
    }
  }

  async streamAddressTransactions(params: CSP.StreamAddressUtxosParams) {
    const client = await this.getClient(params.network);
    const txs = await client.getTransactions(params.address, {
      start: params.args.startTx,
      limit: params.args.limit || 100,
      binary: false
    });
    const readable = new Readable({ objectMode: true, read: () => {} });
    this.streamTxs(txs, readable);
    readable.push(null);
    Storage.stream(readable, params.req, params.res);
  }

  async streamTransactions(params: CSP.StreamTransactionsParams) {
    const client = await this.getClient(params.network);
    let { blockHash } = params.args;
    const ledger = await client.getLedger({ includeTransactions: true, ledgerHash: blockHash });
    const readable = new Readable({ objectMode: true, read: () => {} });
    const txs = ledger.transactions || [];
    this.streamTxs(txs, readable);
    readable.push(null);
    Storage.stream(readable, params.req, params.res);
  }

  async getTransaction(params: CSP.StreamTransactionParams) {
    const client = await this.getClient(params.network);
    const tx = await client.getTransaction(params.txId);
    return tx;
  }

  async streamWalletTransactions(params: CSP.StreamWalletTransactionsParams) {
    const client = await this.getClient(params.network);
    const addresses = await this.getWalletAddresses(params.wallet._id!);
    const readable = new Readable({ objectMode: true, read: () => {} });
    const promises = new Array<Promise<FormattedTransactionType[]>>();
    for (const walletAddress of addresses) {
      promises.push(client.getTransactions(walletAddress.address));
    }
    const allTxs = await Promise.all(promises);
    for (let txs of allTxs) {
      this.streamTxs(txs, readable);
    }
    readable.push(null);
    Storage.stream(readable, params.req, params.res);
  }

  async getLocalTip(params: ChainNetwork) {
    const client = await this.getClient(params.network);
    const ledger = await client.getLedger();
    return ledger;
  }
}
