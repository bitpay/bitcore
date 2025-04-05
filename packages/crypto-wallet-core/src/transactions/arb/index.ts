import { ERC20TxProvider } from '../erc20';
import { ETHTxProvider } from '../eth';

export class ARBTxProvider extends ETHTxProvider {
  constructor() {
    super('ARB');
  }
}

export class ARBERC20TxProvider extends ERC20TxProvider {
  constructor() {
    super('ARB');
  }
}