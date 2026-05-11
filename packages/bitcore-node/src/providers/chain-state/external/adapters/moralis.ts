import axios from 'axios';
import config from '../../../../config';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import { ExternalApiStream } from '../streams/apiStream';
import {
  type AdapterBlockByDateParams,
  type AdapterStreamParams,
  type AdapterTransactionParams,
  type IIndexedAPIAdapter
} from './IIndexedAPIAdapter';
import { AdapterError, AdapterErrorCode } from './errors';
import {
  buildMoralisQueryString,
  formatMoralisChainId,
  transformMoralisQueryParams,
  transformMoralisTokenTransfer,
  transformMoralisTransaction
} from './moralis-utils';
import type { IMultiProviderConfig } from '../../../../types/Config';
import type { IEVMTransactionTransformed } from '../../evm/types';
import type { AxiosError } from 'axios';

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

export class MoralisAdapter implements IIndexedAPIAdapter {
  readonly name = 'Moralis';

  private apiKey: string;
  private baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  private headers: Record<string, string>;
  private requestTimeout: number;

  constructor(providerConfig: IMultiProviderConfig) {
    const apiKey = config.externalProviders?.moralis?.apiKey;
    if (!apiKey) throw new Error('MoralisAdapter: apiKey is required in config.externalProviders.moralis');
    this.apiKey = apiKey;
    this.requestTimeout = providerConfig.requestTimeout ?? 30000;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };
  }

  async getTransaction(params: AdapterTransactionParams): Promise<IEVMTransactionTransformed | undefined> {
    const { chain, network, chainId, txId } = params;

    if (!TX_HASH_REGEX.test(txId)) {
      throw new AdapterError(this.name, AdapterErrorCode.INVALID_REQUEST, `invalid txId format: ${txId}`);
    }

    const query = buildMoralisQueryString({
      chain: formatMoralisChainId(chainId),
      include: 'internal_transactions'
    });

    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/${txId}${query}`,
        { headers: this.headers, timeout: this.requestTimeout }
      );
      if (!response.data) return undefined;
      return transformMoralisTransaction({ chain, network, ...response.data });
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      if (axios.isAxiosError(error) && (error as AxiosError).response?.status === 404) {
        return undefined;
      }
      this._classifyAndThrow(error);
    }
  }

  streamAddressTransactions(params: AdapterStreamParams): ExternalApiStream {
    const { chainId, chain, network, address, args } = params;
    const query = transformMoralisQueryParams({ chainId, args });
    const queryStr = buildMoralisQueryString({
      ...query,
      order: (args as any).order ?? query.order ?? 'DESC',
      limit: args.pageSize || 10,
      include: 'internal_transactions'
    });

    const streamArgs = {
      ...args,
      transform: (tx: any) => {
        const _tx: any = transformMoralisTransaction({ chain, network, ...tx });
        const confirmations = args.tipHeight && Number.isFinite(_tx.blockHeight) ? args.tipHeight - _tx.blockHeight + 1 : 0;
        return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true });
      }
    };

    return new ExternalApiStream(
      `${this.baseUrl}/${address}${queryStr}`,
      this.headers,
      streamArgs
    );
  }

  streamERC20Transfers(params: AdapterStreamParams & { tokenAddress: string }): ExternalApiStream {
    const { chainId, chain, network, address, tokenAddress, args } = params;
    const query = transformMoralisQueryParams({ chainId, args });
    const queryStr = buildMoralisQueryString({
      ...query,
      order: (args as any).order ?? query.order ?? 'DESC',
      limit: args.pageSize || 10,
      contract_addresses: [tokenAddress]
    });

    const streamArgs = {
      ...args,
      transform: (tx: any) => {
        const _tx: any = transformMoralisTokenTransfer({ chain, network, ...tx });
        const confirmations = args.tipHeight && Number.isFinite(_tx.blockHeight) ? args.tipHeight - _tx.blockHeight + 1 : 0;
        return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true });
      }
    };

    return new ExternalApiStream(
      `${this.baseUrl}/${address}/erc20/transfers${queryStr}`,
      this.headers,
      streamArgs
    );
  }

  async getBlockNumberByDate(params: AdapterBlockByDateParams): Promise<number> {
    const { chainId, date } = params;
    const queryStr = buildMoralisQueryString({
      chain: formatMoralisChainId(chainId),
      date: new Date(date).getTime()
    });

    try {
      const response = await axios.get(
        `${this.baseUrl}/dateToBlock${queryStr}`,
        { headers: this.headers, timeout: this.requestTimeout }
      );
      return response.data.block as number;
    } catch (error) {
      this._classifyAndThrow(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/web3/version`, {
        headers: this.headers,
        timeout: 5000
      });
      return true;
    } catch {
      return false;
    }
  }

  private _classifyAndThrow(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = (error as AxiosError).response?.status;
      if (status === 401 || status === 403) {
        throw new AdapterError(this.name, AdapterErrorCode.AUTH);
      }
      if (status === 429) {
        throw new AdapterError(this.name, AdapterErrorCode.RATE_LIMIT);
      }
      if ((error as any).code === 'ECONNABORTED') {
        throw new AdapterError(this.name, AdapterErrorCode.TIMEOUT, `timed out after ${this.requestTimeout}ms`);
      }
      if (status && status >= 500) {
        throw new AdapterError(this.name, AdapterErrorCode.UPSTREAM, `HTTP ${status}`);
      }
    }
    throw new AdapterError(this.name, AdapterErrorCode.UPSTREAM, (error as Error)?.message);
  }
}
