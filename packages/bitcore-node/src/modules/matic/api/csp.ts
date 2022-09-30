import { BaseEVMStateProvider } from '../../../providers/chain-state/evm/api/csp';

export class MATICStateProvider extends BaseEVMStateProvider {}

export const MATIC = new MATICStateProvider('MATIC');
