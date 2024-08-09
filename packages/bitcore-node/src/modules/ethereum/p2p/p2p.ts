import { EVMP2pWorker } from '../../../providers/chain-state/evm/p2p/p2p';
import { AnyBlock } from '../../../providers/chain-state/evm/types';
import { ExternalEvmP2PWorker } from '../../../services/externalP2P';
import { IEVMNetworkConfig } from '../../../types/Config';


export function getEthP2pWorker(config: IEVMNetworkConfig) {
  if (config.chainSource === 'p2p') {
    return EthP2pWorker;
  } else {
    return ExternalEthP2pWorker;
  }
};

export class EthP2pWorker extends EVMP2pWorker {
  getBlockReward(block: AnyBlock): number {
    let reward = 5;
    const height = block.number;
    const ForkHeights = {
      Byzantium: 4370000,
      Constantinople: 7280000
    };

    if (height > ForkHeights.Constantinople) {
      reward = 2;
    } else if (height > ForkHeights.Byzantium) {
      reward = 3;
    }
    return reward;
  }
};

export class ExternalEthP2pWorker extends ExternalEvmP2PWorker {};
