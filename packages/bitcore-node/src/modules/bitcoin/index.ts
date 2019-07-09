import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { BitcoinP2PWorker } from './p2p';

export default class BitcoinModule {
  constructor(services: { P2P: typeof P2P; Libs: typeof Libs }) {
    services.Libs.register('BTC', 'bitcore-lib', 'bitcore-p2p');
    services.P2P.register('BTC', BitcoinP2PWorker);
  }
}
