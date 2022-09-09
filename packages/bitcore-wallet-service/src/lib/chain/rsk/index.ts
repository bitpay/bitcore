import { EthChain } from '../eth';

export class RskChain extends EthChain {
  constructor() {
    super();
    // Now RSK will inherit EthChain and override this.chain = 'RSK';
    this.chain = 'RSK';
  }

  // Rest of functions will be inherited from EthChain
}
