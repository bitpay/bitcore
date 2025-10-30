import { EthChain } from '../eth';

export class MaticChain extends EthChain {
  constructor() {
    super();
    this.chain = 'MATIC';
  }
}
