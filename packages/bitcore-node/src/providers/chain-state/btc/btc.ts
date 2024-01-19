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

        let feerate = rpcEstimate.feerate;
        feerate = feerate * 1e5 + estimates.reduce((acc, v) => acc += v, 0);
        feerate = Math.ceil(feerate / (estimates.length + 1));

        return {
          feerate,
          blocks: target,
        };
      },
      5 * CacheStorage.Times.Minute
    );
  }
}
