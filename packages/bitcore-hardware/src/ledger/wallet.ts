import { createRequire } from 'module';
import { EveryUtxoType, TransactionType } from 'src/types/txTypes.js';
import { Base, BaseModule } from '../base.js';
import { dmk } from './dmk.js';
import { BitcoinModule, EthereumModule } from './modules/index.js';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  CloseAppCommand,
  GetOsVersionCommand
} = require('@ledgerhq/device-management-kit');
const {
  SignerBtcBuilder
} = require('@ledgerhq/device-signer-kit-bitcoin');
const {
  SignerEthBuilder
} = require('@ledgerhq/device-signer-kit-ethereum');


export default class Ledger implements Base {
  device: any;
  sessionId: any;
  discoverySubscryption: any;
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
            this.discoverySubscryption.unsubscribe();

            this.device = dmk.getConnectedDevice({
              sessionId: this.sessionId
            });

            this.modules.BTC = new BitcoinModule(new SignerBtcBuilder({ dmk, sessionId: this.sessionId }).build());
            this.modules.ETH = new EthereumModule(new SignerEthBuilder({ dmk, sessionId: this.sessionId }).build());
            
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
        console.log(`Disconnected ${this.device.name}`);
      } catch (error) {
        console.error(error);
      }
    }
  }

  async getVersion() {
    await dmk.sendCommand({ sessionId: this.sessionId, command: new CloseAppCommand() });
    const { seVersion } = (await dmk.sendCommand({ sessionId: this.sessionId, command: new GetOsVersionCommand() })).data;
    return seVersion;
  }

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
  
  async getAddress(params: any) {
    return this.modules[params.chain].getAddress(params);
  }

  async getPublicKey(params: any) {
    return this.modules[params.chain].getPublicKey(params);
  }
}
