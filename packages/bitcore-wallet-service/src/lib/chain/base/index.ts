import { EthChain } from '../eth';

export class BaseChain extends EthChain {
  constructor() {
    super();
    this.chain = 'BASE';
  }
}
