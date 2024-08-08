import { EVMP2pWorker } from '../../../providers/chain-state/evm/p2p/p2p';
import { ExternalEvmP2PWorker } from '../../../services/externalP2P';
import { IEVMNetworkConfig } from '../../../types/Config';

export function getBaseP2pWorker(config: IEVMNetworkConfig) {
  if (config.chainSource === 'p2p') {
    return BaseP2pWorker;
  } else {
    return ExternalBaseP2pWorker;
  }
}

export class BaseP2pWorker extends EVMP2pWorker {};
export class ExternalBaseP2pWorker extends ExternalEvmP2PWorker {};
