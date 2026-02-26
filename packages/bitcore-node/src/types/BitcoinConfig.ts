import { HostPort } from './HostPort';
import { UserPassword } from './UserPassword';

export interface ConnectionConfig {
  chainSource: string;
  trustedPeers: Array<HostPort>;
  rpc: HostPort & UserPassword;
  parentChain: 'BTC';
  forkHeight: number;
}
export interface NetworkConfig {
  [network: string]: ConnectionConfig;
}
