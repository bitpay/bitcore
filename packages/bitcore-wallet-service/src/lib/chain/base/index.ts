import { EthChain } from '../eth';

export class BaseChain extends EthChain {
  chain: string;

  constructor() {
    super();
    this.chain = 'BASE';
  }
}
