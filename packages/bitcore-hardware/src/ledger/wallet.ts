import { createRequire } from 'module';
import { nodeHidTransportFactory } from '@ledgerhq/device-transport-kit-node-hid';
import { Subscription } from 'rxjs';
import { Base, BaseModule } from '../types/base.js';
import {
  CHAINS,
  ChainType,
  DMK_CHAINS,
  DmkChainType,
  TRANSPORT_CHAINS,
  TransportChainType,
  UtxoChainType
} from '../types/chains.js';
import { EveryUtxoType, TransactionType } from '../types/txTypes.js';
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
import type * as HwTransportNode from '@ledgerhq/hw-transport-node-hid';
import type * as HwTransportNodeSpeculos from '@ledgerhq/hw-transport-node-speculos';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  DeviceManagementKitBuilder
}: typeof DMK = require('@ledgerhq/device-management-kit');
const {
  SignerBtcBuilder
}: typeof SignerKitBtc = require('@ledgerhq/device-signer-kit-bitcoin');
const {
  SignerEthBuilder
}: typeof SignerKitEth = require('@ledgerhq/device-signer-kit-ethereum');
const {
  SignerSolanaBuilder
}: typeof SignerKitSolana = require('@ledgerhq/device-signer-kit-solana');
const { speculosTransportFactory } = require('@ledgerhq/device-transport-kit-speculos');
const TransportNodeHid: typeof HwTransportNode.default.default = require('@ledgerhq/hw-transport-node-hid').default;
const TransportNodeSpeculos: typeof HwTransportNodeSpeculos.default.default = require('@ledgerhq/hw-transport-node-speculos').default;

// One hardware wallet is both a transport device and a dmk device
interface TransportDevice {
  port: number;
  chains: TransportChainType[];
}

interface DmkDevice {
  dmk: DMK.DeviceManagementKit;
  connectedDevice: DMK.ConnectedDevice | null;
  chains: DmkChainType[];
  discoverySubscription: Subscription | null;
  sessionId: DMK.DeviceSessionId | null;
}

interface DeviceConfig {
  port: number;
  chains: ChainType[];
}

interface Config {
  devices: DeviceConfig[];
  connection: 'hid' | 'speculos';
}

const MODULE_CLASSES: Record<string, any> = {
  BTC: BitcoinModule,
  ETH: EthereumModule,
  SOL: SolanaModule,
  BCH: BitcoinCashModule,
  DOGE: DogeModule,
  LTC: LitecoinModule
};

const SIGNER_CLASSES: Record<string, any> = {
  BTC: SignerBtcBuilder,
  ETH: SignerEthBuilder,
  SOL: SignerSolanaBuilder
};

const DEFAULT_CONFIG: Config = {
  devices: [
    {
      chains: CHAINS as ChainType[],
      port: 5000
    }
  ],
  connection: 'hid'
};

const SPECULOS_CONFIG: Config = {
  devices: [
    {
      chains: ['BTC'],
      port: 5000
    },
    {
      chains: ['ETH'],
      port: 5001
    },
    {
      chains: ['SOL'],
      port: 5002
    },
    {
      chains: ['BCH'],
      port: 40003
    },
    {
      chains: ['DOGE'],
      port: 40004
    },
    {
      chains: ['LTC'],
      port: 40005
    }
  ],
  connection: 'speculos'
};

export default class Ledger implements Base {
  speculos: boolean;
  dmkDevices: DmkDevice[] = [];
  transportDevices: TransportDevice[] = [];

  modules = {} as Record<ChainType, BaseModule>;

  constructor(config?: Partial<Config>) {
    this.speculos = config?.connection === 'speculos';
    if (config == undefined) {
      config = this.speculos ? SPECULOS_CONFIG : DEFAULT_CONFIG;        
    } else if (config.devices == undefined) {
      config.devices = this.speculos ? SPECULOS_CONFIG.devices : DEFAULT_CONFIG.devices;
    }
    // Handle dmk and transport devices
    for (const deviceConfig of config?.devices || []) {
      const { chains, port } = deviceConfig;
      if (chains.every(Ledger.isDmkChain)) {
        let dmkBuilder = new DeviceManagementKitBuilder();
        if (this.speculos) {
          dmkBuilder = dmkBuilder.addTransport(speculosTransportFactory('http://localhost:' + port));
        } else {
          dmkBuilder = dmkBuilder.addTransport(nodeHidTransportFactory);          
        }
        
        this.dmkDevices.push({
          dmk: dmkBuilder.build(),
          connectedDevice: null,
          chains,
          discoverySubscription: null,
          sessionId: null
        });
      } else if (chains.every(Ledger.isTransportChain)) {        
        this.transportDevices.push({
          port,
          chains
        });
      } else {
        throw new Error('BCH, DOGE, and LTC cannot share a port with BTC, ETH, or SOL');
      }
    }
  }

  async connect() {
    for (const transportDevice of this.transportDevices) {
      const { port, chains } = transportDevice;
      let transport;
      if (this.speculos) {
        transport = await TransportNodeSpeculos.open({ apduPort: port });
      } else {
        transport = await TransportNodeHid.open(null);
      }
      for (const chain of chains) {
        this.modules[chain] = new MODULE_CLASSES[chain](transport);
      }
    }

    const promises: Promise<any>[] = [];
    for (const dmkDevice of this.dmkDevices) {
      const promise = new Promise(async resolve => {
        if (dmkDevice.discoverySubscription) {
          dmkDevice.discoverySubscription.unsubscribe();
        }
        dmkDevice.discoverySubscription = dmkDevice.dmk.startDiscovering({}).subscribe({
          next: async (device) => {
            try {
              dmkDevice.sessionId = await dmkDevice.dmk.connect({ device });
              dmkDevice.connectedDevice = dmkDevice.dmk.getConnectedDevice({
                sessionId: dmkDevice.sessionId
              });

              for (const chain of dmkDevice.chains) {
                let signer;
                if (chain === 'SOL') {
                  signer = new SignerSolanaBuilder({
                    dmk: dmkDevice.dmk,
                    sessionId: dmkDevice.sessionId,
                    solanaRPCURL: 'https://api.mainnet-beta.solana.com/',
                  }).build();
                } else {
                  signer = new SIGNER_CLASSES[chain]({ dmk: dmkDevice.dmk, sessionId: dmkDevice.sessionId }).build();
                }
                this.modules[chain] = new MODULE_CLASSES[chain](signer);
              }
              resolve(0);
            } catch (error) {
              console.error(error);
              resolve(1);
            }
          },
          error: (error) => {
            console.error(error);
            resolve(1);
          }
        });
      });
      promises.push(promise);
    }
    
    return Promise.all(promises);
  }

  async disconnect() {
    for (const dmkDevice of this.dmkDevices) {
      if (dmkDevice.discoverySubscription) {
        dmkDevice.discoverySubscription.unsubscribe();

        if (dmkDevice.sessionId) {
          try {
            await dmkDevice.dmk.disconnect({ sessionId: dmkDevice.sessionId });
            dmkDevice.sessionId = null;
          } catch (error) {
            console.error(error);
          }
        }
      }
    }
  }

  async sign(params: {
    chain: 'BTC';
    tx: string;
    utxos: EveryUtxoType[];
  }): Promise<string>
  async sign(params: {
    chain: 'BTC';
    tx: object;
    utxos?: EveryUtxoType[];
  }): Promise<string>
  async sign(params: {
    chain: Exclude<UtxoChainType, 'BTC'>;
    tx: string;
    utxos: EveryUtxoType[];
    prevTxs: string[];
  }): Promise<string>
  async sign(params: {
    chain: Exclude<UtxoChainType, 'BTC'>;
    tx: object;
    utxos?: EveryUtxoType[];
    prevTxs: string[];
  }): Promise<string>
  async sign(params: {
    chain: 'ETH' | 'SOL';
    tx: string;
  }): Promise<string>
  async sign(params: {
    chain: string;
    tx: TransactionType;
    utxos?: EveryUtxoType[];
    prevTxs?: string[];
  }): Promise<string> {
    const { chain, tx, utxos, prevTxs } = params;
    return this.modules[chain].sign({
      tx,
      utxos,
      prevTxs
    });
  }
  
  async getAddress(params: { chain: string }): Promise<string> {
    return this.modules[params.chain].getAddress();
  }

  async getPublicKey(params: { chain: string }): Promise<string> {
    return this.modules[params.chain].getPublicKey();
  }

  static isValidChain(value: string): value is ChainType {
    return CHAINS.includes(value);
  }

  static isDmkChain(value: string): value is DmkChainType {
    return DMK_CHAINS.includes(value);
  }

  static isTransportChain(value: string): value is TransportChainType {
    return TRANSPORT_CHAINS.includes(value);
  }
}
