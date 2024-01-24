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

  async getFee(params: GetEstimateSmartFeeParams) {
    const { chain, network, target, mode } = params;
    const cacheKey = `getFee-${chain}-${network}-${target}${mode ? '-' + mode.toLowerCase() : ''}`;
    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        const rpcEstimate = await this.getRPC(chain, network).getEstimateSmartFee(Number(target), mode) as SmartFeeResponse;
        let estimates = (await Promise.allSettled([
          FeeProviders.BlockCypher.getFee(network as NetworkType, target),
          FeeProviders.MempoolSpace.getFee(network as NetworkType, target),
          FeeProviders.Bitgo.getFee(network as NetworkType, target),
        ])
          .then(results => results.filter(result => result.status === 'fulfilled')) as PromiseFulfilledResult<number>[])
          .map(result => result.value);

        // NOTE: rpcEstimate is in BTC per kilobyte, estimates is in sats per byte

        let feerate = rpcEstimate.feerate * 1e5; // convert to sats per byte
        feerate = feerate + estimates.reduce((acc, v) => acc += v, 0);
        feerate = Math.ceil(feerate / (estimates.length + 1));
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
