import { EthChain } from '../eth';

export class OpChain extends EthChain {
  chain: string;

  constructor() {
    super();
    this.chain = 'OP';
  }
}
