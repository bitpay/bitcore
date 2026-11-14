import { CacheStorage } from '../../../models/cache';
import { Event } from '../../../services/event';
import { GetEstimateSmartFeeParams } from '../../../types/namespaces/ChainStateProvider';
import { BTCStateProvider } from '../btc/btc';

export class BCHStateProvider extends BTCStateProvider {
  constructor(chain: string = 'BCH') {
    super(chain);
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    const { chain, network } = params;
    const cacheKey = `getFee-${chain}-${network}`;
    return CacheStorage.getGlobalAndRefresh(
      cacheKey,
      async () => {
        return { feerate: await this.getRPC(chain, network).getEstimateFee() };
      },
      5 * CacheStorage.Times.Minute,
      Event.lastBlockTime(chain, network)
    );
  }
}
