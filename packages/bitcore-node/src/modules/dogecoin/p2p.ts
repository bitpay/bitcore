import { BitcoinBlockStorage } from '../../models/block';
import { LitecoinP2PWorker } from '../litecoin/p2p';

export class DogecoinP2PWorker extends LitecoinP2PWorker {

  constructor({ chain, network, chainConfig, blockModel = BitcoinBlockStorage }) {
    super({ chain, network, chainConfig, blockModel });

    if (this.network === 'regtest') {
      this.bitcoreLib.Networks.enableRegtest();
    }

    this.messages = new this.bitcoreP2p.Messages({
      protocolVersion: 70003,
      network: this.bitcoreLib.Networks.get(this.network),
      Block: this.bitcoreLib.Block,
      Transaction: this.bitcoreLib.Transaction,
      BlockHeader: this.bitcoreLib.BlockHeader
    });

    this.pool = new this.bitcoreP2p.Pool({
      addrs: this.chainConfig.trustedPeers.map(peer => {
        return {
          ip: {
            v4: peer.host
          },
          port: peer.port
        };
      }),
      dnsSeed: false,
      listenAddr: false,
      network: this.network,
      messages: this.messages
    });
  }
}
