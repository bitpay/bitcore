import { EthChain } from '../eth';

export class ArbChain extends EthChain {
  constructor() {
    super();
    this.chain = 'ARB';
  }
}
