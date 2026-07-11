import { createRequire } from 'module';
import { dmk } from './dmk.js';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const { GetOsVersionCommand } = require('@ledgerhq/device-management-kit');

export default class Ledger {
  device: any;
  sessionId: any;
  discoverySubscryption: any;

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
    console.log(this.sessionId);
    const { seVersion } = (await dmk.sendCommand({ sessionId: this.sessionId, command: new GetOsVersionCommand() })).data;
    return seVersion;
  }
}
