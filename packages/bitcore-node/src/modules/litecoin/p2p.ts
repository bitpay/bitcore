import { BitcoinBlockStorage } from '../../models/block';
import { BitcoinP2PWorker } from '../bitcoin/p2p';

export class LitecoinP2PWorker extends BitcoinP2PWorker {

  constructor({ chain, network, chainConfig, blockModel = BitcoinBlockStorage }) {
    super({ chain, network, chainConfig, blockModel });

    if (this.network === 'regtest') {
      this.bitcoreLib.Networks.enableRegtest();
    }

    this.messages = new this.bitcoreP2p.Messages({
      // As of Litcoin Core v0.18.1, min protocolVersion is 70002
      // As of bitcore v8.x, max protocolVersion is 70011 before seeing connection errors
      protocolVersion: 70011,
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
