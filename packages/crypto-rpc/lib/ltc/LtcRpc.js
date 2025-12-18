import LitecoinRPC from 'bitcoind-rpc';
import { BtcRpc } from '../btc/BtcRpc.js';

export class LtcRpc extends BtcRpc {
  constructor(config) {
    super(config);
    const {
      rpcPort: port,
      rpcUser: user,
      rpcPass: pass,
      host,
      protocol
    } = config;
    this.rpc = new LitecoinRPC({ host, port, user, pass, protocol });
  }
}