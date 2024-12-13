import { ERC20TxProvider } from '../erc20';
import { ETHTxProvider } from '../eth';

export class OPTxProvider extends ETHTxProvider {
  constructor(chain = 'OP') {
    super(chain);
  }
}

export class OPERC20TxProvider extends ERC20TxProvider {
  constructor(chain = 'OP') {
    super(chain);
  }
}