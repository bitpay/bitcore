import { GetBlockBeforeTimeParams, StreamTransactionParams, WalletBalanceType } from '../../../types/namespaces/ChainStateProvider';
import { StreamBlocksParams } from '../../../types/namespaces/ChainStateProvider';

import { Validation } from 'crypto-wallet-core';
import { ObjectId } from 'mongodb';
import { Transform } from 'stream';
import { LoggifyClass } from '../../../decorators/Loggify';
import { MongoBound } from '../../../models/base';
import { BitcoinBlockStorage, IBtcBlock } from '../../../models/block';
import { CacheStorage } from '../../../models/cache';
import { CoinStorage, ICoin } from '../../../models/coin';
import { StateStorage } from '../../../models/state';
import { ITransaction, TransactionStorage } from '../../../models/transaction';
import { IWallet, WalletStorage } from '../../../models/wallet';
import { IWalletAddress, WalletAddressStorage } from '../../../models/walletAddress';
import { RPC } from '../../../rpc';
import { Config } from '../../../services/config';
import { Storage } from '../../../services/storage';
import { IBlock } from '../../../types/Block';
import { CoinJSON, SpentHeightIndicators } from '../../../types/Coin';
import { IUtxoNetworkConfig } from '../../../types/Config';
import {
  BroadcastTransactionParams,
  CreateWalletParams,
  DailyTransactionsParams,
  GetBalanceForAddressParams,
  GetBlockParams,
  GetEstimateSmartFeeParams,
  GetWalletBalanceAtTimeParams,
  GetWalletBalanceParams,
  GetWalletParams,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamTransactionsParams,
  StreamWalletAddressesParams,
  StreamWalletMissingAddressesParams,
  StreamWalletTransactionsParams,
  StreamWalletUtxosParams,
  UpdateWalletParams,
  WalletCheckParams
} from '../../../types/namespaces/ChainStateProvider';
import { TransactionJSON } from '../../../types/Transaction';
import { StringifyJsonStream } from '../../../utils/jsonStream';
import { ListTransactionsStream } from './transforms';

@LoggifyClass
export class InternalStateProvider implements IChainStateService {
  chain: string;
  constructor(chain: string, private WalletStreamTransform = ListTransactionsStream) {
    this.chain = chain;
    this.chain = this.chain.toUpperCase();
  }

  getRPC(chain: string, network: string) {
    const RPC_PEER = (Config.chainConfig({ chain, network }) as IUtxoNetworkConfig).rpc;
    if (!RPC_PEER) {
      throw new Error(`RPC not configured for ${chain} ${network}`);
    }
    const { username, password, host, port } = RPC_PEER;
    return new RPC(username, password, host, port);
  }

  private getAddressQuery(params: StreamAddressUtxosParams) {
    const { chain, network, address, args } = params;
    if (typeof address !== 'string' || !chain || !network) {
      throw new Error('Missing required param');
    }
    const query = { chain, network: network.toLowerCase(), address } as any;
    if (args.unspent) {
      query.spentHeight = { $lt: SpentHeightIndicators.minimum };
    }
    if (args.excludeConflicting) {
      query.mintHeight = { $gt: SpentHeightIndicators.conflicting };
    }
    return query;
  }

  streamAddressUtxos(params: StreamAddressUtxosParams) {
    const { req, res, args } = params;
    const { limit, since } = args;
    const query = this.getAddressQuery(params);
    Storage.apiStreamingFind(CoinStorage, query, { limit, since, paging: '_id' }, req!, res!);
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    const { req, res, args } = params;
    const { limit, since } = args;
    const query = this.getAddressQuery(params);
    Storage.apiStreamingFind(CoinStorage, query, { limit, since, paging: '_id' }, req!, res!);
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams): Promise<WalletBalanceType> {
    const { chain, network, address } = params;
    const query = {
      chain,
      network,
      address,
      spentHeight: { $lt: SpentHeightIndicators.minimum },
      mintHeight: { $gt: SpentHeightIndicators.conflicting }
    };
    let balance = await CoinStorage.getBalance({ query });
    return balance;
  }

  streamBlocks(params: StreamBlocksParams) {
    const { req, res } = params;
    const { query, options } = this.getBlocksQuery(params);
    Storage.apiStreamingFind(BitcoinBlockStorage, query, options, req, res);
  }

  async getBlocks(params: GetBlockParams): Promise<Array<IBlock>> {
    const { query, options } = this.getBlocksQuery(params);
    let cursor = BitcoinBlockStorage.collection.find(query, options).addCursorFlag('noCursorTimeout', true);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    let blocks = await cursor.toArray();
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    const blockTransform = (b: IBtcBlock) => {
      let confirmations = 0;
      if (b.height > -1) {
        confirmations = tipHeight - b.height + 1;
      }
      const convertedBlock = BitcoinBlockStorage._apiTransform(b, { object: true }) as IBtcBlock;
      return { ...convertedBlock, confirmations };
    };
    return blocks.map(blockTransform);
  }

  protected getBlocksQuery(params: GetBlockParams | StreamBlocksParams) {
    const { chain, network, sinceBlock, blockId, args = {} } = params;
    let { startDate, endDate, date, since, direction, paging } = args;
    let { limit = 10, sort = { height: -1 } } = args;
    let options = { limit, sort, since, direction, paging };
    if (!chain || !network) {
      throw new Error('Missing required param');
    }
    let query: any = {
      chain,
      network: network.toLowerCase(),
      processed: true
    };
    if (blockId) {
      if (blockId.length >= 64) {
        query.hash = blockId;
      } else {
        let height = parseInt(blockId, 10);
        if (Number.isNaN(height) || height.toString(10) !== blockId) {
          throw new Error('invalid block id provided');
        }
        query.height = height;
      }
    }
    if (sinceBlock) {
      let height = Number(sinceBlock);
      if (Number.isNaN(height) || height.toString(10) !== sinceBlock) {
        throw new Error('invalid block id provided');
      }
      query.height = { $gt: height };
    }
    if (startDate) {
      query.time = { $gt: new Date(startDate) };
    }
    if (endDate) {
      query.time = Object.assign({}, query.time, { $lt: new Date(endDate) });
    }
    if (date) {
      let firstDate = new Date(date);
      let nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      query.time = { $gt: firstDate, $lt: nextDate };
    }
    return { query, options };
  }

  async getBlock(params: GetBlockParams) {
    const blocks = await this.getBlocks(params);
    return blocks[0];
  }

  async getBlockBeforeTime(params: GetBlockBeforeTimeParams): Promise<IBlock|null> {
    const { chain, network, time } = params;
    const date = new Date(time || Date.now());
    const [block] = await BitcoinBlockStorage.collection
      .find({
        chain,
        network,
        timeNormalized: { $lte: date }
      })
      .limit(1)
      .sort({ timeNormalized: -1 })
      .toArray();
    return block;
  }

  async streamTransactions(params: StreamTransactionsParams) {
    const { chain, network, req, res, args } = params;
    let { blockHash, blockHeight } = args;
    if (!chain || !network) {
      throw new Error('Missing chain or network');
    }
    let query: any = {
      chain,
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
    return Storage.apiStreamingFind(TransactionStorage, query, args, req, res, t => {
      let confirmations = 0;
      if (t.blockHeight !== undefined && t.blockHeight >= 0) {
        confirmations = tipHeight - t.blockHeight + 1;
      }
      const convertedTx = TransactionStorage._apiTransform(t, { object: true }) as Partial<ITransaction>;
      return JSON.stringify({ ...convertedTx, confirmations });
    });
  }

  async getTransaction(params: StreamTransactionParams) {
    let { chain, network, txId } = params;
    if (typeof txId !== 'string' || !chain || !network) {
      throw new Error('Missing required param');
    }
    network = network.toLowerCase();
    let query = { chain, network, txid: txId };
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    const found = await TransactionStorage.collection.findOne(query);
    if (found) {
      let confirmations = 0;
      if (found.blockHeight != null && found.blockHeight >= 0) {
        confirmations = tipHeight - found.blockHeight + 1;
      }
      const convertedTx = TransactionStorage._apiTransform(found, { object: true }) as TransactionJSON;
      return { ...convertedTx, confirmations } as any;
    } else {
      return undefined;
    }
  }

  async getAuthhead(params: StreamTransactionParams) {
    let { chain, network, txId } = params;
    if (typeof txId !== 'string') {
      throw new Error('Missing required param');
    }
    const found = (await CoinStorage.resolveAuthhead(txId, chain, network))[0];
    if (found) {
      const transformedCoins = found.identityOutputs.map<CoinJSON>(output =>
        CoinStorage._apiTransform(output, { object: true })
      );
      return {
        chain: found.chain,
        network: found.network,
        authbase: found.authbase,
        identityOutputs: transformedCoins
      };
    } else {
      return undefined;
    }
  }

  async createWallet(params: CreateWalletParams) {
    const { chain, network, name, pubKey, path, singleAddress } = params;
    if (typeof name !== 'string' || !network) {
      throw new Error('Missing required param');
    }
    const state = await StateStorage.collection.findOne({});
    const initialSyncComplete =
      state && state.initialSyncComplete && state.initialSyncComplete.includes(`${chain}:${network}`);
    const walletConfig = Config.for('api').wallets;
    const canCreate = walletConfig && walletConfig.allowCreationBeforeCompleteSync;
    const isP2P = this.isP2p({ chain, network });
    if (isP2P && !initialSyncComplete && !canCreate) {
      throw new Error('Wallet creation not permitted before intitial sync is complete');
    }
    const wallet: IWallet = {
      chain,
      network,
      name,
      pubKey,
      path,
      singleAddress
    };
    await WalletStorage.collection.insertOne(wallet);
    return wallet;
  }

  async getWallet(params: GetWalletParams) {
    const { chain, pubKey } = params;
    return WalletStorage.collection.findOne({ chain, pubKey });
  }

  streamWalletAddresses(params: StreamWalletAddressesParams) {
    let { walletId, req, res } = params;
    let query = { wallet: walletId };
    Storage.apiStreamingFind(WalletAddressStorage, query, {}, req, res);
  }

  async walletCheck(params: WalletCheckParams) {
    let { chain, network, wallet } = params;
    return new Promise(resolve => {
      const addressStream = WalletAddressStorage.collection.find({ chain, network, wallet }).project({ address: 1 });
      let sum = 0;
      let lastAddress;
      addressStream.on('data', (walletAddress: IWalletAddress) => {
        if (walletAddress.address) {
          lastAddress = walletAddress.address;
          const addressSum = Buffer.from(walletAddress.address).reduce(
            (tot, cur) => (tot + cur) % Number.MAX_SAFE_INTEGER
          );
          sum = (sum + addressSum) % Number.MAX_SAFE_INTEGER;
        }
      });
      addressStream.on('end', () => {
        resolve({ lastAddress, sum });
      });
    });
  }

  isP2p({ chain, network }) {
    return Config.chainConfig({ chain, network })?.chainSource !== 'p2p';
  }

  async streamMissingWalletAddresses(params: StreamWalletMissingAddressesParams) {
    const { chain, network, pubKey, res } = params;
    const wallet = await WalletStorage.collection.findOne({ pubKey });
    const walletId = wallet!._id!;
    const query = { chain, network, wallets: walletId, spentHeight: { $gte: SpentHeightIndicators.minimum } };
    const cursor = CoinStorage.collection.find(query).addCursorFlag('noCursorTimeout', true);
    const seen = {};
    const stringifyWallets = (wallets: Array<ObjectId>) => wallets.map(w => w.toHexString());
    const allMissingAddresses = new Array<string>();
    let totalMissingValue = 0;
    const missingStream = cursor.pipe(
      new Transform({
        objectMode: true,
        async transform(spentCoin: MongoBound<ICoin>, _, next) {
          if (!seen[spentCoin.spentTxid]) {
            seen[spentCoin.spentTxid] = true;
            // find coins that were spent with my coins
            const spends = await CoinStorage.collection
              .find({ chain, network, spentTxid: spentCoin.spentTxid })
              .addCursorFlag('noCursorTimeout', true)
              .toArray();
            const missing = spends
              .filter(coin => !stringifyWallets(coin.wallets).includes(walletId.toHexString()))
              .map(coin => {
                const { _id, wallets, address, value } = coin;
                totalMissingValue += value;
                allMissingAddresses.push(address);
                return { _id, wallets, address, value, expected: walletId.toHexString() };
              });
            if (missing.length > 0) {
              return next(undefined, { txid: spentCoin.spentTxid, missing });
            }
          }
          return next();
        },
        flush(done) {
          done(null, { allMissingAddresses, totalMissingValue });
        }
      })
    );
    missingStream.pipe(new StringifyJsonStream()).pipe(res);
  }

  async updateWallet(params: UpdateWalletParams) {
    const { wallet, addresses, reprocess = false } = params;
    await WalletAddressStorage.updateCoins({ wallet, addresses, opts: { reprocess } });
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams) {
    const { chain, network, wallet, res, args } = params;
    const query: any = {
      chain,
      network,
      wallets: wallet._id,
      'wallets.0': { $exists: true }
    };
    if (wallet.chain === 'BTC' && ['testnet3', 'testnet4'].includes(wallet.network)) {
      query['network'] = wallet.network;
    }

    if (args) {
      if (args.startBlock || args.endBlock) {
        query.$or = [];
        if (args.includeMempool) {
          query.$or.push({ blockHeight: SpentHeightIndicators.pending });
        }
        let blockRangeQuery = {} as any;
        if (args.startBlock) {
          blockRangeQuery.$gte = Number(args.startBlock);
        }
        if (args.endBlock) {
          blockRangeQuery.$lte = Number(args.endBlock);
        }
        query.$or.push({ blockHeight: blockRangeQuery });
      } else {
        if (args.startDate) {
          const startDate = new Date(args.startDate);
          if (startDate.getTime()) {
            query.blockTimeNormalized = { $gte: new Date(args.startDate) };
          }
        }
        if (args.endDate) {
          const endDate = new Date(args.endDate);
          if (endDate.getTime()) {
            query.blockTimeNormalized = query.blockTimeNormalized || {};
            query.blockTimeNormalized.$lt = new Date(args.endDate);
          }
        }
      }
    }

    const transactionStream = TransactionStorage.collection
      .find(query)
      .sort({ blockTimeNormalized: 1 })
      .addCursorFlag('noCursorTimeout', true);
    const listTransactionsStream = new this.WalletStreamTransform(wallet);
    transactionStream.pipe(listTransactionsStream).pipe(res);
  }

  async getWalletBalance(params: GetWalletBalanceParams): Promise<WalletBalanceType> {
    const query = {
      wallets: params.wallet._id,
      'wallets.0': { $exists: true },
      spentHeight: { $lt: SpentHeightIndicators.minimum },
      mintHeight: { $gt: SpentHeightIndicators.conflicting }
    };
    if (params.wallet.chain === 'BTC' && ['testnet3', 'testnet4'].includes(params.wallet.network)) {
      query['network'] = params.wallet.network;
    }
    return CoinStorage.getBalance({ query });
  }

  async getWalletBalanceAtTime(params: GetWalletBalanceAtTimeParams): Promise<WalletBalanceType> {
    const { chain, network, time } = params;
    let query = { wallets: params.wallet._id, 'wallets.0': { $exists: true } };
    if (params.wallet.chain === 'BTC' && ['testnet3', 'testnet4'].includes(params.wallet.network)) {
      query['network'] = params.wallet.network;
    }
    return CoinStorage.getBalanceAtTime({ query, time, chain, network });
  }

  async streamWalletUtxos(params: StreamWalletUtxosParams) {
    const { wallet, limit, args = {}, req, res } = params;
    let query: any = {
      wallets: wallet._id,
      'wallets.0': { $exists: true },
      mintHeight: { $gt: SpentHeightIndicators.conflicting }
    };
    if (wallet.chain === 'BTC' && ['testnet3', 'testnet4'].includes(wallet.network)) {
      query['network'] = wallet.network;
    }
    if (args.includeSpent !== 'true') {
      if (args.includePending === 'true') {
        query.spentHeight = { $lte: SpentHeightIndicators.pending };
      } else {
        query.spentHeight = { $lt: SpentHeightIndicators.pending };
      }
    }
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    const utxoTransform = (c: Partial<ICoin>): string => {
      let confirmations = 0;
      if (c.mintHeight && c.mintHeight >= 0) {
        confirmations = tipHeight - c.mintHeight + 1;
      }
      c.confirmations = confirmations;
      return CoinStorage._apiTransform(c) as string;
    };

    Storage.apiStreamingFind(CoinStorage, query, { limit }, req, res, utxoTransform);
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    const { chain, network, target, mode } = params;
    const cacheKey = `getFee-${chain}-${network}-${target}${mode ? '-' + mode.toLowerCase() : ''}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        return this.getRPC(chain, network).getEstimateSmartFee(Number(target), mode);
      },
      5 * CacheStorage.Times.Minute
    );
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    const { chain, network, rawTx } = params;
    const txids = new Array<string>();
    const rawTxs = typeof rawTx === 'string' ? [rawTx] : rawTx;
    for (const tx of rawTxs) {
      const txid = await this.getRPC(chain, network).sendTransaction(tx);
      txids.push(txid);
    }
    return txids.length === 1 ? txids[0] : txids;
  }

  async getCoinsForTx({ chain, network, txid }: { chain: string; network: string; txid: string }) {
    const tx = await TransactionStorage.collection.findOne({ txid });
    if (!tx) {
      throw new Error(`No such transaction ${txid}`);
    }

    const tip = await this.getLocalTip({ chain, network });
    const confirmations = (tip && tx.blockHeight! > -1) ? tip.height - tx.blockHeight! + 1 : 0;

    const inputs = await CoinStorage.collection
      .find({
        chain,
        network,
        spentTxid: txid
      })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    const outputs = await CoinStorage.collection
      .find({
        chain,
        network,
        mintTxid: txid
      })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    return {
      inputs: inputs.map(input => CoinStorage._apiTransform(input, { object: true, confirmations })),
      outputs: outputs.map(output => CoinStorage._apiTransform(output, { object: true, confirmations }))
    };
  }

  async getDailyTransactions(params: DailyTransactionsParams) {
    const { chain, network, startDate, endDate } = params;
    const formatDate = (d: Date) => new Date(d.toISOString().split('T')[0]);
    const todayTruncatedUTC = formatDate(new Date());
    let oneMonth = new Date(todayTruncatedUTC);
    oneMonth.setDate(todayTruncatedUTC.getDate() - 30);
    oneMonth = formatDate(oneMonth);

    const isValidDate = (d: string) => {
      return new Date(d).toString() !== 'Invalid Date';
    };
    const start = startDate && isValidDate(startDate) ? new Date(startDate) : oneMonth;
    const end = endDate && isValidDate(endDate) ? formatDate(new Date(endDate)) : todayTruncatedUTC;
    const results = await BitcoinBlockStorage.collection
      .aggregate<{
        date: string;
        transactionCount: number;
      }>([
        {
          $match: {
            chain,
            network,
            timeNormalized: {
              $gte: start,
              $lt: end
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timeNormalized'
              }
            },
            transactionCount: {
              $sum: '$transactionCount'
            }
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            transactionCount: '$transactionCount'
          }
        },
        {
          $sort: {
            date: 1
          }
        }
      ])
      .toArray();
    return {
      chain,
      network,
      results
    };
  }

  async getLocalTip({ chain, network }) {
    return BitcoinBlockStorage.getLocalTip({ chain, network });
  }

  /**
   * Get a series of hashes that come before a given height, or the 30 most recent hashes
   *
   * @returns {Promise<Array<string>>}
   */
  async getLocatorHashes(params): Promise<Array<string>> {
    const { chain, network, startHeight, endHeight } = params;
    const query =
      startHeight && endHeight
        ? {
            processed: true,
            chain,
            network,
            height: { $gt: startHeight, $lt: endHeight }
          }
        : {
            processed: true,
            chain,
            network
          };
    const locatorBlocks = await BitcoinBlockStorage.collection
      .find(query).sort({ height: -1 }).limit(30)
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
    if (locatorBlocks.length < 2) {
      return [Array(65).join('0')];
    }
    return locatorBlocks.map(block => block.hash);
  }

  public isValid(params) {
    const { input } = params;

    if (this.isValidBlockOrTx(input)) {
      return { isValid: true, type: 'blockOrTx' };
    } else if (this.isValidAddress(params)) {
      return { isValid: true, type: 'addr' };
    } else if (this.isValidBlockIndex(input)) {
      return { isValid: true, type: 'blockOrTx' };
    } else {
      return { isValid: false, type: 'invalid' };
    }
  }

  private isValidBlockOrTx(inputValue: string): boolean {
    const regexp = /^[0-9a-fA-F]{64}$/;
    if (regexp.test(inputValue)) {
      return true;
    } else {
      return false;
    }
  }

  private isValidAddress(params): boolean {
    const { chain, network, input } = params;
    const addr = this.extractAddress(input);
    return !!Validation.validateAddress(chain, network, addr);
  }

  private isValidBlockIndex(inputValue): boolean {
    return isFinite(inputValue);
  }

  private extractAddress(address: string): string {
    const extractedAddress = address.replace(/^(bitcoincash:|bchtest:|bitcoin:)/i, '').replace(/\?.*/, '');
    return extractedAddress || address;
  }

  async getWalletAddresses(walletId: ObjectId) {
    let query = { chain: this.chain, wallet: walletId };
    return WalletAddressStorage.collection
      .find(query)
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
  }

  async getBlockFee(params: {
    chain: string,
    network: string,
    blockId: string
  }) {
    const { chain, network, blockId } = params;
    const transactions = blockId.length >= 64 
      ? await TransactionStorage.collection.find({ chain, network, blockHash: blockId }).toArray()
      : await TransactionStorage.collection.find({ chain, network, blockHeight: parseInt(blockId, 10) }).toArray();
    if (transactions.length === 0)
      return;

    let feeRateSum = 0;
    let feeTotal = 0;
    const feeRates: number[] = [];
    const freq = {};
    let mode = 0, maxCount = 0;
    for (const tx of transactions) {
      if (tx.fee && tx.size) { // does not add fee rate 0 or divide by zero
        const rate = tx.fee / tx.size;
        feeRates.push(rate);
        feeRateSum += rate;
        feeTotal += tx.fee;
        
        freq[rate] = (freq[rate] || 0) + 1;
        if (freq[rate] > maxCount) {
          mode = rate;
          maxCount = freq[rate];
        }
      }
    }
    const mean = feeRateSum / feeRates.length;
    feeRates.sort((a, b) => a - b);
    const median = feeRates.length % 2 === 1
      ? feeRates[Math.floor(feeRates.length / 2)]
      : (feeRates[feeRates.length / 2 - 1] + feeRates[feeRates.length / 2]) / 2;

    return { feeTotal, mean, median, mode };
  }
}
