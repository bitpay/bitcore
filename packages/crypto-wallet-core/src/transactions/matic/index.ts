import { ERC20TxProvider } from '../erc20';
import { ETHTxProvider } from '../eth';

export class MATICTxProvider extends ETHTxProvider {
  constructor() {
    super('MATIC');
  }
}

export class MATICERC20TxProvider extends ERC20TxProvider {
  constructor() {
    super('MATIC');
  }
}