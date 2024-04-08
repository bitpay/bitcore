import { BaseEVMStateProvider } from '../../../providers/chain-state/evm/api/csp';
export class OPStateProvider extends BaseEVMStateProvider {
  constructor() {
    super('OP');
  }
}
export const OP = new OPStateProvider();