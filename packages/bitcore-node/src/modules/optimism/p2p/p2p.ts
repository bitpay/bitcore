import { EVMP2pWorker } from '../../../providers/chain-state/evm/p2p/p2p';
import { ExternalEvmP2PWorker } from '../../../services/externalP2P';
import { IEVMNetworkConfig } from '../../../types/Config';

export function getOpP2pWorker(config: IEVMNetworkConfig) {
  if (config.chainSource === 'p2p') {
    return OpP2pWorker;
  } else {
    return ExternalOpP2pWorker;
  }
}

export class OpP2pWorker extends EVMP2pWorker {};
export class ExternalOpP2pWorker extends ExternalEvmP2PWorker {};
