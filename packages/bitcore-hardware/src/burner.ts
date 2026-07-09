import { execHaloCmdPCSC } from '@arx-research/libhalo/api/desktop';
import { NFC } from 'nfc-pcsc';
import { Base } from './base.js';

export default class Burner implements Base {
  nfc = new NFC();
  command = {};
  currency: string;
  responce: object | string | number | undefined;

  constructor(currency: string) {
    this.currency = currency;
  }

  connect() {
    this.nfc.on('reader', (reader) => {
      reader.autoProcessing = false;

      reader.on('card', async () => {
        try {
          this.responce = await execHaloCmdPCSC(this.command, reader);
        } catch (e) {
          console.error(e);
        }
      });

      reader.on('error', (err) => {
        console.log(`${reader.reader.name} an error occurred`, err);
      });
    });

    this.nfc.on('error', (err) => {
      console.log('An error occurred', err);
    });
  }

  async sign(params: { amount: number }) {
    const { amount } = params;
    this.command = {
      name: 'sign',
      message: '010203',
      keyNo: 1
    };
    amount;
    return new Promise(async (resolve) => {
      while (this.responce === undefined) {
        await new Promise(resolve2 => setTimeout(resolve2, 10));
      }
      resolve(this.responce);
      this.responce = undefined;
    });
  }
}
