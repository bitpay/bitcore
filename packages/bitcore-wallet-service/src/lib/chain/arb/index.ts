import { EthChain } from '../eth';

export class ArbChain extends EthChain {
  chain: string;

  constructor() {
    super();
    this.chain = 'ARB';
  }
}
