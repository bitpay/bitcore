import { EthBlockStorage } from '../../ethereum/models/block';
import { EthP2pWorker } from '../../ethereum/p2p/p2p';
import { MATICStateProvider } from '../api/csp';
import { MaticMultiThreadSync } from './sync';

export class MaticP2pWorker extends EthP2pWorker {
  protected provider: MATICStateProvider;
  protected multiThreadSync: MaticMultiThreadSync;

  constructor({ chain, network, chainConfig, blockModel = EthBlockStorage }) {
    super({ chain, network, chainConfig, blockModel });
    this.provider = new MATICStateProvider();
    this.multiThreadSync = new MaticMultiThreadSync({ chain, network });

  }
  async setupListeners() {
    return;
  }

  async sync() {
    return false;
  }

}
