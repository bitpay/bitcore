import { IChain } from '..';
import { EthChain } from '../eth';


export class SolChain extends EthChain implements IChain {
  chain: string;

  constructor() {
    super();
    this.chain = 'SOL';
  }
}
