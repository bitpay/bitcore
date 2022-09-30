import { BaseEVMStateProvider } from '../../../providers/chain-state/evm/api/csp';

export class ETHStateProvider extends BaseEVMStateProvider {}

export const ETH = new ETHStateProvider('ETH');
