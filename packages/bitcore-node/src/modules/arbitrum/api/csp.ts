import { BaseEVMStateProvider } from '../../../providers/chain-state/evm/api/csp';
export class ARBStateProvider extends BaseEVMStateProvider {
  constructor() {
    super('ARB');
  }
}
export const ARB = new ARBStateProvider();