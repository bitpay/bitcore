import { BitcoinBlockStorage } from '../../models/block';
import { BitcoinP2PWorker } from '../bitcoin/p2p';

export class LitecoinP2PWorker extends BitcoinP2PWorker {
  constructor({ chain, network, chainConfig, blockModel = BitcoinBlockStorage }) {
    super({ chain, network, chainConfig, blockModel });
  }
}
