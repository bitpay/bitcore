import { BaseEVMStateProvider } from '../../../providers/chain-state/evm/api/csp';

export class ETHStateProvider extends BaseEVMStateProvider {
  constructor() {
    super('ETH');
  }
}

export const ETH = new ETHStateProvider();
