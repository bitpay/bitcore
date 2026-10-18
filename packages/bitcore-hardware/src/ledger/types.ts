import { Subscription } from 'rxjs';
import { ChainType, DmkChainType, TransportChainType } from '../types/chains.js';
import type * as DMK from '@ledgerhq/device-management-kit';

// One hardware wallet is both a transport device and a dmk device
export interface TransportDevice {
  port: number;
  chains: TransportChainType[];
}

export interface DmkDevice {
  dmk: DMK.DeviceManagementKit;
  connectedDevice: DMK.ConnectedDevice | null;
  chains: DmkChainType[];
  discoverySubscription: Subscription | null;
  sessionId: DMK.DeviceSessionId | null;
}

export interface DeviceConfig {
  port: number;
  chains: ChainType[];
}

export interface Config {
  devices: DeviceConfig[];
  connection: 'hid' | 'speculos';
}
