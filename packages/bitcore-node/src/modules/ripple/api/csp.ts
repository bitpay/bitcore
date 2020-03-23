import request from 'request';
import { RippleAPI } from 'ripple-lib';
import { FormattedLedger } from 'ripple-lib/dist/npm/ledger/parse/ledger';
import { FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';
import { Readable } from 'stream';
import Config from '../../../config';
import { IBlock } from '../../../models/baseBlock';
import { ICoin } from '../../../models/coin';
import { InternalStateProvider } from '../../../providers/chain-state/internal/internal';
import { Storage } from '../../../services/storage';
import { ChainNetwork } from '../../../types/ChainNetwork';
import { GetBlockParams } from '../../../types/namespaces/ChainStateProvider';
import {
  BroadcastTransactionParams,
  GetBalanceForAddressParams,
  GetBlockBeforeTimeParams,
  GetEstimateSmartFeeParams,
  GetWalletBalanceParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamTransactionParams,
  StreamTransactionsParams,
  StreamWalletTransactionsParams
} from '../../../types/namespaces/ChainStateProvider';
import { RippleWalletTransactions } from './transform';
import { SingleOutputTx, SubmitResponse } from './types';

export class RippleStateProvider extends InternalStateProvider implements IChainStateService {
  config: any;
  static clients: { [network: string]: RippleAPI } = {};

  constructor(public chain: string = 'XRP') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  async getClient(network: string) {
    try {
      if (RippleStateProvider.clients[network]) {
        await RippleStateProvider.clients[network].getLedger();
      }
    } catch (e) {
      delete RippleStateProvider.clients[network];
    }
    if (!RippleStateProvider.clients[network]) {
      const networkConfig = this.config[network];
      const provider = networkConfig.provider;
      const host = provider.host || 'localhost';
      const protocol = provider.protocol || 'wss';
      const portString = provider.port;
      const connUrl = portString ? `${protocol}://${host}:${portString}` : `${protocol}://${host}`;
      RippleStateProvider.clients[network] = new RippleAPI({ server: connUrl });
      await RippleStateProvider.clients[network].connect();
    }
    return RippleStateProvider.clients[network];
  }

  async getAccountNonce(network: string, address: string) {
    const client = await this.getClient(network);
    try {
      const { sequence } = await client.getAccountInfo(address);
      return sequence;
    } catch (err) {
      throw err;
    }
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams) {
    const client = await this.getClient(params.network);
    try {
      const info = await client.getAccountInfo(params.address);
      const confirmed = Number(info.xrpBalance) * 1e6;
      const balance = confirmed;
      const unconfirmed = 0;
      return { confirmed, unconfirmed, balance };
    } catch (e) {
      if (e && e.data && e.data.error_code === 19) {
        // Error code for when we have derived an address,
        // but the account has not yet been funded
        return {
          confirmed: 0,
          unconfirmed: 0,
          balance: 0
        };
      }
      throw e;
    }
  }

  async getBlock(params: GetBlockParams) {
    const client = await this.getClient(params.network);
    const isHash = params.blockId && params.blockId.length == 64;
    const query = isHash ? { ledgerHash: params.blockId } : { ledgerVersion: Number(params.blockId) };
    const ledger = await client.getLedger({ includeTransactions: true, ...query });
    return this.transformLedger(ledger, params.network);
  }

  async getBlockBeforeTime(params: GetBlockBeforeTimeParams) {
    const { network, time } = params;
    const date = new Date(time || Date.now()).toISOString();
    const ledger = await new Promise((resolve, reject) => {
      const url = this.config[network].provider.dataHost + '/v2/ledgers/' + date;
      request.get({ url, json: true }, (err, _, body) => {
        if (err) {
          return reject(err);
        } else {
          return resolve({
            ...body.ledger,
            chain: this.chain,
            network,
            hash: body.ledger.ledger_hash,
            height: body.ledger.ledger_index,
            previousBlockHash: body.ledger.parent_hash,
            timeNormalized: new Date(body.ledger.close_time * 1000)
          });
        }
      });
    });
    return ledger as IBlock;
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    const { network, target } = params;
    const client = await this.getClient(network);
    const fee = await client.getFee();
    const scaledFee = parseFloat(fee) * 1e6;
    return { feerate: scaledFee, blocks: target };
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    const client = await this.getClient(params.network);
    const rawTxs = typeof params.rawTx === 'string' ? [params.rawTx] : params.rawTx;
    const txids = new Array<string>();
    for (const tx of rawTxs) {
      const resp = (await client.submit(tx)) as SubmitResponse;
      txids.push(resp.tx_json.hash);
    }
    return txids.length === 1 ? txids[0] : txids;
  }

  async getWalletBalance(params: GetWalletBalanceParams) {
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

  async getAddressTransactions(params: StreamAddressUtxosParams) {
    const client = await this.getClient(params.network);
    const serverInfo = await client.getServerInfo();
    const ledgers = serverInfo.completeLedgers.split('-');
    const minLedgerVersion = Number(ledgers[0]);
    const maxLedgerVersion = Number(ledgers[1]);
    const txs = await client.getTransactions(params.address, {
      ...(params.args.startTx && { start: params.args.startTx }),
      minLedgerVersion,
      maxLedgerVersion,
      limit: Number(params.args.limit) || 100,
      binary: false
    });
    return txs;
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    const readable = new Readable({ objectMode: true });
    const txs = await this.getAddressTransactions(params);
    const transformed = txs.map(tx => this.transform(tx, params.network));
    this.streamTxs(transformed, readable);
    readable.push(null);
    Storage.stream(readable, params.req, params.res);
  }

  async streamTransactions(params: StreamTransactionsParams) {
    const client = await this.getClient(params.network);
    let { blockHash } = params.args;
    const ledger = await client.getLedger({ includeTransactions: true, ledgerHash: blockHash });
    const readable = new Readable({ objectMode: true });
    const txs = ledger.transactions || [];
    this.streamTxs(txs, readable);
    readable.push(null);
    Storage.stream(readable, params.req, params.res);
  }

  async getTransaction(params: StreamTransactionParams) {
    const client = await this.getClient(params.network);
    try {
      const tx = await client.getTransaction(params.txId);
      return tx;
    } catch (e) {
      return undefined;
    }
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams) {
    const addresses = await this.getWalletAddresses(params.wallet._id!);
    const readable = new Readable({ objectMode: true });
    const promises = new Array<Promise<FormattedTransactionType[]>>();
    params.args.limit = 500;
    for (const walletAddress of addresses) {
      promises.push(this.getAddressTransactions({ ...params, address: walletAddress.address }));
    }
    const allTxs = (await Promise.all(promises))
      .reduce((agg, txs) => agg.concat(txs), new Array<FormattedTransactionType>())
      .sort((tx1, tx2) => tx1.outcome.ledgerVersion - tx2.outcome.ledgerVersion);
    const transformed = readable.pipe(new RippleWalletTransactions(params.wallet, this));
    this.streamTxs(allTxs, readable);
    readable.push(null);
    transformed.pipe(params.res);
  }

  async getLocalTip(params: ChainNetwork) {
    const client = await this.getClient(params.network);
    const ledger = await client.getLedger();
    return this.transformLedger(ledger, params.network);
  }

  transformLedger(ledger: FormattedLedger, network: string): IBlock {
    const txs = ledger.transactions || [];
    return {
      chain: this.chain,
      network,
      confirmations: -1,
      hash: ledger.ledgerHash,
      height: ledger.ledgerVersion,
      previousBlockHash: ledger.parentLedgerHash,
      processed: true,
      time: new Date(ledger.closeTime),
      timeNormalized: new Date(ledger.closeTime),
      reward: 0,
      size: txs.length,
      transactionCount: txs.length,
      nextBlockHash: ''
    };
  }

  transform(tx: SingleOutputTx | FormattedTransactionType, network: string) {
    if (tx.type === 'payment' && 'outcome' in tx) {
      return {
        network,
        chain: this.chain,
        txid: tx.id,
        blockHash: (tx as any).ledger_hash || '',
        blockHeight: tx.outcome.ledgerVersion || -1,
        blockTime: new Date(tx.outcome.timestamp!),
        blockTimeNormalized: new Date(tx.outcome.timestamp!),
        value: Number(tx.outcome.deliveredAmount ? tx.outcome.deliveredAmount.value : 0),
        fee: Number(tx.outcome.fee),
        wallets: []
      };
    } else if (
      'transaction' in tx &&
      'Amount' in tx.transaction &&
      typeof tx.transaction.Amount === 'string' &&
      tx.type === 'transaction' &&
      tx.transaction.TransactionType === 'Payment' &&
      tx.transaction.Destination
    ) {
      return {
        network,
        chain: this.chain,
        txid: tx.transaction.hash,
        blockHash: (tx as any).ledger_hash || '',
        blockHeight: tx.ledger_index || -1,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
        value: Number(tx.transaction.Amount),
        fee: Number(tx.transaction.Fee),
        wallets: []
      };
    } else {
      return tx as FormattedTransactionType;
    }
  }

  transformToCoins(tx: SingleOutputTx | FormattedTransactionType, network: string) {
    if ('outcome' in tx && tx.type === 'payment') {
      const changes = tx.outcome.balanceChanges;
      const coins: Array<Partial<ICoin>> = Object.entries(changes).map(([k, v]) => {
        const coin: Partial<ICoin> = {
          chain: this.chain,
          network,
          address: k,
          value: Number(v[0].value),
          coinbase: false,
          mintHeight: tx.outcome.ledgerVersion || -1,
          mintIndex: tx.outcome.indexInLedger,
          mintTxid: tx.id,
          wallets: []
        };
        return coin;
      });
      return coins;
    } else if (
      'transaction' in tx &&
      'Amount' in tx.transaction &&
      typeof tx.transaction.Amount === 'string' &&
      tx.type === 'transaction' &&
      tx.transaction.TransactionType === 'Payment' &&
      tx.transaction.Destination
    ) {
      const coin = {
        chain: this.chain,
        network,
        address: tx.transaction.Destination,
        value: Number(tx.transaction.Amount),
        coinbase: false,
        mintHeight: tx.validated ? tx.ledger_index : -1,
        mintIndex: tx.transaction.Sequence,
        mintTxid: tx.transaction.hash,
        wallets: []
      } as Partial<ICoin>;
      return [coin];
    } else {
      return tx;
    }
  }
}

export const XRP = new RippleStateProvider();
