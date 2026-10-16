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

interface Connection {
  port: number;
  chains: ChainType[];
}

interface TransportConnection {
  port: number;
  chains: TransportChainType[];
}

interface DmkConnection {
  dmk: DMK.DeviceManagementKit;
  device: DMK.ConnectedDevice | null;
  chains: DmkChainType[];
  discoverySubscription: Subscription | null;
  sessionId: DMK.DeviceSessionId | null;
}

interface Config {
  connections: Connection[];
  transport: 'node' | 'speculos';
}

const MODULE_CLASSES = {
  BTC: BitcoinModule,
  ETH: EthereumModule,
  SOL: SolanaModule,
  BCH: BitcoinCashModule,
  DOGE: DogeModule,
  LTC: LitecoinModule
};

const SIGNER_CLASSES = {
  BTC: SignerBtcBuilder,
  ETH: SignerEthBuilder,
  SOl: SignerSolanaBuilder
};

const DEFAULT_CONFIG: Config = {
  connections: [
    {
      chains: CHAINS as ChainType[],
      port: 5000
    }
  ],
  transport: 'node'
};

const SPECULOS_CONFIG: Config = {
  connections: [
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
  transport: 'speculos'
};

export default class Ledger implements Base {
  speculos: boolean;
  dmkConnections: DmkConnection[] = [];
  transportConnections: TransportConnection[] = [];

  modules = {} as Record<ChainType, BaseModule>;

  constructor(config?: Partial<Config>) {
    this.speculos = config?.transport === 'speculos';
    if (config == undefined) {
      config = this.speculos ? SPECULOS_CONFIG : DEFAULT_CONFIG;        
    } else if (config.connections == undefined) {
      config.connections = this.speculos ? SPECULOS_CONFIG.connections : DEFAULT_CONFIG.connections;
    }
    // Handle dmk and transport connections
    for (const connection of config?.connections || []) {
      const { chains, port } = connection;
      if (chains.every(Ledger.isDmkChain)) {
        let dmkBuilder = new DeviceManagementKitBuilder();
        if (this.speculos) {
          dmkBuilder = dmkBuilder.addTransport(speculosTransportFactory('http://localhost:' + port));
        } else {
          dmkBuilder = dmkBuilder.addTransport(nodeHidTransportFactory);          
        }
        
        this.dmkConnections.push({
          dmk: dmkBuilder.build(),
          device: null,
          chains,
          discoverySubscription: null,
          sessionId: null
        });
      } else if (chains.every(Ledger.isTransportChain)) {        
        this.transportConnections.push({
          port,
          chains
        });
      } else {
        throw new Error('BCH, DOGE, and LTC connections cannot share a port with BTC, ETH, or SOL');
      }
    }
  }

  async connect() {
    for (const connection of this.transportConnections) {
      const { port, chains } = connection;
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
    for (const connection of this.dmkConnections) {
      const promise = new Promise(async resolve => {
        if (connection.discoverySubscription) {
          connection.discoverySubscription.unsubscribe();
        }
        connection.discoverySubscription = connection.dmk.startDiscovering({}).subscribe({
          next: async (device) => {
            try {
              connection.sessionId = await connection.dmk.connect({ device });
              connection.device = connection.dmk.getConnectedDevice({
                sessionId: connection.sessionId
              });

              for (const chain of connection.chains) {
                let signer;
                if (chain === 'SOL') {
                  signer = new SignerSolanaBuilder({
                    dmk: connection.dmk,
                    sessionId: connection.sessionId,
                    solanaRPCURL: 'https://api.mainnet-beta.solana.com/',
                  }).build();
                } else {
                  signer = new SIGNER_CLASSES[chain]({ dmk: connection.dmk, sessionId: connection.sessionId }).build();
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
    for (const connection of this.dmkConnections) {
      if (connection.discoverySubscription) {
        connection.discoverySubscription.unsubscribe();

        if (connection.sessionId) {
          try {
            await connection.dmk.disconnect({ sessionId: connection.sessionId });
            connection.sessionId = null;
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
