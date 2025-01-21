import { OPERC20TxProvider, OPTxProvider } from '../op';

export class BASETxProvider extends OPTxProvider {
  constructor() {
    super('BASE');
  }
}

export class BASEERC20TxProvider extends OPERC20TxProvider {
  constructor() {
    super('BASE');
  }
}