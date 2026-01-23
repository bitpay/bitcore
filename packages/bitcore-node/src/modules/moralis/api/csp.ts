import os from 'os';
import { Web3 } from 'crypto-wallet-core';
import request from 'request';
import config from '../../../config';
import logger from '../../../logger';
import { MongoBound } from '../../../models/base';
import { CacheStorage } from '../../../models/cache';
import { CoinEvent } from '../../../models/events';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { BaseEVMStateProvider, BuildWalletTxsStreamParams } from '../../../providers/chain-state/evm/api/csp';
import { EVMBlockStorage } from '../../../providers/chain-state/evm/models/block';
import { EVMTransactionStorage } from '../../../providers/chain-state/evm/models/transaction';
import { EVMTransactionJSON, GethTraceCall, IEVMBlock, IEVMTransactionTransformed, Transaction } from '../../../providers/chain-state/evm/types';
import { ExternalApiStream } from '../../../providers/chain-state/external/streams/apiStream';
import { IBlock } from '../../../types/Block';
import { ChainId, ChainNetwork } from '../../../types/ChainNetwork';
import { IAddressSubscription } from '../../../types/ExternalProvider';
import { GetBlockBeforeTimeParams, GetBlockParams, StreamAddressUtxosParams, StreamBlocksParams, StreamTransactionParams, StreamWalletTransactionsParams } from '../../../types/namespaces/ChainStateProvider';
import { isDateValid } from '../../../utils';
import { ReadableWithEventPipe } from '../../../utils/streamWithEventPipe';



export interface MoralisAddressSubscription {
  id?: string;
  message?: string;
  status?: string;
}

/**
 * Single-provider pattern - reference doc Section "Provider Adapters"
 * This class directly calls Moralis API and transforms responses.
 * For multi-provider: extract transformation logic into MoralisAdapter,
 * then use MultiProviderEVMStateProvider to orchestrate multiple adapters.
 */
export class MoralisStateProvider extends BaseEVMStateProvider {
  baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  baseStreamUrl = 'https://api.moralis-streams.com/streams/evm';
  apiKey = config.externalProviders?.moralis?.apiKey;
  baseWebhookurl = config.externalProviders?.moralis?.webhookBaseUrl;
  headers = {
    'Content-Type': 'application/json',
    'X-API-Key': this.apiKey,
  };

  constructor(chain: string) {
    super(chain);
  }

  // @override
  async getBlockBeforeTime(params: GetBlockBeforeTimeParams): Promise<IBlock|null> {
    const { chain, network, time } = params;
    const date = new Date(time || Date.now());
    const chainId = await this.getChainId({ network });
    const blockNum = await this._getBlockNumberByDate({ chainId, date });
    if (!blockNum) {
      return null;
    }
    const blockId = blockNum.toString();
    const blocks = await this._getBlocks({ chain, network, blockId, args: { limit: 1 } });
    return blocks.blocks[0] || null;
  }

  // @override
  async getFee(params) {
    let { network } = params;
    const { target = 4, txType } = params;
    const chain = this.chain;
    if (network === 'livenet') {
      network = 'mainnet';
    }
    let cacheKey = `getFee-${chain}-${network}-${target}`;
    if (txType) {
      cacheKey += `-type${txType}`;
    }

    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const { rpc } = await this.getWeb3(network, { type: 'historical' });
        const feerate = await rpc.estimateFee({ nBlocks: target, txType });
        return { feerate: Number(feerate), blocks: target };
      },
      CacheStorage.Times.Minute
    );
  }

  // @override
  async getLocalTip({ chain, network }): Promise<IBlock> {
    const { web3 } = await this.getWeb3(network);
    const block = await web3.eth.getBlock('latest');
    return EVMBlockStorage.convertRawBlock(chain, network, block);
  }

  // @override
  async streamBlocks(params: StreamBlocksParams) {
    const { chain, network, req, res } = params;
    const { web3 } = await this.getWeb3(network);
    const chainId = await this.getChainId({ network });
    const blockRange = await this.getBlocksRange({ ...params, chainId });
    const tipHeight = Number(await web3.eth.getBlockNumber());
    let isReading = false;
  
    const stream = new ReadableWithEventPipe({
      objectMode: true,
      async read() {
        if (isReading) {
          return;
        }
        isReading = true;

        let block;
        let nextBlock;
        try {
          for (const blockNum of blockRange) {
            // stage next block in new var so `nextBlock` doesn't get overwritten if needed for `block`
            const thisNextBlock = parseInt(block?.number) === blockNum + 1 ? block : await web3.eth.getBlock(blockNum + 1);
            block = parseInt(nextBlock?.number) === blockNum ? nextBlock : await web3.eth.getBlock(blockNum);
            if (!block) {
              continue;
            }
            nextBlock = thisNextBlock;
            const convertedBlock = EVMBlockStorage.convertRawBlock(chain, network, block);
            convertedBlock.nextBlockHash = nextBlock?.hash;
            convertedBlock.confirmations = tipHeight - block.number + 1;
            this.push(convertedBlock);
          }
        } catch (e) {
          logger.error('Error streaming blocks: %o', e);
        }
        this.push(null);
      }
    });

    return ExternalApiStream.onStream(stream, req!, res!);

  }

  /**
   * Reference doc: IIndexedAPIAdapter.getTransaction()
   * This method calls Moralis API and transforms to internal format.
   * For multi-provider: move Moralis-specific logic to MoralisAdapter.getTransaction(),
   * return standardized IEVMTransactionInProcess format.
   */
  // @override
  async _getTransaction(params: StreamTransactionParams) {
    let { network } = params;
    const { chain, txId } = params;
    network = network.toLowerCase();

    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const tipHeight = Number(await web3.eth.getBlockNumber());
    const chainId = await this.getChainId({ network });
    const found = await this._getTransactionFromMoralis({ chain, network, chainId, txId });
    return { tipHeight, found };
  }

  /**
   * Reference doc: Section "Stream Improvements"
   * Current pattern: passes req/res deep into stream logic (coupled).
   * For multi-provider: return stream from adapter, pipe to res at route layer (decoupled).
   */
  // @override
  async _buildAddressTransactionsStream(params: StreamAddressUtxosParams) {
    const { req, res, args, network, address } = params;

    const chainId = await this.getChainId({ network });
    const txStream = await this._streamAddressTransactionsFromMoralis({
      chainId,
      chain: this.chain,
      network,
      address,
      args: {
        limit: 10, // default limit when querying by address
        ...args
      }
    });
    // TODO unify `ExternalApiStream.onStream` and `Storage.apiStream` which are effectively doing the same thing
    const result = await ExternalApiStream.onStream(txStream, req!, res!);
    if (!result?.success) {
      logger.error('Error mid-stream (streamAddressTransactions): %o', result.error?.log || result.error);
    }
  }

  // @override
  async _buildWalletTransactionsStream(params: StreamWalletTransactionsParams, streamParams: BuildWalletTxsStreamParams) {
    const { network, args } = params;
    let { transactionStream } = streamParams;
    const { walletAddresses } = streamParams;

    const chainId = await this.getChainId({ network });
    for (const address of walletAddresses) {
      const txStream = await this._streamAddressTransactionsFromMoralis({
        chainId,
        chain: this.chain,
        network,
        address,
        args: {
          limit: args.limit, // no default limit when querying by wallet. Note: BWS caches txs
          order: 'ASC',
          ...args
        }
      });
      transactionStream = txStream.eventPipe(transactionStream);
      
      // Do not await these promises. They are not critical to the stream.
      WalletAddressStorage.updateLastQueryTime({ chain: this.chain, network, address })
        .catch(e => logger.warn(`Failed to update ${this.chain}:${network} address lastQueryTime: %o`, e)),
      this._addAddressToSubscription({ chainId, address })
        .catch(e => logger.warn(`Failed to add address to ${this.chain}:${network} Moralis subscription: %o`, e));
    }
    return transactionStream;
  }

  // @override
  async _getBlocks(params: GetBlockParams) {
    const { chain, network } = params;
    const blocks: MongoBound<IEVMBlock>[] = [];
    const { web3 } = await this.getWeb3(network);
    const chainId = await this.getChainId({ network });
    const blockRange = await this.getBlocksRange({ ...params, chainId });

    for (const blockNum of blockRange) {
      const block = await web3.eth.getBlock(blockNum);
      const nextBlock = await web3.eth.getBlock(block.number + 1n);
      const convertedBlock = EVMBlockStorage.convertRawBlock(chain, network, block);
      convertedBlock.nextBlockHash = nextBlock?.hash!;
      blocks.push(convertedBlock);
    }
    
    const tipHeight = Number(await web3.eth.getBlockNumber());
    return { tipHeight, blocks };
  }

  // @override
  async _getBlockNumberByDate(params: {
    date: Date;
    chainId: string | bigint;
  }) {
    const { date, chainId } = params;
    if (!date || !isDateValid(date)) {
      throw new Error('Invalid date');
    }
    if (!chainId) {
      throw new Error('Invalid chainId');
    }

    const query = this._transformQueryParams({ chainId, args: { date } });
    const queryStr = this._buildQueryString(query);

    return new Promise<number>((resolve, reject) => {
      request({
        method: 'GET',
        url: `${this.baseUrl}/dateToBlock${queryStr}`,
        headers: this.headers,
        json: true
      }, (err, _data: any, body) => {
        if (err) {
          return reject(err);
        }
        return resolve(body.block as number);
      });
    });
  }



  /** MORALIS METHODS */

  async _getTransactionFromMoralis(params: StreamTransactionParams & ChainId) {
    const { chain, network, chainId, txId } = params;

    const query = this._buildQueryString({ chain: chainId, include: 'internal_transactions' });

    return new Promise<IEVMTransactionTransformed>((resolve, reject) => {
      request({
        method: 'GET',
        url: `${this.baseUrl}/transaction/${txId}${query}`,
        headers: this.headers,
        json: true
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (typeof data === 'string') {
          return reject(new Error(data));
        }
        const tx = data.body;
        return resolve(this._transformTransaction({ chain, network, ...tx }));
      });
    });
  }


  _streamAddressTransactionsFromMoralis(params: StreamAddressUtxosParams & ChainId) {
    const { chainId, chain, network, address, args } = params;
    if (args.tokenAddress) {
      return this._streamERC20TransactionsByAddress({ chainId, chain, network, address, tokenAddress: args.tokenAddress, args });
    }
    if (!address) {
      throw new Error('Missing address');
    }
    if (!chainId) {
      throw new Error('Invalid chainId');
    }

    const query = this._transformQueryParams({ chainId, args }); // throws if no chain or network
    const queryStr = this._buildQueryString({
      ...query,
      order: args.order || 'DESC', // default to descending order
      limit: args.pageSize || 10, // limit per request/page. total limit (args.limit) is checked in apiStream._read()
      include: 'internal_transactions'
    });
    args.transform = (tx) => {
      const _tx: any = this._transformTransaction({ chain, network, ...tx });
      const confirmations = this._calculateConfirmations(tx, args.tipHeight);
      return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true }) as EVMTransactionJSON;
    };

    return new ExternalApiStream(
      `${this.baseUrl}/${address}${queryStr}`,
      this.headers,
      args
    );
  }

  private _streamERC20TransactionsByAddress({ chainId, chain, network, address, tokenAddress, args }): any {
    if (!address) {
      throw new Error('Missing address');
    }
    if (!tokenAddress) {
      throw new Error('Missing token address');
    }
    if (!chainId) {
      throw new Error('Invalid chainId');
    }

    const queryTransform = this._transformQueryParams({ chainId, args }); // throws if no chain or network
    const queryStr = this._buildQueryString({
      ...queryTransform,
      order: args.order || 'DESC', // default to descending order
      limit: args.pageSize || 10, // limit per request/page. total limit (args.limit) is checked in apiStream._read()
      contract_addresses: [tokenAddress],
    });
    args.transform = (tx) => {
      const _tx: any = this._transformTokenTransfer({ chain, network, ...tx });
      const confirmations = this._calculateConfirmations(tx, args.tipHeight);
      return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true }) as EVMTransactionJSON;
    };

    return new ExternalApiStream(
      `${this.baseUrl}/${address}/erc20/transfers${queryStr}`,
      this.headers,
      args
    );
  }

  private _transformTransaction(tx) {
    const transformed = {
      chain: tx.chain,
      network: tx.network,
      txid: tx.hash || tx.transaction_hash, // erc20 transfer txs have transaction_hash
      blockHeight: Number(tx.block_number ?? tx.blockNumber),
      blockHash: tx.block_hash ?? tx.blockHash,
      blockTime: new Date(tx.block_timestamp ?? tx.blockTimestamp),
      blockTimeNormalized: new Date(tx.block_timestamp ?? tx.blockTimestamp),
      value: tx.value,
      gasLimit: tx.gas ?? 0,
      gasPrice: tx.gas_price ?? tx.gasPrice ?? 0,
      fee: Number(tx.receipt_gas_used ?? tx.receiptGasUsed ?? 0) * Number(tx.gas_price ?? tx.gasPrice ?? 0),
      nonce: tx.nonce,
      to: Web3.utils.toChecksumAddress(tx.to_address ?? tx.toAddress),
      from: Web3.utils.toChecksumAddress(tx.from_address ?? tx.fromAddress),
      data: tx.input,
      internal: [],
      calls: tx?.internal_transactions?.map(t => this._transformInternalTransaction(t)) || [],
      effects: [],
      category: tx.category,
      wallets: [],
      transactionIndex: tx.transaction_index ?? tx.transactionIndex
    } as IEVMTransactionTransformed;
    EVMTransactionStorage.addEffectsToTxs([transformed]);
    return transformed;
  }

  private _transformInternalTransaction(tx) {
    return {
      from: Web3.utils.toChecksumAddress(tx.from),
      to: Web3.utils.toChecksumAddress(tx.to),
      gas: tx.gas,
      gasUsed: tx.gas_used,
      input: tx.input,
      output: tx.output,
      type: tx.type,
      value: tx.value,
      abiType: EVMTransactionStorage.abiDecode(tx.input)
    } as GethTraceCall;
  }

  private _transformTokenTransfer(transfer) {
    const _transfer = this._transformTransaction(transfer);
    return {
      ..._transfer,
      transactionHash: transfer.transaction_hash,
      transactionIndex: transfer.transaction_index,
      contractAddress: transfer.contract_address ?? transfer.address,
      name: transfer.token_name
    } as Partial<Transaction> | any;
  }

  private _transformQueryParams(params) {
    const { chainId, args } = params;
    const query = {
      chain: this._formatChainId(chainId),
    } as any;
    if (args) {
      if (args.startBlock || args.endBlock) {
        if (args.startBlock) {
          query.from_block = Number(args.startBlock);
        }
        if (args.endBlock) {
          query.to_block = Number(args.endBlock);
        }
      } else {
        if (args.startDate) {
          query.from_date = args.startDate;
        }
        if (args.endDate) {
          query.to_date = args.endDate;
        }
      }
      if (args.direction) {
        query.order = Number(args.direction) > 0 ? 'ASC' : 'DESC';
      }
      if (args.date) {
        query.date = new Date(args.date).getTime();
      }
    }
    return query;
  }

  private _calculateConfirmations(tx, tip) {
    let confirmations = 0;
    if (tx.blockHeight && tx.blockHeight >= 0) {
      confirmations = tip - tx.blockHeight + 1;
    }
    return confirmations;
  }

  private _buildQueryString(params: Record<string, any>): string {
    const query: string[] = [];

    if (params.chain) {
      params.chain = this._formatChainId(params.chain);
    }

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          // add array values in the form of key[i]=value
          if (value[i] != null) query.push(`${key}%5B${i}%5D=${value[i]}`);
        }
      } else if (value != null) {
        query.push(`${key}=${value}`);
      }
    }

    return query.length ? `?${query.join('&')}` : '';
  }

  private _formatChainId(chainId) {
    return '0x' + parseInt(chainId).toString(16);
  }

  /**
   * Request wrapper for moralis Streams (subscriptions)
   * @param method 
   * @param url 
   * @param body 
   * @returns 
   */
  _subsRequest(method: string, url: string, body?: any) {
    return new Promise((resolve, reject) => {
      request({
        method,
        url,
        headers: this.headers,
        json: true,
        body
      }, (err, data) => {
        if (err) {
          logger.error(`Error with Moralis subscription call ${method}:${url}: ${err.stack || err.message || err}`);
          return reject(err);
        }
        if (typeof data === 'string') {
          logger.warn(`Moralis subscription ${method}:${url} returned a string: ${data}`);
          return reject(new Error(data));
        }
        return resolve(data.body);
      });
    });
  }

  async createAddressSubscription(params: ChainNetwork & ChainId) {
    const { chain, network, chainId } = params;
    const _chainId = this._formatChainId(chainId);

    const result: any = await this._subsRequest('PUT', this.baseStreamUrl, {
      description: `Bitcore ${_chainId} - ${os.hostname()} - addresses`,
      // tag: '',
      chainIds: [_chainId],
      webhookUrl: `${this.baseWebhookurl}/${chain}/${network}/moralis`,
      includeNativeTxs: true,
      includeInternalTxs: true
    }
    );
    if (!result.id) {
      throw new Error('Failed to create subscription: ' + JSON.stringify(result));
    }
    return result;
  }

  async getAddressSubscriptions() {
    const subs: any = await this._subsRequest('GET', this.baseStreamUrl + '?limit=100');
    return subs.result as any[];
  }

  deleteAddressSubscription(params: { sub: IAddressSubscription }) {
    const { sub } = params;
    return this._subsRequest('DELETE', `${this.baseStreamUrl}/${sub.id}`) as Promise<MoralisAddressSubscription>;
  }

  async updateAddressSubscription(params: { sub: IAddressSubscription; addressesToAdd?: string[]; addressesToRemove?: string[]; status?: string }) {
    const { sub, addressesToAdd, addressesToRemove, status } = params;

    let moralisSub: MoralisAddressSubscription | null = null;
    if (addressesToAdd && addressesToAdd.length > 0) {
      moralisSub = await this._subsRequest('POST', `${this.baseStreamUrl}/${sub.id}/address`, { address: addressesToAdd }) as MoralisAddressSubscription;
    } else if (addressesToRemove && addressesToRemove.length > 0) {
      moralisSub = await this._subsRequest('DELETE', `${this.baseStreamUrl}/${sub.id}/address`, { address: addressesToRemove }) as MoralisAddressSubscription;
    } else if (status) {
      moralisSub = await this._subsRequest('POST', `${this.baseStreamUrl}/${sub.id}/status`, { status }) as MoralisAddressSubscription;
    }
    if (moralisSub?.message) {
      throw new Error(moralisSub.message);
    }
    return moralisSub?.id ? moralisSub : sub; // fallback to sub in case there's nothing to update (e.g. addressesToAdd is an empty array)
  }

  webhookToCoinEvents(params: { webhook: any } & ChainNetwork) {
    const { chain, network, webhook } = params;
    if (webhook.body.confirmed) {
      // Moralis broadcasts both confirmed and unconfirmed.
      // Filtering out confirmed de-duplicates events.
      return [];
    }
    const coinEvents: CoinEvent[] = webhook.body.txs.flatMap(tx => this._transformWebhookTransaction({ chain, network, tx, webhook: webhook.body }));
    return coinEvents;
  }

  private _transformWebhookTransaction(params: { webhook; tx } & ChainNetwork): CoinEvent[] {
    const { chain, network, tx } = params;
    const events: CoinEvent[] = [];
    for (const address of tx.triggered_by) {
      events.push({
        address,
        coin: {
          chain,
          network,
          value: tx.value,
          address: tx.toAddress,
          mintTxid: tx.hash
        }
      });
    }
    return events;
  }

  private async _addAddressToSubscription({ chainId, address }) {
    const subs = await this.getAddressSubscriptions();
    const sub = subs?.find(sub => sub.chainIds.includes('0x' + chainId.toString(16)));
    if (sub) {
      await this.updateAddressSubscription({ sub, addressesToAdd: [address] });
    }
  }
}
