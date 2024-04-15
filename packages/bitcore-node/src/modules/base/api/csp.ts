import { BaseEVMStateProvider} from '../../../providers/chain-state/evm/api/csp';

export class BASEStateProvider extends BaseEVMStateProvider {
  constructor() {
    super('BASE');
  }
}

export const BASE = new BASEStateProvider();