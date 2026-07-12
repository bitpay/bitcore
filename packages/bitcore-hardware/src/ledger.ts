import { createRequire } from 'module';
import {
  Observable,
  lastValueFrom
} from 'rxjs';
import { Base } from './base.js';
import { dmk } from './dmk.js';
import { BaseParams } from './types/paramTypes.js';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  CloseAppCommand,
  GetOsVersionCommand
} = require('@ledgerhq/device-management-kit');
const { SignerBtcBuilder } = require('@ledgerhq/device-signer-kit-bitcoin');

export default class Ledger implements Base {
  device: any;
  sessionId: any;
  discoverySubscryption: any;
  signer: any;

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

            this.signer = new SignerBtcBuilder({ dmk, sessionId: this.sessionId }).build();
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

  async getAddress(params: BaseParams) {
    const { index } = params;
    const ob: Observable<any> = this.signer.getWalletAddress({ derivationPath: "84'/0'/0'", template: 'wpkh(@0/**)' }, index).observable;
    const result = await lastValueFrom(ob);
    return result.output.address;
  }

  async getPublicKey(params: BaseParams) {
    const { index } = params;
    const ob: Observable<any> = this.signer.getExtendedPublicKey("84'/0'/0'", index).observable;
    const result = await lastValueFrom(ob);
    return result.output.extendedPublicKey;
  }

  async sign() {
    return 'not implemented';
  }
}
