import DogecoinRPC from 'dogecoind-rpc';
import { BtcRpc } from '../btc/BtcRpc.js';

export class DogeRpc extends BtcRpc {
  constructor(config) {
    super(config);
    const { protocol, host } = config;
    // bitpay passes both the P2P port and the RPC port; the RPC settings win when present
    const port = config.rpcPort || config.port;
    const user = config.rpcUser || config.user;
    const pass = config.rpcPass || config.pass;
    this.rpc = new DogecoinRPC({ host, port, user, pass, protocol });
  }

  async getBlock({ hash, verbose = true }) {
    return this.asyncCall('getBlock', [hash, verbose]);
  }
}