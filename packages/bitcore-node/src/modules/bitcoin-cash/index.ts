import { Libs } from '../../providers/libs';
import { P2P } from '../../services/p2p';
import { BitcoinP2PWorker } from '../bitcoin/p2p';

export default class BCHModule {
  constructor(services: { P2P: typeof P2P; Libs: typeof Libs }) {
    services.Libs.register('BCH', 'bitcore-lib-cash', 'bitcore-p2p-cash');
    services.P2P.register('BCH', BitcoinP2PWorker);
  }
}
