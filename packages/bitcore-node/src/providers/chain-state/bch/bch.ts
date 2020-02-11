import { GetEstimateSmartFeeParams } from '../../../types/namespaces/ChainStateProvider';
import { BTCStateProvider } from '../btc/btc';

export class BCHStateProvider extends BTCStateProvider {
  constructor(chain: string = 'BCH') {
    super(chain);
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    const { chain, network } = params;
    return { feerate: await this.getRPC(chain, network).getEstimateFee() };
  }
}
