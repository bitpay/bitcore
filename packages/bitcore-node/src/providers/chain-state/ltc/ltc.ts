import { BTCStateProvider } from '../btc/btc';
import { CSP } from '../../../types/namespaces/ChainStateProvider';

export class LTCStateProvider extends BTCStateProvider {
  constructor(chain: string = 'LTC') {
    super(chain);
  }

  async getFee(params: CSP.GetEstimateSmartFeeParams) {
    const { chain, network } = params;
    return { feerate: await this.getRPC(chain, network).getEstimateFee() };
  }
}
