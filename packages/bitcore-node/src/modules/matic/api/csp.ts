import { BaseEVMStateProvider } from '../../../providers/chain-state/evm/api/csp';

export class MATICStateProvider extends BaseEVMStateProvider {
  constructor() {
    super('MATIC');
  }
}

export const MATIC = new MATICStateProvider();
