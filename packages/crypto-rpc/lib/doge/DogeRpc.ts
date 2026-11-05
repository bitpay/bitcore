import DogecoinRPC from 'dogecoind-rpc';
import { BtcRpc } from '../btc/BtcRpc.js';

export class DogeRpc extends BtcRpc {
  constructor(config) {
    super(config);
    const {
      protocol,
      host,
      port,
      user,
      pass
    } = config;
    this.rpc = new DogecoinRPC({ host, port, user, pass, protocol });
  }

  async getBlock({ hash, verbose = true }) {
    return this.asyncCall('getBlock', [hash, verbose]);
  }
}