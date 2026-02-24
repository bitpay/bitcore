import axios, { AxiosError } from 'axios';
import { IIndexedAPIAdapter, AdapterTransactionParams, AdapterStreamParams, AdapterBlockByDateParams } from './IIndexedAPIAdapter';
import { IEVMTransactionTransformed } from '../../evm/types';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import { ExternalApiStream } from '../streams/apiStream';
import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import { AdapterError, AdapterErrorCode } from './errors';
import { IMultiProviderConfig } from '../../../../types/Config';
import config from '../../../../config';
import logger from '../../../../logger';

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Maps bitcore chain+network → Alchemy hostname prefix */
const ALCHEMY_NETWORK_MAP: Record<string, Record<string, string>> = {
  ETH: { mainnet: 'eth-mainnet', sepolia: 'eth-sepolia' },
  MATIC: { mainnet: 'polygon-mainnet', amoy: 'polygon-amoy' },
  BASE: { mainnet: 'base-mainnet', sepolia: 'base-sepolia' },
  ARB: { mainnet: 'arb-mainnet', sepolia: 'arb-sepolia' },
  OP: { mainnet: 'opt-mainnet', sepolia: 'opt-sepolia' },
};

export class AlchemyAdapter implements IIndexedAPIAdapter {
  readonly name = 'Alchemy';
  readonly supportedChains = ['ETH', 'MATIC', 'BASE', 'ARB', 'OP'];

  private apiKey: string;
  private requestTimeout: number;

  constructor(providerConfig: IMultiProviderConfig) {
    const apiKey = config.externalProviders?.alchemy?.apiKey;
    if (!apiKey) throw new Error('AlchemyAdapter: apiKey is required in config.externalProviders.alchemy');
    this.apiKey = apiKey;
    this.requestTimeout = providerConfig.requestTimeout ?? 30000;
  }

  private getBaseUrl(chain: string, network: string): string {
    const alchemyNetwork = ALCHEMY_NETWORK_MAP[chain.toUpperCase()]?.[network.toLowerCase()];
    if (!alchemyNetwork) {
      throw new AdapterError(this.name, AdapterErrorCode.INVALID_REQUEST, `unsupported chain/network: ${chain}/${network}`);
    }
    return `https://${alchemyNetwork}.g.alchemy.com/v2/${this.apiKey}`;
  }

  async getTransaction(params: AdapterTransactionParams): Promise<IEVMTransactionTransformed | undefined> {
    const { chain, network, txId } = params;

    // Validate before making external call
    if (!TX_HASH_REGEX.test(txId)) {
      throw new AdapterError(this.name, AdapterErrorCode.INVALID_REQUEST, `invalid txId format: ${txId}`);
    }

    // Need tx + receipt (for gasUsed/fee) + block (for timestamp)
    const url = this.getBaseUrl(chain, network);
    const [txResponse, receiptResponse] = await Promise.all([
      this._jsonRpc(url, 'eth_getTransactionByHash', [txId]),
      this._jsonRpc(url, 'eth_getTransactionReceipt', [txId])
    ]);

    const tx = txResponse.result;
    const receipt = receiptResponse.result;
    if (!tx) return undefined; // Not found
    if (!tx.blockNumber) return undefined; // Pending tx
    if (!receipt) {
      logger.warn(`Alchemy: receipt missing for confirmed tx ${txId} (possible reorg)`);
      throw new AdapterError(this.name, AdapterErrorCode.UPSTREAM, `receipt missing for confirmed tx ${txId}`);
    }

    const blockResponse = await this._jsonRpc(url, 'eth_getBlockByNumber', [tx.blockNumber, false]);
    const block = blockResponse.result;

    return this._transformTransaction({ chain, network, tx, receipt, block });
  }

  streamAddressTransactions(params: AdapterStreamParams): ExternalApiStream {
    const { chain, network, address, args } = params;
    const url = this.getBaseUrl(chain, network);

    return new AlchemyAssetTransferStream(
      url,
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
    const url = this.getBaseUrl(chain, network);

    return new AlchemyAssetTransferStream(
      url,
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
    const { chain, network, date } = params;
    const url = this.getBaseUrl(chain, network);
    const targetTimestamp = Math.floor(new Date(date).getTime() / 1000);

    const MAX_ITERATIONS = 64;
    const latestBlockResp = await this._jsonRpc(url, 'eth_blockNumber', []);
    let high = parseInt(latestBlockResp.result, 16);
    let low = 0;

    const latestBlock = await this._jsonRpc(url, 'eth_getBlockByNumber', [latestBlockResp.result, false]);
    const latestTimestamp = parseInt(latestBlock.result.timestamp, 16);
    if (targetTimestamp >= latestTimestamp) return high; // Target in the future
    if (targetTimestamp <= 0) return 0; // Target before genesis

    // Binary search: largest block with timestamp <= target
    let iterations = 0;
    while (low < high && iterations < MAX_ITERATIONS) {
      const mid = Math.floor((low + high + 1) / 2);
      const blockResp = await this._jsonRpc(url, 'eth_getBlockByNumber', [`0x${mid.toString(16)}`, false]);
      const blockTimestamp = parseInt(blockResp.result.timestamp, 16);

      if (blockTimestamp <= targetTimestamp) {
        low = mid;
      } else {
        high = mid - 1;
      }
      iterations++;
    }

    return low;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Use eth-mainnet as default connectivity check
      const url = `https://eth-mainnet.g.alchemy.com/v2/${this.apiKey}`;
      const response = await this._jsonRpc(url, 'eth_blockNumber', [], 5000);
      return !!response.result;
    } catch {
      return false;
    }
  }

  // --- Private methods ---

  private async _jsonRpc(url: string, method: string, params: any[], timeout?: number): Promise<any> {
    try {
      const response = await axios.post(
        url,
        { jsonrpc: '2.0', id: 1, method, params },
        { timeout: timeout ?? this.requestTimeout }
      );

      // Alchemy may return rate limits as HTTP status or inside JSON-RPC error
      const httpStatus = response.status;
      if (httpStatus === 401 || httpStatus === 403) throw new AdapterError(this.name, AdapterErrorCode.AUTH, 'authentication failed');
      if (httpStatus === 429) throw new AdapterError(this.name, AdapterErrorCode.RATE_LIMIT, 'rate limited');

      if (response.data.error) {
        const rpcError = response.data.error;
        if (rpcError.code === -32602) throw new AdapterError(this.name, AdapterErrorCode.INVALID_REQUEST, rpcError.message);
        const msg = (rpcError.message || '').toLowerCase();
        if (msg.includes('rate limit') || msg.includes('too many requests')) {
          throw new AdapterError(this.name, AdapterErrorCode.RATE_LIMIT, 'rate limited');
        }
        throw new AdapterError(this.name, AdapterErrorCode.UPSTREAM, rpcError.message);
      }
      return response.data;
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      this._classifyError(error);
    }
  }

  private _classifyError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = (error as AxiosError).response?.status;
      if (status === 401 || status === 403) throw new AdapterError(this.name, AdapterErrorCode.AUTH, 'authentication failed');
      if (status === 429) throw new AdapterError(this.name, AdapterErrorCode.RATE_LIMIT, 'rate limited');
      if (error.code === 'ECONNABORTED') throw new AdapterError(this.name, AdapterErrorCode.TIMEOUT, `request timed out after ${this.requestTimeout}ms`);
      if (status && status >= 500) throw new AdapterError(this.name, AdapterErrorCode.UPSTREAM, `HTTP ${status}`);
    }
    throw new AdapterError(this.name, AdapterErrorCode.UPSTREAM, (error as Error)?.message);
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
      // EIP-1559: effectiveGasPrice is the actual price paid; tx.gasPrice may be maxFeePerGas
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

    const blockNum = transfer.blockNum != null
      ? (typeof transfer.blockNum === 'string' && transfer.blockNum.startsWith('0x')
          ? parseInt(transfer.blockNum, 16)
          : parseInt(transfer.blockNum))
      : 0;

    // Guard against missing/undefined blockTimestamp → Invalid Date
    const rawTimestamp = transfer.metadata?.blockTimestamp;
    const blockTime = rawTimestamp ? new Date(rawTimestamp) : new Date(0);
    const safeBlockTime = isNaN(blockTime.getTime()) ? new Date(0) : blockTime;

    const transformed = {
      chain,
      network,
      txid: transfer.hash,
      blockHeight: blockNum,
      blockHash: '',
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
 * Custom stream for Alchemy's alchemy_getAssetTransfers API.
 * Queries both fromAddress AND toAddress to capture all directions,
 * then deduplicates by uniqueId.
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
    // Pass URL to ExternalApiStream — we override _read() entirely
    super(url, {}, alchemyParams.args);
    this.requestTimeout = alchemyParams.requestTimeout ?? 30000;
    // Validate address before any requests
    try {
      Web3.utils.toChecksumAddress(alchemyParams.address);
    } catch {
      process.nextTick(() => this.emit('error', new AdapterError('Alchemy', AdapterErrorCode.INVALID_REQUEST, `invalid address: ${alchemyParams.address}`)));
    }
  }

  async _read() {
    try {
      const { address, args, category, contractAddresses } = this.alchemyParams;

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

      const allTransfers = [
        ...(fromData?.transfers || []),
        ...(toData?.transfers || [])
      ];

      for (const transfer of allTransfers) {
        const key = transfer.uniqueId || `${transfer.hash}:${transfer.category}`;
        if (this.seenTxHashes.has(key)) continue;
        this.seenTxHashes.add(key);

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

      if (!this.pageKey && !this.toPageKey) {
        this.push(null);
      }
      this.page++;
    } catch (error) {
      if (error instanceof AdapterError) {
        this.emit('error', error);
      } else if (axios.isAxiosError(error)) {
        const status = (error as AxiosError).response?.status;
        if (status === 429) this.emit('error', new AdapterError('Alchemy', AdapterErrorCode.RATE_LIMIT, 'rate limited'));
        else if (status === 401 || status === 403) this.emit('error', new AdapterError('Alchemy', AdapterErrorCode.AUTH, 'authentication failed'));
        else if (error.code === 'ECONNABORTED') this.emit('error', new AdapterError('Alchemy', AdapterErrorCode.TIMEOUT, `request timed out after ${this.requestTimeout}ms`));
        else this.emit('error', new AdapterError('Alchemy', AdapterErrorCode.UPSTREAM, `HTTP ${status}`));
      } else {
        this.emit('error', new AdapterError('Alchemy', AdapterErrorCode.UPSTREAM, (error as Error)?.message));
      }
    }
  }
}
