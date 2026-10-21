import { createRequire } from 'module';
import { Subscription } from 'rxjs';
import { ChainType, DMK_CHAINS, DmkChainType, TRANSPORT_CHAINS, TransportChainType } from '../types/chains.js';
import {
  BitcoinCashModule,
  BitcoinModule,
  DogeModule,
  EthereumModule,
  LitecoinModule,
  SolanaModule
} from './modules/index.js';
import type * as DMK from '@ledgerhq/device-management-kit';
import type * as SignerKitBtc from '@ledgerhq/device-signer-kit-bitcoin';
import type * as SignerKitEth from '@ledgerhq/device-signer-kit-ethereum';
import type * as SignerKitSolana from '@ledgerhq/device-signer-kit-solana';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  SignerBtcBuilder
}: typeof SignerKitBtc = require('@ledgerhq/device-signer-kit-bitcoin');
const {
  SignerEthBuilder
}: typeof SignerKitEth = require('@ledgerhq/device-signer-kit-ethereum');
const {
  SignerSolanaBuilder
}: typeof SignerKitSolana = require('@ledgerhq/device-signer-kit-solana');


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

export const MODULE_CLASSES: Record<string, any> = {
  BTC: BitcoinModule,
  ETH: EthereumModule,
  SOL: SolanaModule,
  BCH: BitcoinCashModule,
  DOGE: DogeModule,
  LTC: LitecoinModule
};

export const SIGNER_CLASSES: Record<string, any> = {
  BTC: SignerBtcBuilder,
  ETH: SignerEthBuilder,
  SOL: SignerSolanaBuilder
};

export const DEFAULT_CONFIG: Config = {
  devices: [
    {
      chains: DMK_CHAINS as DmkChainType[],
      port: 5000
    },
    {
      chains: TRANSPORT_CHAINS as TransportChainType[],
      port: 40000
    }
  ],
  connection: 'hid'
};

export const SPECULOS_CONFIG: Config = {
  devices: [
    {
      chains: ['BTC'],
      port: 5001
    },
    {
      chains: ['ETH'],
      port: 5002
    },
    {
      chains: ['SOL'],
      port: 5003
    },
    {
      chains: ['BCH'],
      port: 40004
    },
    {
      chains: ['DOGE'],
      port: 40005
    },
    {
      chains: ['LTC'],
      port: 40006
    }
  ],
  connection: 'speculos'
};
