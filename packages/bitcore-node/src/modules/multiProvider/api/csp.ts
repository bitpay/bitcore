// src/modules/multiProvider/api/csp.ts

import { Readable, PassThrough } from 'stream';
import { BaseEVMStateProvider, BuildWalletTxsStreamParams } from '../../../providers/chain-state/evm/api/csp';
import { IIndexedAPIAdapter } from '../../../providers/chain-state/external/adapters/IIndexedAPIAdapter';
import { AdapterFactory } from '../../../providers/chain-state/external/adapters/factory';
import { AdapterError, InvalidRequestError, AllProvidersUnavailableError, TimeoutError } from '../../../providers/chain-state/external/adapters/errors';
import { ProviderHealth } from '../../../providers/chain-state/external/providerHealth';
import { ExternalApiStream } from '../../../providers/chain-state/external/streams/apiStream';
import { Config } from '../../../services/config';
import { IProviderConfig } from '../../../types/Config';
import { WalletAddressStorage } from '../../../models/walletAddress';
import logger from '../../../logger';
import { EVMTransactionStorage } from '../../../providers/chain-state/evm/models/transaction';
import { EVMTransactionJSON } from '../../../providers/chain-state/evm/types';
import {
  GetBlockBeforeTimeParams,
  StreamAddressUtxosParams,
  StreamTransactionParams,
  StreamWalletTransactionsParams
} from '../../../types/namespaces/ChainStateProvider';

interface ProviderWithHealth {
  adapter: IIndexedAPIAdapter;
  health: ProviderHealth;
  priority: number;
}

export class MultiProviderEVMStateProvider extends BaseEVMStateProvider {
  /**
   * Keyed by network name (e.g., 'mainnet', 'testnet').
   * Each network has its own sorted array of providers with independent health trackers.
   * This prevents the last-network-wins overwrite bug.
   */
  private providersByNetwork: Map<string, ProviderWithHealth[]> = new Map();

  constructor(chain: string = 'ETH') {
    super(chain);
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const chainConfig = Config.get().chains[this.chain];
    if (!chainConfig) {
      logger.warn(`No config found for chain ${this.chain}`);
      return;
    }

    // Iterate networks - each gets its own provider array with independent health trackers
    for (const [network, networkConfig] of Object.entries(chainConfig)) {
      const evmConfig = networkConfig as any;
      const externalProviders: IProviderConfig[] = evmConfig.externalProviders || [];

      if (externalProviders.length === 0) {
        logger.warn(`No externalProviders configured for ${this.chain}:${network}`);
        continue;
      }

      const providers = externalProviders
        .map((providerConfig) => ({
          adapter: AdapterFactory.createAdapter(providerConfig.name, providerConfig.config),
          health: new ProviderHealth(
            providerConfig.name,
            providerConfig.healthConfig,
            { chain: this.chain, network }
          ),
          priority: providerConfig.priority
        }))
        .sort((a, b) => a.priority - b.priority || a.adapter.name.localeCompare(b.adapter.name));

      this.providersByNetwork.set(network, providers);

      logger.info(
        `MultiProvider [${this.chain}:${network}]: Initialized ${providers.length} providers: ` +
        providers.map(p => `${p.adapter.name} (pri=${p.priority})`).join(', ')
      );
    }
  }

  /**
   * Get the providers for a specific network.
   * Throws AllProvidersUnavailableError (-> 503) if no providers are configured.
   */
  private getProvidersForNetwork(network: string): ProviderWithHealth[] {
    const providers = this.providersByNetwork.get(network);
    if (!providers || providers.length === 0) {
      logger.error(`MultiProvider [${this.chain}:${network}]: No externalProviders configured. Check bitcore config.`);
      throw new AllProvidersUnavailableError('config', this.chain, network);
    }
    return providers;
  }

  // @override getTransaction (the PUBLIC method, not just _getTransaction)
  // CRITICAL: BaseEVMStateProvider.getTransaction() wraps _getTransaction() in a try/catch
  // that swallows ALL errors and returns undefined (line 411-414 of csp.ts).
  // We MUST override the public getTransaction() to let AllProvidersUnavailableError
  // and InvalidRequestError propagate to route handlers for correct 503/400 mapping.
  async getTransaction(params: StreamTransactionParams) {
    try {
      params.network = params.network.toLowerCase();
      const result = await this._getTransaction(params);
      if (result.found) {
        let found = result.found as any;
        const { tipHeight } = result;
        let confirmations = 0;
        if (found.blockHeight && found.blockHeight >= 0) {
          confirmations = tipHeight - found.blockHeight + 1;
        }
        found = await this.populateReceipt(found);
        found = this.populateEffects(found);
        const convertedTx = EVMTransactionStorage._apiTransform(found, { object: true }) as EVMTransactionJSON;
        return { ...convertedTx, confirmations };
      }
      return undefined; // Not found across all providers -> route returns 404
    } catch (err) {
      // Let typed errors propagate for correct HTTP status mapping
      if (err instanceof AllProvidersUnavailableError || err instanceof InvalidRequestError) {
        throw err;
      }
      // All other errors: log and return undefined (preserve base class behavior)
      logger.error('MultiProvider: unexpected error in getTransaction: %o', err);
      return undefined;
    }
  }

  /**
   * Try an adapter call, recording success/failure on the provider's health tracker.
   * InvalidRequestError (bad client input) is re-thrown immediately without recording failure.
   */
  private async withHealthTracking<T>(
    provider: ProviderWithHealth,
    fn: () => Promise<T>
  ): Promise<{ result: T; error?: undefined } | { result?: undefined; error: Error }> {
    try {
      const result = await fn();
      provider.health.recordSuccess();
      return { result };
    } catch (error) {
      const err = error as Error;
      if (err instanceof InvalidRequestError) {
        // Bad input - don't record failure, don't failover. Re-throw immediately.
        throw err;
      }
      provider.health.recordFailure(err);
      return { error: err };
    }
  }

  // Internal implementation: sequential failover for single transaction lookup.
  async _getTransaction(params: StreamTransactionParams): Promise<{ tipHeight: number; found: any }> {
    const { chain, network, txId } = params;
    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const tipHeight = Number(await web3.eth.getBlockNumber());
    const chainId = await this.getChainId({ network });
    const providers = this.getProvidersForNetwork(network);

    let hadError = false;
    let attemptedAny = false;

    for (const provider of providers) {
      if (!provider.health.isAvailable()) {
        logger.debug(`MultiProvider: Skipping ${provider.adapter.name} for ${chain}:${network} (unhealthy)`);
        continue;
      }
      attemptedAny = true;

      const attempt = await this.withHealthTracking(provider, () =>
        provider.adapter.getTransaction({ chain, network, chainId, txId })
      );

      if (attempt.error) {
        hadError = true;
        logger.warn(`MultiProvider: ${provider.adapter.name} failed for tx ${txId}: ${attempt.error.message}`);
        continue;
      }

      if (attempt.result) {
        logger.debug(`MultiProvider: ${provider.adapter.name} returned tx ${txId}`);
        return { tipHeight, found: attempt.result };
      }
      // undefined = not found in this provider's index. Try next (indexing lag).
      logger.debug(`MultiProvider: ${provider.adapter.name} returned undefined for tx ${txId}, trying next`);
      continue;
    }

    if (hadError || !attemptedAny) {
      throw new AllProvidersUnavailableError('getTransaction', chain, network);
    }
    // All providers returned undefined (not found across all indexes) -> 404
    return { tipHeight, found: undefined };
  }

  // @override - Sequential failover for address transaction streaming
  // Uses preflight check: buffers first item before piping to response.
  // Failover only occurs before any response body bytes are written.
  async _buildAddressTransactionsStream(params: StreamAddressUtxosParams) {
    const { req, res, args, network, address } = params;
    const chainId = await this.getChainId({ network });
    const providers = this.getProvidersForNetwork(network);
    const PREFLIGHT_TIMEOUT_MS = 5000;

    // Date-to-block conversion: Alchemy only supports fromBlock/toBlock, not date ranges.
    const resolvedArgs = { ...args };
    if (args.startDate && !args.startBlock) {
      resolvedArgs.startBlock = await this._getBlockNumberByDate({
        date: new Date(args.startDate), chainId, network
      });
      delete resolvedArgs.startDate;
    }
    if (args.endDate && !args.endBlock) {
      resolvedArgs.endBlock = await this._getBlockNumberByDate({
        date: new Date(args.endDate), chainId, network
      });
      delete resolvedArgs.endDate;
    }

    for (const provider of providers) {
      if (!provider.health.isAvailable()) continue;

      try {
        let txStream: ExternalApiStream;

        if (resolvedArgs.tokenAddress) {
          txStream = provider.adapter.streamERC20Transfers({
            chainId,
            chain: this.chain,
            network,
            address,
            tokenAddress: resolvedArgs.tokenAddress,
            args: { limit: 10, ...resolvedArgs } as any
          });
        } else {
          txStream = provider.adapter.streamAddressTransactions({
            chainId,
            chain: this.chain,
            network,
            address,
            args: { limit: 10, ...resolvedArgs } as any
          });
        }

        // Preflight: wait for first data item or error before committing to this provider
        const preflight = await this._preflightStream(txStream, PREFLIGHT_TIMEOUT_MS);
        if (!preflight.success) {
          provider.health.recordFailure(preflight.error || new Error('preflight failed'));
          logger.warn(`MultiProvider: ${provider.adapter.name} preflight failed for ${address}: ${preflight.error?.message}`);
          txStream.destroy();
          continue;
        }

        // Preflight succeeded - commit to this provider
        logger.debug(`MultiProvider: ${provider.adapter.name} streaming ${address} on ${this.chain}:${network}`);
        txStream.on('error', (err) => {
          logger.warn(`MultiProvider: ${provider.adapter.name} mid-stream error for ${address}: ${err.message}`);
          if (err instanceof AdapterError && err.isBreakerable) {
            provider.health.recordFailure(err);
          }
        });
        txStream.on('end', () => provider.health.recordSuccess());

        // Use PassThrough to prepend the buffered first item to the stream.
        let outputStream: Readable = txStream;
        if (preflight.firstItem) {
          const wrapper = new PassThrough({ objectMode: true });
          wrapper.write(preflight.firstItem);
          txStream.resume();
          txStream.pipe(wrapper);
          outputStream = wrapper;
        } else {
          txStream.resume();
        }

        const result = await ExternalApiStream.onStream(outputStream, req!, res!);
        if (!result?.success) {
          logger.error('Error mid-stream (streamAddressTransactions): %o', result.error?.log || result.error);
        }
        return; // Stream handled, exit
      } catch (error) {
        if (error instanceof InvalidRequestError) throw error; // 400 - no failover
        provider.health.recordFailure(error as Error);
        logger.warn(`MultiProvider: ${provider.adapter.name} stream failed for ${address}: ${(error as Error).message}`);
        continue;
      }
    }

    // All providers failed
    throw new AllProvidersUnavailableError('streamAddressTransactions', this.chain, network);
  }

  /**
   * Preflight check: wait for the first data item or error from a stream.
   * Returns within timeoutMs. If the stream emits data first, returns { success: true, firstItem }.
   * If the stream emits error or times out, returns { success: false, error }.
   * If the stream ends immediately (empty result), returns { success: true, firstItem: null }.
   */
  private _preflightStream(stream: ExternalApiStream, timeoutMs: number): Promise<{
    success: boolean;
    firstItem?: any;
    error?: Error;
  }> {
    return new Promise((resolve) => {
      let resolved = false;
      const cleanup = () => {
        clearTimeout(timer);
        stream.removeListener('data', onData);
        stream.removeListener('error', onError);
        stream.removeListener('end', onEnd);
      };

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: false, error: new TimeoutError('preflight', timeoutMs) });
        }
      }, timeoutMs);

      const onData = (item: any) => {
        if (!resolved) {
          resolved = true;
          stream.pause();
          cleanup();
          resolve({ success: true, firstItem: item });
        }
      };

      const onError = (err: Error) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: false, error: err });
        }
      };

      const onEnd = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: true, firstItem: null });
        }
      };

      stream.on('data', onData);
      stream.on('error', onError);
      stream.on('end', onEnd);
    });
  }

  // @override - Sequential failover for wallet transaction streaming
  async _buildWalletTransactionsStream(params: StreamWalletTransactionsParams, streamParams: BuildWalletTxsStreamParams) {
    const { network, args } = params;
    let { transactionStream } = streamParams;
    const { walletAddresses } = streamParams;
    const chainId = await this.getChainId({ network });
    const providers = this.getProvidersForNetwork(network);

    let activeProvider = providers.find(p => p.health.isAvailable());
    if (!activeProvider) {
      throw new AllProvidersUnavailableError('walletTransactions', this.chain, network);
    }
    logger.debug(`MultiProvider: wallet stream using ${activeProvider.adapter.name} for ${this.chain}:${network} (${walletAddresses.length} addresses)`);

    for (const address of walletAddresses) {
      try {
        const txStream = activeProvider.adapter.streamAddressTransactions({
          chainId,
          chain: this.chain,
          network,
          address,
          args: { order: 'ASC', ...args } as any
        });

        transactionStream = txStream.eventPipe(transactionStream);

        // Non-blocking side effects
        WalletAddressStorage.updateLastQueryTime({ chain: this.chain, network, address })
          .catch(e => logger.warn(`Failed to update ${this.chain}:${network} address lastQueryTime: %o`, e));
      } catch (error) {
        activeProvider.health.recordFailure(error as Error);
        const nextProvider = providers.find(p => p.health.isAvailable());
        if (!nextProvider) {
          logger.error(`MultiProvider: ${activeProvider.adapter.name} wallet stream failed for ${address}, no providers left`);
          throw error;
        }
        logger.warn(`MultiProvider: ${activeProvider.adapter.name} wallet stream failed for ${address}, failing over to ${nextProvider.adapter.name}`);
        activeProvider = nextProvider;
      }
    }

    return transactionStream;
  }

  // @override
  async _getBlockNumberByDate(params: { date: Date; chainId: string | bigint; network?: string }) {
    const { date, chainId } = params;
    const network = (params as any).network || this.providersByNetwork.keys().next().value;
    const providers = this.getProvidersForNetwork(network);

    for (const provider of providers) {
      if (!provider.health.isAvailable()) continue;

      const attempt = await this.withHealthTracking(provider, () =>
        provider.adapter.getBlockNumberByDate({ chainId, date })
      );

      if (attempt.error) {
        logger.warn(`MultiProvider: ${provider.adapter.name} getBlockNumberByDate failed: ${attempt.error.message}`);
        continue;
      }

      logger.debug(`MultiProvider: ${provider.adapter.name} resolved date to block ${attempt.result}`);
      return await this._verifyBlockBeforeDate(network, attempt.result!, date);
    }

    throw new AllProvidersUnavailableError('getBlockNumberByDate', this.chain, network);
  }

  /**
   * Adapters give an approximate block number for a date. This double-checks it
   * via RPC and nudges it forward or backward (up to 16 blocks) so the final
   * block's timestamp is at or before the target date. Falls back to a full
   * binary search if the adapter was way off.
   */
  private async _verifyBlockBeforeDate(network: string, candidateBlock: number, date: Date): Promise<number> {
    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const targetTimestamp = Math.floor(date.getTime() / 1000);
    const MAX_ADJUSTMENTS = 16;
    let blockNum = candidateBlock;

    let block = await web3.eth.getBlock(blockNum);
    if (!block) return blockNum;

    // If candidate is too late, decrement
    let adjustments = 0;
    while (Number(block.timestamp) > targetTimestamp && blockNum > 0 && adjustments < MAX_ADJUSTMENTS) {
      blockNum--;
      block = await web3.eth.getBlock(blockNum);
      adjustments++;
    }

    if (Number(block.timestamp) > targetTimestamp) {
      logger.warn(`MultiProvider: block verification exceeded ${MAX_ADJUSTMENTS} adjustments, falling back to binary search`);
      return this._binarySearchBlockByTimestamp(web3, targetTimestamp);
    }

    // If candidate is before target, try incrementing to find the largest valid block
    adjustments = 0;
    while (adjustments < MAX_ADJUSTMENTS) {
      const nextBlock = await web3.eth.getBlock(blockNum + 1);
      if (!nextBlock || Number(nextBlock.timestamp) > targetTimestamp) break;
      blockNum++;
      adjustments++;
    }

    return blockNum;
  }

  /** Fallback: find the latest block with timestamp <= target using only RPC */
  private async _binarySearchBlockByTimestamp(web3: any, targetTimestamp: number): Promise<number> {
    const latestBlock = await web3.eth.getBlock('latest');
    let high = Number(latestBlock.number);
    let low = 0;
    const MAX_ITERATIONS = 64;
    let iterations = 0;

    while (low < high && iterations < MAX_ITERATIONS) {
      const mid = Math.floor((low + high + 1) / 2);
      const block = await web3.eth.getBlock(mid);
      if (Number(block.timestamp) <= targetTimestamp) {
        low = mid;
      } else {
        high = mid - 1;
      }
      iterations++;
    }
    return low;
  }

  // @override - uses indexed API providers for date->block resolution
  async getBlockBeforeTime(params: GetBlockBeforeTimeParams) {
    const { network, time } = params;
    const date = new Date(time);
    const chainId = await this.getChainId({ network });
    const blockNum = await this._getBlockNumberByDate({ date, chainId, network });
    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const block = await web3.eth.getBlock(blockNum);
    return block;
  }

  // Note: getLocalTip(), _getBlocks() are inherited from BaseEVMStateProvider and use RPC.

  // Internal-only health check for debugging/monitoring.
  async getProviderHealth(): Promise<Record<string, Record<string, any>>> {
    const health: Record<string, Record<string, any>> = {};

    for (const [network, providers] of this.providersByNetwork.entries()) {
      health[network] = {};
      for (const provider of providers) {
        const status = provider.health.getStatus();
        let apiHealthy = false;
        try {
          apiHealthy = await provider.adapter.healthCheck();
        } catch { /* health check failed */ }

        health[network][provider.adapter.name] = {
          priority: provider.priority,
          apiHealthy,
          ...status
        };
      }
    }

    return health;
  }
}
