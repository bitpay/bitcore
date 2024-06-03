import { ERC20TxProvider } from '../erc20';
import { ETHTxProvider } from '../eth';

export class BASETxProvider extends ETHTxProvider {
  constructor() {
    super('BASE');
  }
}

export class BASEERC20TxProvider extends ERC20TxProvider {
  constructor() {
    super('BASE');
  }
}