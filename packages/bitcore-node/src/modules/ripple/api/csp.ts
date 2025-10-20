import { CryptoRpc } from 'crypto-rpc';
import { ObjectId } from 'mongodb';
import request from 'request';
import { Readable } from 'stream';
import util from 'util';
import { AccountTxRequest, AccountTxResponse } from 'xrpl/dist/npm/models';
import { Ledger } from 'xrpl/dist/npm/models/ledger';
import {
  CheckCreate,
  Payment,
  TransactionMetadata
} from 'xrpl/dist/npm/models/transactions';
import { Node } from 'xrpl/dist/npm/models/transactions/metadata';
import Config from '../../../config';
import logger from '../../../logger';
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
  GetWalletBalanceAtTimeParams,
  GetWalletBalanceParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamTransactionParams,
  StreamTransactionsParams
} from '../../../types/namespaces/ChainStateProvider';
import { GetBlockParams } from '../../../types/namespaces/ChainStateProvider';
import { XrpBlockStorage } from '../models/block';
import { AccountTransaction, BlockTransaction, IXrpTransaction, RpcTransaction } from '../types';
import { RippleDbWalletTransactions } from './wallet-tx-transform';


export class RippleStateProvider extends InternalStateProvider implements IChainStateService {
  config: any;
  static clients: { [network: string]: CryptoRpc } = {};

  constructor(public chain: string = 'XRP') {
    super(chain, RippleDbWalletTransactions);
    this.config = Config.chains[this.chain];
  }

  async getClient(network: string) {
    if (!RippleStateProvider.clients[network]) {
      const networkConfig = this.config[network];
      const provider = networkConfig.provider;
      RippleStateProvider.clients[network] = new CryptoRpc({
          chain: this.chain,
          host: provider.host,
          rpcPort: provider.port,
          protocol: provider.protocol 
        }).get(this.chain);
      await RippleStateProvider.clients[network].rpc.connect();
    }

    try {
      if (RippleStateProvider.clients[network].rpc.isConnected()) {
        await RippleStateProvider.clients[network].getBlock();
      } else {
        await RippleStateProvider.clients[network].rpc.connect();
      }
    } catch (e) {
      await RippleStateProvider.clients[network].rpc.connect();
    }
    return RippleStateProvider.clients[network];
  }

  async getAccountNonce(network: string, address: string) {
    const client = await this.getClient(network);
    try {
      const info = await client.getAccountInfo({ address });
      return info?.account_data?.Sequence;
    } catch (err) {
      throw err;
    }
  }

  async getAccountFlags(network: string, address: string) {
    const client = await this.getClient(network);
    try {
      const info = await client.getAccountInfo({ address });
      return info?.account_flags;
    } catch (err) {
      throw err;
    }
  }

  async getWalletBalanceAtTime(params: GetWalletBalanceAtTimeParams) {
    const { chain, network, time } = params;
    const addresses = await this.getWalletAddresses(params.wallet._id!);
    const balances = await Promise.all(
      addresses.map(a => this.getBalanceForAddress({ address: a.address, chain, network, args: { time } }))
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

  async getBalanceForAddress(params: GetBalanceForAddressParams) {
    const { chain, network, address, args } = params;
    const lowerAddress = address.toLowerCase();
    const cacheKey = `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const client = await this.getClient(network);
        try {
          let ledgerIndex: number | undefined;
          if (args?.time) {
            const block = await this.getBlockBeforeTime({ chain, network, time: args.time });
            if (!block) {
              throw new Error(`Balance not found at ${args.time}`);
            }
            ledgerIndex = block.height;
          }
          const balance = await client.getBalance({ address, ledgerIndex });
          const confirmed = Math.round(Number(balance) * 1e6);
          return { confirmed, unconfirmed: 0, balance: confirmed };
        } catch (e: any) {
          if (e?.data?.error_code === 19) {
            // Error code for when we have derived an address,
            // but the account has not yet been funded
            return {
              confirmed: 0,
              unconfirmed: 0,
              balance: 0
            };
          }
          logger.error(`Error getting XRP balance for ${address} on ${network}: ${JSON.stringify(e.data) || e.stack || e.message || e}`);
          throw e;
        }
      },
      args?.time ? CacheStorage.Times.None : CacheStorage.Times.Minute
    );
  }

  async getBlock(params: GetBlockParams) {
    const client = await this.getClient(params.network);
    const isHash = params.blockId && params.blockId.length == 64;
    const query = isHash ? { hash: params.blockId } : { index: Number(params.blockId) };
    const { ledger } = await client.getBlock(query);
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

    return this.transformLedger(ledger, network);
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
        const fee = await client.estimateFee();
        return { feerate: parseFloat(fee), blocks: target };
      },
      CacheStorage.Times.Minute
    );
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    const client = await this.getClient(params.network);
    const rawTxs = typeof params.rawTx === 'string' ? [params.rawTx] : params.rawTx;
    const txids = new Array<string>();
    for (const tx of rawTxs) {
      const hash = (await client.sendRawTransaction({ rawTx: tx }));
      txids.push(hash);
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
    const ledgers = serverInfo.complete_ledgers.split('-');
    const minLedgerIndex = Number(ledgers[0]);
    let allTxs: AccountTxResponse['result']['transactions'] = [];
    let limit = Number(limitArg) || 100;
    const options = {
      ledger_index_min: minLedgerIndex,
      limit,
      binary: false
    } as AccountTxRequest;
    if (startTx) {
      const tx = await client.getTransaction({ txid: startTx });
      options.ledger_index_min = Math.max(Number(tx?.ledger_index), minLedgerIndex);
      options.forward = true;
    }
    let txs: AccountTxResponse['result'] = await client.getTransactions({ address: params.address, options });
    if (startTx) {
      const startTxIdx = txs.transactions.findIndex(tx => tx.tx?.hash === startTx);
      if (startTxIdx > -1) {
        txs.transactions = txs.transactions.slice(startTxIdx + 1);
      }
    }
    allTxs.push(...txs.transactions);
    while (txs.marker) {
      txs = await client.getTransactions({ address: params.address, options: {
        marker: txs.marker,
        limit,
        binary: false
      }});
      allTxs.push(...txs.transactions);
    }
    return allTxs;
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    const readable = new Readable({ objectMode: true });
    const txs = await this.getAddressTransactions(params);
    const transformed = txs.map(tx => this.transformAccountTx(tx, params.network));
    this.streamTxs(transformed, readable);
    readable.push(null);
    Storage.stream(readable, params.req!, params.res!);
  }

  async streamTransactions(params: StreamTransactionsParams) {
    const client = await this.getClient(params.network);
    let { blockHash } = params.args;
    const { ledger } = await client.getBlock({ hash: blockHash, transactions: true });
    const readable = new Readable({ objectMode: true });
    const txs = ledger.transactions || [];
    this.streamTxs(txs, readable);
    readable.push(null);
    Storage.stream(readable, params.req, params.res);
  }

  async getTransaction(params: StreamTransactionParams) {
    const client = await this.getClient(params.network);
    try {
      const tx = await client.getTransaction({ txid: params.txId });
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

  transformLedger(ledger: Ledger, network: string): IBlock {
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

  transform(tx: BlockTransaction | RpcTransaction, network: string, block?: IBlock): IXrpTransaction {
    const date = block?.time ? new Date(block?.time) : this.getDateFromRippleTime((tx as RpcTransaction).date) || '';
    const metaData: TransactionMetadata = (tx as BlockTransaction).metaData || (tx as RpcTransaction).meta;
    const value = metaData.delivered_amount ??
      metaData.DeliveredAmount ??
      (tx as Payment).Amount ??
      0;

    return {
      network,
      chain: this.chain,
      txid: tx.hash,
      from: tx.Account,
      blockHash: block?.hash || '',
      blockHeight: block?.height || (tx as RpcTransaction).ledger_index,
      blockTime: date,
      blockTimeNormalized: date,
      value: Number(value),
      fee: Number(tx.Fee ?? 0),
      nonce: Number(tx.Sequence),
      destinationTag: (tx as Payment).DestinationTag,
      to: (tx as Payment).Destination,
      currency: undefined, // TODO
      invoiceID: (tx as CheckCreate).InvoiceID,
      wallets: []
    } as IXrpTransaction;
  }

  transformAccountTx(tx: AccountTransaction, network: string): IXrpTransaction {
    const date = this.getDateFromRippleTime(tx.tx?.date) || '';
    const value = Number((tx.meta as TransactionMetadata).DeliveredAmount ?? (tx.meta as TransactionMetadata).delivered_amount ?? 0);

    return {
      network,
      chain: this.chain,
      txid: tx.tx?.hash,
      from: tx.tx?.Account,
      blockHash: (tx as any).ledger_hash || '', // TODO: ledger_hash is not a property of AccountTransaction
      blockHeight: tx.tx?.ledger_index,
      blockTime: date,
      blockTimeNormalized: date,
      value: Number(value),
      fee: Number(tx.tx?.Fee ?? 0),
      nonce: Number(tx.tx?.Sequence),
      destinationTag: (tx.tx as Payment).DestinationTag,
      to: (tx.tx as Payment).Destination,
      currency: undefined, // TODO
      invoiceID: (tx.tx as CheckCreate).InvoiceID,
      wallets: []
    } as IXrpTransaction;

  }

  transformToCoins(tx: BlockTransaction | AccountTransaction | RpcTransaction, network: string, block?: IBlock): Array<Partial<ICoin>> {
    const coins: Partial<ICoin>[] = [];
    const mintTxid = (tx as BlockTransaction).hash || (tx as AccountTransaction).tx?.hash || (tx as RpcTransaction).hash;
    const metaData = (tx as BlockTransaction).metaData || (tx as AccountTransaction).meta as TransactionMetadata || (tx as RpcTransaction).meta as TransactionMetadata;

    if (!metaData.AffectedNodes?.length) {
      return coins;
    }
    const nodes: Node[] = metaData.AffectedNodes || [];
    for (const node of nodes) {
      if ('ModifiedNode' in node && node.ModifiedNode.FinalFields) {
        const address = node.ModifiedNode.FinalFields.Account;
        const value = Number(node.ModifiedNode.FinalFields.Balance) - Number(node.ModifiedNode.PreviousFields?.Balance);
        const coin = {
          chain: this.chain,
          network,
          address,
          value,
          coinbase: false,
          mintHeight: block?.height,
          mintIndex: nodes.indexOf(node),
          mintTxid,
          wallets: []
        } as Partial<ICoin>;
        coins.push(coin);
      } else if ('CreatedNode' in node) {
        const address = node.CreatedNode.NewFields.Account;
        const value = Number(node.CreatedNode.NewFields.Balance);
        const coin = {
          chain: this.chain,
          network,
          address,
          value,
          coinbase: false,
          mintHeight: block?.height,
          mintIndex: nodes.indexOf(node),
          mintTxid,
          wallets: []
        } as Partial<ICoin>;
        coins.push(coin);
      } else if ('DeletedNode' in node) {
        const address = node.DeletedNode.FinalFields.Account;
        const value = -1 * Number(node.DeletedNode.FinalFields.Balance);
        const coin = {
          chain: this.chain,
          network,
          address,
          value,
          coinbase: false,
          mintHeight: block?.height,
          mintIndex: nodes.indexOf(node),
          mintTxid,
          wallets: []
        } as Partial<ICoin>;
        coins.push(coin);
      }
    }
    return coins;
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

  async getReserve(network: string) {
    const client = await this.getClient(network);
    const info = await client.getServerInfo();
    return info.validated_ledger.reserve_base_xrp * 1e6;
  }

  getDateFromRippleTime(rippleTime?: number) {
    if (rippleTime == null) {
      return null;
    }
    // the ripple epoch is 2000-01-01
    return new Date(new Date('2000-01-01').getTime() + rippleTime * 1000);
  
  }
}

export const XRP = new RippleStateProvider();
