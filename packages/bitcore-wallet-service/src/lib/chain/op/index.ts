import { EthChain } from '../eth';

export class OpChain extends EthChain {
  constructor() {
    super();
    this.chain = 'OP';
  }
}
