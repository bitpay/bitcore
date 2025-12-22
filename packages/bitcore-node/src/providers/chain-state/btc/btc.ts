/**
 * Bitcoin State Provider - LOCAL MongoDB Implementation
 *
 * NOTE! THIS IS THE LOCAL BTC IMPLEMENTATION:
 * This class extends InternalStateProvider and adds Bitcoin-specific fee estimation logic.
 * It's located in providers/chain-state/btc/ because it's the BASE local implementation.
 *
 * WHAT THIS CLASS DOES:
 * - Inherits all UTXO methods from InternalStateProvider (streamAddressTransactions, etc.)
 * - Overrides getFee() to aggregate multiple fee sources (RPC + BlockCypher + Mempool.space + Bitgo)
 * - ALL queries still use LOCAL MongoDB (CoinStorage, TransactionStorage, BitcoinBlockStorage)
 *
 * CURRENT STATE:
 * - This IS the production BTC provider (uses local MongoDB + RPC)
 * - BCHStateProvider extends THIS class (not InternalStateProvider directly)
 * - Fee estimation already uses external APIs (BlockCypher, Mempool.space, Bitgo) for ESTIMATES ONLY
 *   (queries still go to MongoDB, only fee calculation uses external APIs)
 *
 * TODO! FOR BLOCKCYPHER HYBRID PROVIDER:
 * Create modules/blockcypher/api/csp.ts to avoid local MongoDB entirely:
 * ```
 * export class BlockCypherStateProvider extends BTCStateProvider {
 *   constructor(chain: string = 'BTC') {
 *     super(chain);
 *   }
 *
 *   // Override to use BlockCypher API instead of local CoinStorage
 *   async streamAddressTransactions(params) {
 *     const stream = new ExternalApiStream(
 *       `https://api.blockcypher.com/v1/btc/main/addrs/${params.address}`,
 *       { 'X-API-Key': config.blockCypher.apiKey },
 *       { transform: (tx) => this._transformBlockCypherTx(tx) }
 *     );
 *     return stream;
 *   }
 *
 *   // Override to use BlockCypher balance endpoint
 *   async getBalanceForAddress(params) {
 *     const response = await axios.get(
 *       `https://api.blockcypher.com/v1/btc/main/addrs/${params.address}/balance`
 *     );
 *     return {
 *       confirmed: response.data.balance,
 *       unconfirmed: response.data.unconfirmed_balance,
 *       balance: response.data.final_balance
 *     };
 *   }
 *
 *   // Override to check local first, then BlockCypher
 *   async getTransaction(params) {
 *     const local = await super.getTransaction(params);
 *     if (local) return local;
 *     return await this._getTransactionFromBlockCypher(params);
 *   }
 *
 *   // Keep inherited: broadcastTransaction, getFee (still use RPC/fee aggregation)
 * }
 * ```
 *
 * See: /Users/lyambo/code/.notes/BCN-Node-Providers.html for migration strategy
 */

import { CacheStorage } from '../../../models/cache';
import { NetworkType } from '../../../types/ChainNetwork';
import { SmartFeeResponse } from '../../../types/FeeProvider';
import { GetEstimateSmartFeeParams } from '../../../types/namespaces/ChainStateProvider';
import * as FeeProviders from '../../fee';
import { InternalStateProvider } from '../internal/internal';

export class BTCStateProvider extends InternalStateProvider {
  constructor(chain: string = 'BTC') {
    super(chain);
  }

  // NOTE! FEE AGGREGATION: This already uses external APIs for fee ESTIMATION
  // But transaction/balance queries still use local MongoDB
  // TODO! A full BlockCypher provider would use their API for ALL queries, not just fees
  async getFee(params: GetEstimateSmartFeeParams) {
    const { chain, network, target, mode } = params;
    const cacheKey = `getFee-${chain}-${network}-${target}${mode ? '-' + mode.toLowerCase() : ''}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        // NOTE! Already aggregates fees from multiple sources:
        // 1. Local RPC (this.getRPC)
        // 2. BlockCypher API (FeeProviders.BlockCypher)
        // 3. Mempool.space API (FeeProviders.MempoolSpace)
        // 4. Bitgo API (FeeProviders.Bitgo)
        const rpcEstimate = await this.getRPC(chain, network).getEstimateSmartFee(Number(target), mode) as SmartFeeResponse;
        const estimates = (await Promise.allSettled([
          FeeProviders.BlockCypher.getFee(network as NetworkType, target),
          FeeProviders.MempoolSpace.getFee(network as NetworkType, target),
          FeeProviders.Bitgo.getFee(network as NetworkType, target),
        ])
          .then(results => results.filter(result => result.status === 'fulfilled')) as PromiseFulfilledResult<number>[])
          .map(result => result.value);

        // NOTE: rpcEstimate is in BTC per kilobyte, estimates is in sats per byte

        let feerate = rpcEstimate.feerate * 1e5; // convert to sats per byte
        feerate = feerate + estimates.reduce((acc, v) => acc += v, 0);
        feerate = Math.ceil(feerate / (estimates.length + 1)); // NOTE! Average all sources
        feerate = Number((feerate / 1e5).toFixed(8)); // convert to BTC per KB

        return {
          feerate,
          blocks: target,
        };
      },
      5 * CacheStorage.Times.Minute
    );
  }
}
