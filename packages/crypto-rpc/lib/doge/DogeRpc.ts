import DogecoinRPC from 'dogecoind-rpc';
import { BtcRpc, type BtcRpcConfig } from '../btc/BtcRpc';

export class DogeRpc extends BtcRpc {
  constructor(config: BtcRpcConfig) {
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

  async getBlock({ hash, verbose = true }: { hash: string; verbose?: number | boolean }) {
    return this.asyncCall('getBlock', [hash, verbose]);
  }
}