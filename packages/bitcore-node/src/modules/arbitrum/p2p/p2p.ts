import { EVMP2pWorker } from '../../../providers/chain-state/evm/p2p/p2p';
import { ExternalEvmP2PWorker } from '../../../services/externalP2P';
import { IEVMNetworkConfig } from '../../../types/Config';

export function getArbP2pWorker(config: IEVMNetworkConfig) {
  if (config.chainSource === 'p2p') {
    return ArbP2pWorker;
  } else {
    return ExternalArbP2pWorker;
  }
}

export class ArbP2pWorker extends EVMP2pWorker {};
export class ExternalArbP2pWorker extends ExternalEvmP2PWorker {};
