import { Readable, PassThrough } from 'stream';
import { LRUCache } from 'lru-cache';
import { BaseEVMStateProvider, BuildWalletTxsStreamParams } from '../../../providers/chain-state/evm/api/csp';
import { IIndexedAPIAdapter } from '../../../providers/chain-state/external/adapters/IIndexedAPIAdapter';
import { AdapterFactory } from '../../../providers/chain-state/external/adapters/factory';
import { AdapterError, InvalidRequestError, AllProvidersUnavailableError, TimeoutError } from '../../../providers/chain-state/external/adapters/errors';
import { ProviderHealth } from '../../../providers/chain-state/external/providerHealth';
import { ExternalApiStream } from '../../../providers/chain-state/external/streams/apiStream';
import { EVMBlockStorage } from '../../../providers/chain-state/evm/models/block';
import { Config } from '../../../services/config';
import { IMultiProviderConfig } from '../../../types/Config';
import { IBlock } from '../../../types/Block';
import { WalletAddressStorage } from '../../../models/walletAddress';
import logger from '../../../logger';
import { EVMTransactionStorage } from '../../../providers/chain-state/evm/models/transaction';
import { EVMTransactionJSON } from '../../../providers/chain-state/evm/types';
import { normalizeChainNetwork } from '../../../utils';
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
  private providersByNetwork: Map<string, ProviderWithHealth[]> = new Map();
  blockAtTimeCache: { [key: string]: LRUCache<string, IBlock> } = {};

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

    // Each network gets its own provider array with independent health trackers
    for (const [network, networkConfig] of Object.entries(chainConfig)) {
      const evmConfig = networkConfig as any;
      const externalProviders: IMultiProviderConfig[] = evmConfig.externalProviders || [];

      if (externalProviders.length === 0) {
        logger.warn(`No externalProviders configured for ${this.chain}:${network}`);
        continue;
      }

      const providers = externalProviders
        .map((providerConfig) => ({
          adapter: AdapterFactory.createAdapter(providerConfig),
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

  private getProvidersForNetwork(network: string): ProviderWithHealth[] {
    const providers = this.providersByNetwork.get(network);
    if (!providers || providers.length === 0) {
      logger.error(`MultiProvider [${this.chain}:${network}]: No externalProviders configured. Check bitcore config.`);
      throw new AllProvidersUnavailableError('config', this.chain, network);
    }
    return providers;
  }

  // @override
  // BaseEVMStateProvider.getTransaction() swallows all errors and returns undefined.
  // We override to let AllProvidersUnavailableError and InvalidRequestError propagate
  // for correct 503/400 HTTP status mapping.
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
      return undefined;
    } catch (err) {
      if (err instanceof AllProvidersUnavailableError || err instanceof InvalidRequestError) {
        throw err;
      }
      logger.error('MultiProvider: unexpected error in getTransaction: %o', err);
      return undefined;
    }
  }

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
        throw err; // Bad input — don't record failure, don't failover
      }
      provider.health.recordFailure(err);
      return { error: err };
    }
  }

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
        return { tipHeight, found: attempt.result };
      }
      // undefined = not found in this provider's index, try next (indexing lag)
      logger.debug(`MultiProvider: ${provider.adapter.name} returned undefined for tx ${txId}, trying next`);
      continue;
    }

    if (hadError || !attemptedAny) {
      throw new AllProvidersUnavailableError('getTransaction', chain, network);
    }
    // All providers returned undefined — not found across all indexes
    return { tipHeight, found: undefined };
  }

  // @override — sequential failover with preflight check.
  // Buffers first item before piping to response; failover only before response bytes are written.
  async _buildAddressTransactionsStream(params: StreamAddressUtxosParams) {
    const { req, res, args, network, address } = params;
    const chainId = await this.getChainId({ network });
    const providers = this.getProvidersForNetwork(network);
    const PREFLIGHT_TIMEOUT_MS = 5000;

    // Convert date ranges to block ranges (Alchemy only supports fromBlock/toBlock)
    const resolvedArgs = { ...args };
    if (args.startDate && !args.startBlock) {
      resolvedArgs.startBlock = await this._getBlockNumberByDate({
        date: new Date(args.startDate), chain: this.chain, chainId, network
      });
      delete resolvedArgs.startDate;
    }
    if (args.endDate && !args.endBlock) {
      resolvedArgs.endBlock = await this._getBlockNumberByDate({
        date: new Date(args.endDate), chain: this.chain, chainId, network
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

        logger.debug(`MultiProvider: ${provider.adapter.name} streaming ${address} on ${this.chain}:${network}`);
        txStream.on('error', (err) => {
          logger.warn(`MultiProvider: ${provider.adapter.name} mid-stream error for ${address}: ${err.message}`);
          if (err instanceof AdapterError && err.affectsHealth) {
            provider.health.recordFailure(err);
          }
        });
        txStream.on('end', () => provider.health.recordSuccess());

        // PassThrough prepends the buffered first item to the stream
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
        return; // Stream handled
      } catch (error) {
        if (error instanceof InvalidRequestError) throw error; // 400 — no failover
        provider.health.recordFailure(error as Error);
        logger.warn(`MultiProvider: ${provider.adapter.name} stream failed for ${address}: ${(error as Error).message}`);
        continue;
      }
    }

    // All providers failed
    throw new AllProvidersUnavailableError('streamAddressTransactions', this.chain, network);
  }

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

  // @override — sequential failover for wallet transaction streaming
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
  async _getBlockNumberByDate(params: { date: Date; chain?: string; chainId: string | bigint; network?: string }) {
    const { date, chainId } = params;
    const chain = params.chain || this.chain;
    const network = params.network || this.providersByNetwork.keys().next().value!;
    const providers = this.getProvidersForNetwork(network);

    for (const provider of providers) {
      if (!provider.health.isAvailable()) continue;

      const attempt = await this.withHealthTracking(provider, () =>
        provider.adapter.getBlockNumberByDate({ chain, network, chainId, date })
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

  private async _verifyBlockBeforeDate(network: string, candidateBlock: number, date: Date): Promise<number> {
    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const targetTimestamp = Math.floor(date.getTime() / 1000);
    const MAX_ADJUSTMENTS = 16;
    let blockNum = candidateBlock;

    let block = await web3.eth.getBlock(blockNum);
    if (!block) return blockNum;

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

    adjustments = 0;
    while (adjustments < MAX_ADJUSTMENTS) {
      const nextBlock = await web3.eth.getBlock(blockNum + 1);
      if (!nextBlock || Number(nextBlock.timestamp) > targetTimestamp) break;
      blockNum++;
      adjustments++;
    }

    return blockNum;
  }

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

  // @override
  async getBlockBeforeTime(params: GetBlockBeforeTimeParams) {
    const { chain, network, time } = params;
    const date = new Date(time || Date.now());
    const chainNetwork = normalizeChainNetwork(chain, network);

    if (!this.blockAtTimeCache[chainNetwork]) {
      this.blockAtTimeCache[chainNetwork] = new LRUCache<string, IBlock>({ max: 1000 });
    }
    const cachedBlock = this.blockAtTimeCache[chainNetwork].get(date.toISOString());
    if (cachedBlock !== undefined) {
      return cachedBlock;
    }

    const chainId = await this.getChainId({ network });
    const blockNum = await this._getBlockNumberByDate({ date, chain: this.chain, chainId, network });
    if (!blockNum) {
      return null;
    }

    const { web3 } = await this.getWeb3(network, { type: 'historical' });
    const rawBlock = await web3.eth.getBlock(blockNum);
    const block = EVMBlockStorage.convertRawBlock(this.chain, network, rawBlock);
    this.blockAtTimeCache[chainNetwork].set(date.toISOString(), block);
    return block;
  }

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
