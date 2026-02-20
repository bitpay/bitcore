import axios, { AxiosError } from 'axios';
import { IIndexedAPIAdapter, AdapterTransactionParams, AdapterStreamParams, AdapterBlockByDateParams } from './IIndexedAPIAdapter';
import { IEVMTransactionTransformed } from '../../evm/types';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import { ExternalApiStream } from '../streams/apiStream';
import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import { AdapterError, AuthError, RateLimitError, TimeoutError, UpstreamError, InvalidRequestError } from './errors';
import logger from '../../../../logger';

interface AlchemyConfig {
  apiKey: string;
  network: string; // e.g., 'eth-mainnet', 'polygon-mainnet', 'base-mainnet'
  requestTimeout?: number; // ms, default 30000
}

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

export class AlchemyAdapter implements IIndexedAPIAdapter {
  readonly name = 'Alchemy';
  readonly supportedChains = ['ETH', 'MATIC', 'BASE', 'ARB', 'OP'];

  private apiKey: string;
  private baseUrl: string;
  private requestTimeout: number;

  constructor(config: AlchemyConfig) {
    if (!config.apiKey) throw new Error('AlchemyAdapter: apiKey is required');
    if (!config.network) throw new Error('AlchemyAdapter: network is required (e.g., "eth-mainnet")');
    this.apiKey = config.apiKey;
    // IMPORTANT: baseUrl contains the API key. Never log this URL directly.
    this.baseUrl = `https://${config.network}.g.alchemy.com/v2/${this.apiKey}`;
    this.requestTimeout = config.requestTimeout ?? 30000;
  }

  async getTransaction(params: AdapterTransactionParams): Promise<IEVMTransactionTransformed | undefined> {
    const { chain, network, txId } = params;

    // Validate txId format before making external call
    if (!TX_HASH_REGEX.test(txId)) {
      throw new InvalidRequestError(this.name, `invalid txId format: ${txId}`);
    }

    // Need 3 calls: tx, receipt (for gasUsed/fee), block (for timestamp)
    const [txResponse, receiptResponse] = await Promise.all([
      this._jsonRpc('eth_getTransactionByHash', [txId]),
      this._jsonRpc('eth_getTransactionReceipt', [txId])
    ]);

    const tx = txResponse.result;
    const receipt = receiptResponse.result;
    if (!tx) return undefined; // Not found - return undefined per interface contract
    if (!tx.blockNumber) return undefined; // Pending tx - treat as not found
    if (!receipt) {
      logger.warn(`Alchemy: receipt missing for confirmed tx ${txId} (possible reorg)`);
      throw new UpstreamError(this.name, undefined, `receipt missing for confirmed tx ${txId}`);
    }

    // Get block timestamp
    const blockResponse = await this._jsonRpc('eth_getBlockByNumber', [tx.blockNumber, false]);
    const block = blockResponse.result;

    return this._transformTransaction({ chain, network, tx, receipt, block });
  }

  streamAddressTransactions(params: AdapterStreamParams): ExternalApiStream {
    const { chain, network, address, args } = params;

    // Alchemy uses alchemy_getAssetTransfers for address history
    // AlchemyAssetTransferStream extends ExternalApiStream, satisfying the interface.
    // It overrides _read() to use POST with pageKey pagination and queries both directions.
    return new AlchemyAssetTransferStream(
      this.baseUrl,
      { chain, network, address, args, requestTimeout: this.requestTimeout },
      (transfer) => {
        const _tx = this._transformAssetTransfer({ chain, network, transfer });
        const confirmations = args.tipHeight ? args.tipHeight - (_tx.blockHeight ?? 0) + 1 : 0;
        return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true });
      }
    );
  }

  streamERC20Transfers(params: AdapterStreamParams & { tokenAddress: string }): ExternalApiStream {
    const { chain, network, address, tokenAddress, args } = params;

    return new AlchemyAssetTransferStream(
      this.baseUrl,
      {
        chain, network, address, args,
        category: ['erc20'],
        contractAddresses: [tokenAddress],
        requestTimeout: this.requestTimeout
      },
      (transfer) => {
        const _tx = this._transformAssetTransfer({ chain, network, transfer });
        const confirmations = args.tipHeight ? args.tipHeight - (_tx.blockHeight ?? 0) + 1 : 0;
        return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true });
      }
    );
  }

  async getBlockNumberByDate(params: AdapterBlockByDateParams): Promise<number> {
    const { date } = params;
    const targetTimestamp = Math.floor(new Date(date).getTime() / 1000);

    const MAX_ITERATIONS = 64;
    const latestBlockResp = await this._jsonRpc('eth_blockNumber', []);
    let high = parseInt(latestBlockResp.result, 16);
    let low = 0;

    // Edge cases: target before genesis or after latest block
    const latestBlock = await this._jsonRpc('eth_getBlockByNumber', [latestBlockResp.result, false]);
    const latestTimestamp = parseInt(latestBlock.result.timestamp, 16);
    if (targetTimestamp >= latestTimestamp) return high;
    if (targetTimestamp <= 0) return 0;

    // Binary search for "floor" semantics: largest block with timestamp <= target
    let iterations = 0;
    while (low < high && iterations < MAX_ITERATIONS) {
      const mid = Math.floor((low + high + 1) / 2); // Ceil division to avoid infinite loop
      const blockResp = await this._jsonRpc('eth_getBlockByNumber', [`0x${mid.toString(16)}`, false]);
      const blockTimestamp = parseInt(blockResp.result.timestamp, 16);

      if (blockTimestamp <= targetTimestamp) {
        low = mid; // mid is valid candidate (timestamp <= target)
      } else {
        high = mid - 1; // mid is too late
      }
      iterations++;
    }

    return low;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this._jsonRpc('eth_blockNumber', [], 5000);
      return !!response.result;
    } catch {
      return false;
    }
  }

  // --- Private methods ---

  private async _jsonRpc(method: string, params: any[], timeout?: number): Promise<any> {
    try {
      const response = await axios.post(
        this.baseUrl,
        { jsonrpc: '2.0', id: 1, method, params },
        { timeout: timeout ?? this.requestTimeout }
      );

      // Check HTTP status even on 200-range responses (Alchemy may return 429 as HTTP status)
      const httpStatus = response.status;
      if (httpStatus === 401 || httpStatus === 403) throw new AuthError(this.name);
      if (httpStatus === 429) throw new RateLimitError(this.name);

      if (response.data.error) {
        const rpcError = response.data.error;
        // Classify JSON-RPC errors by code and message
        if (rpcError.code === -32602) throw new InvalidRequestError(this.name, rpcError.message);
        // Detect rate limiting from RPC error message (Alchemy sometimes returns 200 + rate limit error)
        const msg = (rpcError.message || '').toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many requests')) {
          throw new RateLimitError(this.name);
        }
        throw new UpstreamError(this.name, undefined, rpcError.message);
      }
      return response.data;
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      this._classifyError(error);
    }
  }

  /** Classify Alchemy HTTP/network errors into typed adapter errors */
  private _classifyError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = (error as AxiosError).response?.status;
      if (status === 401 || status === 403) throw new AuthError(this.name);
      if (status === 429) throw new RateLimitError(this.name);
      if (error.code === 'ECONNABORTED') throw new TimeoutError(this.name, this.requestTimeout);
      if (status && status >= 500) throw new UpstreamError(this.name, status);
    }
    throw new UpstreamError(this.name, undefined, (error as Error)?.message);
  }

  private _transformTransaction(params: {
    chain: string; network: string;
    tx: any; receipt: any; block: any;
  }): IEVMTransactionTransformed {
    const { chain, network, tx, receipt, block } = params;
    const blockTime = new Date(parseInt(block.timestamp, 16) * 1000);

    const transformed = {
      chain,
      network,
      txid: tx.hash,
      blockHeight: parseInt(tx.blockNumber, 16),
      blockHash: tx.blockHash,
      blockTime,
      blockTimeNormalized: blockTime,
      value: Number(BigInt(tx.value)),
      gasLimit: parseInt(tx.gas, 16),
      gasPrice: parseInt(tx.gasPrice || '0x0', 16),
      // EIP-1559: receipt.effectiveGasPrice is the actual price paid; tx.gasPrice may be maxFeePerGas
      fee: Number(BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice || tx.gasPrice || '0x0')),
      nonce: parseInt(tx.nonce, 16),
      to: tx.to ? Web3.utils.toChecksumAddress(tx.to) : '',
      from: Web3.utils.toChecksumAddress(tx.from),
      data: tx.input ? Buffer.from(String(tx.input).replace('0x', ''), 'hex') : Buffer.alloc(0),
      internal: [],
      calls: [],
      effects: [],
      wallets: [],
      transactionIndex: parseInt(tx.transactionIndex, 16)
    } as IEVMTransactionTransformed;

    EVMTransactionStorage.addEffectsToTxs([transformed]);
    return transformed;
  }

  private _transformAssetTransfer(params: {
    chain: string; network: string; transfer: any;
  }): IEVMTransactionTransformed {
    const { chain, network, transfer } = params;

    // Alchemy asset transfer format
    const blockNum = transfer.blockNum != null
      ? (typeof transfer.blockNum === 'string' && transfer.blockNum.startsWith('0x')
          ? parseInt(transfer.blockNum, 16)
          : parseInt(transfer.blockNum))
      : 0;

    // Guard against missing/undefined blockTimestamp -> would produce Invalid Date
    const rawTimestamp = transfer.metadata?.blockTimestamp;
    const blockTime = rawTimestamp ? new Date(rawTimestamp) : new Date(0);
    // Check for Invalid Date (NaN getTime) and default to epoch
    const safeBlockTime = isNaN(blockTime.getTime()) ? new Date(0) : blockTime;

    const transformed = {
      chain,
      network,
      txid: transfer.hash,
      blockHeight: blockNum,
      blockHash: '',  // Not included in asset transfers
      blockTime: safeBlockTime,
      blockTimeNormalized: safeBlockTime,
      value: transfer.value != null ? Number(transfer.value) : 0,
      gasLimit: 0,
      gasPrice: 0,
      fee: 0,
      nonce: 0,
      to: transfer.to ? Web3.utils.toChecksumAddress(transfer.to) : '',
      from: transfer.from ? Web3.utils.toChecksumAddress(transfer.from) : '',
      data: Buffer.alloc(0),
      internal: [],
      calls: [],
      effects: [],
      category: transfer.category,
      wallets: [],
      transactionIndex: 0
    } as IEVMTransactionTransformed;

    EVMTransactionStorage.addEffectsToTxs([transformed]);
    return transformed;
  }
}

/**
 * Alchemy adapter field defaults: Alchemy's asset transfer response does not include all
 * fields that Moralis provides. The following fields are set to safe defaults:
 * - blockHash: '' (not returned by alchemy_getAssetTransfers)
 * - gasLimit, gasPrice, fee, nonce: 0 (not available in transfer response)
 * - data: Buffer.alloc(0) (not available in transfer response)
 * - internal, calls: [] (separate query needed; out of scope for streaming)
 * These defaults are intentional and do not affect downstream consumers because
 * EVMTransactionStorage._apiTransform() handles missing/zero fields gracefully.
 * The getTransaction() path (non-streaming) DOES populate all fields since it
 * makes separate eth_getTransaction + eth_getTransactionReceipt + eth_getBlock calls.
 */

/**
 * Custom stream for Alchemy's alchemy_getAssetTransfers API.
 * Extends ExternalApiStream to satisfy the IIndexedAPIAdapter interface contract.
 * Overrides _read() to use POST requests with pageKey-based pagination
 * instead of ExternalApiStream's default GET with cursor-based pagination.
 *
 * IMPORTANT: Queries both fromAddress AND toAddress to capture incoming and
 * outgoing transfers (Moralis returns both directions in a single query).
 * We make two parallel requests per page and deduplicate by txHash.
 */
export class AlchemyAssetTransferStream extends ExternalApiStream {
  private pageKey: string | null = null;
  private toPageKey: string | null = null;
  private seenTxHashes: Set<string> = new Set();
  private static readonly MAX_DEDUP_ENTRIES = 10000;
  private requestTimeout: number;

  constructor(
    url: string,
    private alchemyParams: {
      chain: string;
      network: string;
      address: string;
      args: any;
      category?: string[];
      contractAddresses?: string[];
      requestTimeout?: number;
    },
    private transformFn: (transfer: any) => any
  ) {
    // Pass dummy URL/headers to ExternalApiStream - we override _read() entirely
    super(url, {}, alchemyParams.args);
    this.requestTimeout = alchemyParams.requestTimeout ?? 30000;
    // Validate address before any requests are made
    try {
      Web3.utils.toChecksumAddress(alchemyParams.address);
    } catch {
      // Emit error asynchronously so the stream consumer can handle it
      process.nextTick(() => this.emit('error', new InvalidRequestError('Alchemy', `invalid address: ${alchemyParams.address}`)));
    }
  }

  async _read() {
    try {
      const { address, args, category, contractAddresses } = this.alchemyParams;

      // Build base alchemy_getAssetTransfers params
      const baseParams: any = {
        category: category || ['external', 'internal', 'erc20'],
        order: (args.order || 'DESC').toLowerCase() === 'asc' ? 'asc' : 'desc',
        maxCount: `0x${(args.pageSize || 100).toString(16)}`,
        withMetadata: true
      };

      if (contractAddresses) {
        baseParams.contractAddresses = contractAddresses;
      }
      if (args.startBlock) {
        baseParams.fromBlock = `0x${Number(args.startBlock).toString(16)}`;
      }
      if (args.endBlock) {
        baseParams.toBlock = `0x${Number(args.endBlock).toString(16)}`;
      }

      // Query both directions in parallel to capture incoming AND outgoing transfers
      const fromParams = { ...baseParams, fromAddress: address };
      const toParams = { ...baseParams, toAddress: address };
      if (this.pageKey) fromParams.pageKey = this.pageKey;
      if (this.toPageKey) toParams.pageKey = this.toPageKey;

      const [fromResponse, toResponse] = await Promise.all([
        axios.post(this.url, {
          jsonrpc: '2.0', id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [fromParams]
        }, { timeout: this.requestTimeout }),
        axios.post(this.url, {
          jsonrpc: '2.0', id: 2,
          method: 'alchemy_getAssetTransfers',
          params: [toParams]
        }, { timeout: this.requestTimeout })
      ]);

      const fromData = fromResponse.data.result;
      const toData = toResponse.data.result;

      // Merge and deduplicate by tx hash
      const allTransfers = [
        ...(fromData?.transfers || []),
        ...(toData?.transfers || [])
      ];

      for (const transfer of allTransfers) {
        // Deduplicate: a tx can appear in both from and to results.
        // Use uniqueId (Alchemy provides this) to avoid collisions when a single tx
        // has multiple transfers of the same category (e.g., multi-recipient ERC20 batch).
        // Fallback to hash:category if uniqueId is unavailable.
        const key = transfer.uniqueId || `${transfer.hash}:${transfer.category}`;
        if (this.seenTxHashes.has(key)) continue;
        this.seenTxHashes.add(key);

        // Bound dedup set to prevent unbounded memory growth for high-activity addresses
        if (this.seenTxHashes.size > AlchemyAssetTransferStream.MAX_DEDUP_ENTRIES) {
          logger.debug(`Alchemy: dedup set exceeded ${AlchemyAssetTransferStream.MAX_DEDUP_ENTRIES}, evicting oldest entries`);
          const iterator = this.seenTxHashes.values();
          for (let i = 0; i < 1000; i++) {
            const oldest = iterator.next().value;
            if (oldest) this.seenTxHashes.delete(oldest);
          }
        }

        if (args.limit && this.results >= args.limit) {
          this.push(null);
          return;
        }
        this.push(this.transformFn(transfer));
        this.results++;
      }

      this.pageKey = fromData?.pageKey || null;
      this.toPageKey = toData?.pageKey || null;

      // If neither direction has more pages, we're done
      if (!this.pageKey && !this.toPageKey) {
        this.push(null);
      }
      // Note: if all were duplicates but pages remain, the next _read() call from
      // the stream consumer will naturally fetch the next page (no recursive call needed).
      this.page++;
    } catch (error) {
      if (error instanceof AdapterError) {
        this.emit('error', error);
      } else if (axios.isAxiosError(error)) {
        const status = (error as AxiosError).response?.status;
        if (status === 429) this.emit('error', new RateLimitError('Alchemy'));
        else if (status === 401 || status === 403) this.emit('error', new AuthError('Alchemy'));
        else if (error.code === 'ECONNABORTED') this.emit('error', new TimeoutError('Alchemy', this.requestTimeout));
        else this.emit('error', new UpstreamError('Alchemy', status));
      } else {
        this.emit('error', new UpstreamError('Alchemy', undefined, (error as Error)?.message));
      }
    }
  }
}
