import { ObjectId } from 'mongodb';
import request from 'request';
import { RippleAPI } from 'ripple-lib';
import { FormattedLedger } from 'ripple-lib/dist/npm/ledger/parse/ledger';
import { FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';
import { Readable } from 'stream';
import util from 'util';
import Config from '../../../config';
import { CacheStorage } from '../../../models/cache';
import { ICoin } from '../../../models/coin';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { InternalStateProvider } from '../../../providers/chain-state/internal/internal';
import { Storage } from '../../../services/storage';
import { IBlock } from '../../../types/Block';
import { ChainNetwork } from '../../../types/ChainNetwork';
import {
  BroadcastTransactionParams,
  GetBalanceForAddressParams,
  GetBlockBeforeTimeParams,
  GetEstimateSmartFeeParams,
  GetWalletBalanceParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamTransactionParams,
  StreamTransactionsParams
} from '../../../types/namespaces/ChainStateProvider';
import { GetBlockParams } from '../../../types/namespaces/ChainStateProvider';
import { XrpBlockStorage } from '../models/block';
import { IXrpTransaction } from '../types';
import { SingleOutputTx, SubmitResponse } from './types';
import { RippleDbWalletTransactions } from './wallet-tx-transform';

export class RippleStateProvider extends InternalStateProvider implements IChainStateService {
  config: any;
  static clients: { [network: string]: RippleAPI } = {};

  constructor(public chain: string = 'XRP') {
    super(chain, RippleDbWalletTransactions);
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
    const { chain, network, address } = params;
    const lowerAddress = address.toLowerCase();
    const cacheKey = `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const client = await this.getClient(network);
        try {
          const info = await client.getAccountInfo(address);
          const confirmed = Math.round(Number(info.xrpBalance) * 1e6);
          const balance = confirmed;
          const unconfirmed = 0;
          return { confirmed, unconfirmed, balance };
        } catch (e: any) {
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
      },
      CacheStorage.Times.Minute
    );
  }

  async getBlock(params: GetBlockParams) {
    const client = await this.getClient(params.network);
    const isHash = params.blockId && params.blockId.length == 64;
    const query = isHash ? { ledgerHash: params.blockId } : { ledgerVersion: Number(params.blockId) };
    const ledger = await client.getLedger({ includeTransactions: true, ...query });
    return this.transformLedger(ledger, params.network);
  }

  async getBlockBeforeTime(params: GetBlockBeforeTimeParams) {
    const { chain, network, time = Date.now() } = params;
    const date = new Date(Math.min(new Date(time).getTime(), new Date().getTime())); // Date is at the most right now. This prevents excessive loop iterations below.

    if (date.toString() == 'Invalid Date') {
      throw new Error('Invalid time value');
    }

    const [block] = await XrpBlockStorage.collection
      .find({
        chain,
        network,
        timeNormalized: { $lte: date }
      })
      .limit(1)
      .sort({ timeNormalized: -1 })
      .toArray();

    if (!block) {
      return null;
    }

    let ledger = await this.getDataHostLedger(block.height, network);
    if (!ledger) {
      return null;
    }

    // Check if our DB has gaps. `block` might not be the latest block before `date`
    let workingIdx = Number(ledger.ledger_index) + 1; // +1 to check if the next block is < date
    ledger = await this.getDataHostLedger(workingIdx, network);
    while (ledger && new Date(ledger.close_time_human) < date) {
      // a gap exists
      workingIdx = Number(ledger.ledger_index) + 1;
      const timeGap = date.getTime() - new Date(ledger.close_time_human).getTime();
      if (timeGap > 1000 * 60 * 2) { // if more than a 2 min gap...
        workingIdx += Math.floor(timeGap / 10000); // ...jump forward assuming a block every 10 seconds
      }
      ledger = await this.getDataHostLedger(workingIdx, network);
    }

    // the timeGap above might have overshot
    while (!ledger || new Date(ledger.close_time_human) > date) {
      // walk it back
      workingIdx--;
      ledger = await this.getDataHostLedger(workingIdx, network);
    }

    return this.transformRawLedger(ledger, network);
  }

  async getDataHostLedger(index, network) {
    const ledger = await util.promisify(request.post).call(request, {
      url: this.config[network].provider.dataHost,
      json: true,
      body: {
        method: 'ledger',
        params: [
          {
            ledger_index: index,
            transactions: true,
            expand: false
          }
        ]
      }
    });

    if (ledger?.body?.result?.status !== 'success') {
      return null;
    }
    return ledger.body.result.ledger;
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    const { chain, network, target } = params;
    const cacheKey = `getFee-${chain}-${network}-${target}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const client = await this.getClient(network);
        const fee = await client.getFee();
        const scaledFee = parseFloat(fee) * 1e6;
        return { feerate: scaledFee, blocks: target };
      },
      CacheStorage.Times.Minute
    );
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
    const { startTx, limitArg } = params.args;
    const client = await this.getClient(params.network);
    const serverInfo = await client.getServerInfo();
    const ledgers = serverInfo.completeLedgers.split('-');
    const minLedgerVersion = Number(ledgers[0]);
    const maxLedgerVersion = Number(ledgers[1]);
    let allTxs = new Array<FormattedTransactionType>();
    let limit = Number(limitArg) || 100;
    const options = {
      minLedgerVersion,
      maxLedgerVersion,
      limit,
      binary: false
    } as {
      minLedgerVersion?: number,
      maxLedgerVersion?: number,
      limit: number,
      binary: boolean
    };
    if (startTx) {
      options['start'] = params.args.startTx;
      options['earliestFirst'] = true;
      delete options.minLedgerVersion;
      delete options.maxLedgerVersion;
    }
    let txs = await client.getTransactions(params.address, options);
    allTxs.push(...txs);
    while (txs.length === limit) {
      let startTx = txs[txs.length - 1];
      txs = await client.getTransactions(params.address, {
        start: startTx.id,
        limit,
        binary: false
      });
      allTxs.push(...txs);
    }
    return allTxs;
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    const readable = new Readable({ objectMode: true });
    const txs = await this.getAddressTransactions(params);
    const transformed = txs.map(tx => this.transform(tx, params.network));
    this.streamTxs(transformed, readable);
    readable.push(null);
    Storage.stream(readable, params.req!, params.res!);
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

  async getLocalTip(params: ChainNetwork) {
    return XrpBlockStorage.getLocalTip(params);
  }

  async getCoinsForTx() {
    return {
      inputs: [],
      outputs: []
    };
  }

  transformLedger(ledger: FormattedLedger, network: string): IBlock {
    const txs = ledger.transactions || [];
    return {
      chain: this.chain,
      network,
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

  transformRawLedger(ledger: any, network: string): IBlock {
    const txs = ledger.transactions || [];
    return {
      chain: this.chain,
      network,
      hash: ledger.ledger_hash,
      height: Number(ledger.ledger_index),
      previousBlockHash: ledger.parent_hash,
      processed: ledger.closed,
      time: new Date(ledger.close_time_human),
      timeNormalized: new Date(ledger.close_time_human),
      reward: 0,
      size: txs.length,
      transactionCount: txs.length,
      nextBlockHash: ''
    };
  }

  transform(tx: SingleOutputTx | FormattedTransactionType, network: string, block?: IBlock) {
    if (tx.type === 'payment' && 'outcome' in tx) {
      const ledgerDate = block ? block.time : undefined;
      const ledgerHash = block ? block.hash : undefined;
      const ledgerHeight = block ? block.height : undefined;
      const date = (tx.outcome && tx.outcome.timestamp ? tx.outcome.timestamp : ledgerDate) || '';
      const specification = tx.specification;
      const delivered = tx.outcome.deliveredAmount;

      const destinationTag = 'destination' in specification &&
        specification.destination.tag && { destinationTag: specification.destination.tag };

      return {
        network,
        chain: this.chain,
        txid: tx.id,
        from: tx.address,
        blockHash: ledgerHash || (tx as any).ledger_hash || '',
        blockHeight: ledgerHeight || tx.outcome.ledgerVersion || -1,
        blockTime: new Date(date),
        blockTimeNormalized: new Date(date),
        value: Number(delivered ? delivered.value : 0) * 1e6,
        fee: Number(tx.outcome.fee) * 1e6,
        nonce: Number(tx.sequence),
        ...destinationTag,
        ...(delivered && 'currency' in delivered && { currency: delivered.currency }),
        ...('invoiceID' in specification && { invoiceID: specification.invoiceID }),
        ...('destination' in specification && { to: specification.destination.address }),
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
        from: tx.transaction.Account,
        blockHash: (tx as any).ledger_hash || '',
        blockHeight: tx.ledger_index || -1,
        blockTime: new Date(),
        blockTimeNormalized: new Date(),
        value: Number(tx.transaction.Amount) * 1e6,
        fee: Number(tx.transaction.Fee) * 1e6,
        nonce: Number(tx.transaction.Sequence),
        to: tx.transaction.Destination,
        ...(tx.transaction.DestinationTag && { destinationTag: tx.transaction.DestinationTag }),
        ...(tx.transaction.InvoiceID && { invoiceID: tx.transaction.InvoiceID }),
        wallets: []
      };
    } else {
      return tx as FormattedTransactionType;
    }
  }

  transformToCoins(tx: SingleOutputTx | FormattedTransactionType, network: string) {
    if ('outcome' in tx && tx.type === 'payment') {
      const changes = tx.outcome.balanceChanges;
      const coins: Array<Partial<ICoin>> = Object.entries(changes).map(([k, v], index) => {
        const value = Number(v[0].value) * 1e6;
        const coin: Partial<ICoin> = {
          chain: this.chain,
          network,
          address: k,
          value,
          coinbase: false,
          mintHeight: tx.outcome.ledgerVersion || -1,
          mintIndex: index,
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
      const value = Number(tx.transaction.Amount) * 1e6;
      const coin = {
        chain: this.chain,
        network,
        value,
        address: tx.transaction.Destination,
        coinbase: false,
        mintHeight: tx.validated ? tx.ledger_index : -1,
        mintIndex: 0,
        mintTxid: tx.transaction.hash,
        wallets: []
      } as Partial<ICoin>;
      return [coin];
    } else {
      return tx;
    }
  }

  async tag(
    chain: string,
    network: string,
    tx: IXrpTransaction,
    outputs: Array<ICoin> | any
  ): Promise<{ transaction: IXrpTransaction; coins: Array<ICoin> }> {
    const address = tx.from;
    let involvedAddress = [address];
    const transaction = { ...tx, wallets: new Array<ObjectId>() };
    let coins = new Array<ICoin>();
    if (Array.isArray(outputs)) {
      coins = outputs.map(c => {
        return { ...c, wallets: new Array<ObjectId>() };
      });
      involvedAddress.push(...coins.map(c => c.address));
    }
    const walletAddresses = await WalletAddressStorage.collection
      .find({ chain, network, address: { $in: involvedAddress } })
      .toArray();

    if ('chain' in tx) {
      transaction.wallets = walletAddresses.map(wa => wa.wallet);
    }

    if (coins && coins.length) {
      for (const coin of coins) {
        const coinWalletAddresses = walletAddresses.filter(wa => coin.address && wa.address === coin.address);
        if (coinWalletAddresses && coinWalletAddresses.length) {
          coin.wallets = coinWalletAddresses.map(wa => wa.wallet);
        }
      }
    }
    return { transaction, coins };
  }
}

export const XRP = new RippleStateProvider();
