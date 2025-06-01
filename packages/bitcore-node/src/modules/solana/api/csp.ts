import { BaseSVMStateProvider } from '../../../providers/chain-state/svm/api/csp';
export class SOLStateProvider extends BaseSVMStateProvider {
  constructor() {
    super();
  }
}
export const SOL = new SOLStateProvider()