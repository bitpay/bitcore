import DogecoinRPC from 'dogecoind-rpc';
import { BtcRpc } from '../btc/BtcRpc.js';

export class DogeRpc extends BtcRpc {
  constructor(config) {
    super(config);
    const {
      rpcPort: port,
      rpcUser: user,
      rpcPass: pass,
      host,
      protocol
    } = config;
    this.rpc = new DogecoinRPC({ host, port, user, pass, protocol });
  }

  async getBlock({ hash, verbose = true }) {
    return this.asyncCall('getBlock', [hash, verbose]);
  }
}