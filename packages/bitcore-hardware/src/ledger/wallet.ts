import { createRequire } from 'module';
import { Subscription } from 'rxjs';
import { Base, BaseModule } from 'src/types/base.js';
import { EveryUtxoType, TransactionType } from 'src/types/txTypes.js';
import { dmk } from './dmk.js';
import { BitcoinModule, EthereumModule, SolanaModule } from './modules/index.js';
import type * as DMK from '@ledgerhq/device-management-kit';
import type * as SignerKitBtc from '@ledgerhq/device-signer-kit-bitcoin';
import type * as SignerKitEth from '@ledgerhq/device-signer-kit-ethereum';
import type * as SignerKitSolana from '@ledgerhq/device-signer-kit-solana';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  CloseAppCommand,
  GetOsVersionCommand,
  isSuccessCommandResult
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


export default class Ledger implements Base {
  device: DMK.ConnectedDevice | null = null;
  sessionId: DMK.DeviceSessionId | null = null;
  discoverySubscryption: Subscription | null = null;
  modules: Record<string, BaseModule> = {};

  async connect() {
    return new Promise(async (resolve) => {
      console.log('Discovering Ledger device...');
      if (this.discoverySubscryption) {
        this.discoverySubscryption.unsubscribe();
      }

      this.discoverySubscryption = dmk.startDiscovering({}).subscribe({
        next: async (device) => {
          console.log(`Found ${device.id}, model: ${device.deviceModel.model}`);
          try {
            this.sessionId = await dmk.connect({ device });
            this.discoverySubscryption?.unsubscribe();

            this.device = dmk.getConnectedDevice({
              sessionId: this.sessionId
            });

            this.modules.BTC = new BitcoinModule(new SignerBtcBuilder({ dmk, sessionId: this.sessionId }).build());
            this.modules.ETH = new EthereumModule(new SignerEthBuilder({ dmk, sessionId: this.sessionId }).build());
            this.modules.SOL = new SolanaModule(new SignerSolanaBuilder({
              dmk,
              sessionId: this.sessionId,
              solanaRPCURL: 'https://api.mainnet-beta.solana.com/',
            }).build());
            
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
  }

  async disconnect() {
    if (this.discoverySubscryption) {
      this.discoverySubscryption.unsubscribe();
    }

    if (this.sessionId) {
      try {
        await dmk.disconnect({ sessionId: this.sessionId });
        this.sessionId = null;
        console.log(`Disconnected ${this.device?.name}`);
      } catch (error) {
        console.error(error);
      }
    }
  }

  async getVersion() {
    const sessionId = this.sessionId;
    if (!sessionId) {
      throw new Error('Not connected to a Ledger device');
    }
    await dmk.sendCommand({ sessionId, command: new CloseAppCommand() });
    const result = await dmk.sendCommand({ sessionId, command: new GetOsVersionCommand() });
    if (!isSuccessCommandResult(result)) {
      throw result.error;
    }
    return result.data.seVersion;
  }

  async sign(params: {
    chain: 'BTC';
    tx: string;
    utxos: EveryUtxoType[];
  })
  async sign(params: {
    chain: 'BTC';
    tx: object;
    utxos?: EveryUtxoType[];
  })
  async sign(params: {
    chain: 'ETH' | 'SOL';
    tx: string;
  })
  async sign(params: {
    chain: string;
    tx: TransactionType;
    utxos?: EveryUtxoType[];
  }) {
    const { chain, tx, utxos } = params;
    return this.modules[chain].sign({
      tx,
      utxos
    });
  }
  
  async getAddress(params: { chain: string }) {
    return this.modules[params.chain].getAddress();
  }

  async getPublicKey(params: { chain: string }) {
    return this.modules[params.chain].getPublicKey();
  }

  static isValidChain(value: string): value is 'BTC' | 'ETH' | 'SOL' {
    return ['BTC', 'ETH', 'SOL'].includes(value);
  }
}
