import { EthP2pWorker  } from '../../ethereum/p2p/p2p';
import { EthBlockStorage } from '../../ethereum/models/block';
export class RskP2pWorker extends EthP2pWorker {
  /*
   * Reusing EthP2pWorker class for RSK 
   * Purpose is to avoid code duplication and reduce maintenance cost
   */
  constructor({ chain, network, chainConfig, blockModel = EthBlockStorage}) {
    super({ chain, network, chainConfig, blockModel });
    this.chain = 'RSK';
  }
}