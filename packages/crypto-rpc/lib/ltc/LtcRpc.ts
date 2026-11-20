import LitecoinRPC from 'bitcoind-rpc';
import { BtcRpc, type BtcRpcConfig } from '../btc/BtcRpc';

export class LtcRpc extends BtcRpc {
  constructor(config: BtcRpcConfig) {
    super(config);
    const {
      protocol,
      host,
      port,
      user,
      pass
    } = config;
    this.rpc = new LitecoinRPC({ host, port, user, pass, protocol });
  }
}