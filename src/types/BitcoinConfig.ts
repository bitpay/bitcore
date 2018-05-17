import {HostPort} from './HostPort';
import {UserPassword} from './UserPassword';

export interface BitcoinConnectionConfig {
  chainSource: string;
  trustedPeers: Array<HostPort>;
  rpc: HostPort & UserPassword 
  parentChain: "BTC",
  forkHeight: number,
}
export interface BitcoinConfig {
  [network: string] : BitcoinConnectionConfig
}
