import { execHaloCmdPCSC } from '@arx-research/libhalo/api/desktop';
import Bitcore from '@bitpay-labs/bitcore-lib';
import { NFC } from 'nfc-pcsc';
import { Base } from './base.js';
import { BaseMethod, Sign } from './types/methods.js';

const { Address, PublicKey } = Bitcore;

/**
 * Connect listens on the NFC reader for a card.
 * Methods queue a command to run when the card is scanned.
 */
export default class Burner implements Base {
  nfc = new NFC();
  command = {};
  currency: string;
  response: object | string | number | undefined;

  constructor(currency: string) {
    this.currency = currency;
  }

  async awaitResponse() {
    return new Promise(async (resolve1) => {
      while (this.response === undefined) {
        await new Promise(resolve2 => setTimeout(resolve2, 10));
      }
      resolve1(this.response);
    });
  }

  connect() {
    this.nfc.on('reader', (reader) => {
      reader.autoProcessing = false;

      reader.on('card', async () => {
        try {
          this.response = await execHaloCmdPCSC(this.command, reader);
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

  async sign(params: Sign) {
    const { index, message } = params;
    this.response = undefined;
    this.command = {
      name: 'sign',
      message,
      keyNo: index
    };
    return this.awaitResponse();
  }

  async getPublicKey(params: BaseMethod) {
    const { index } = params;
    this.response = undefined;
    this.command = {
      name: 'get_data_struct_v2',
      spec: [{ type: 'publicKey', index }]
    };

    return (await this.awaitResponse() as any).publicKey[index].value;
  }

  async getAddress(params: BaseMethod) {
    const { index } = params;
    this.response = undefined;
    this.command = {
      name: 'get_data_struct_v2',
      spec: [{ type: 'compressedPublicKey', index }]
    };

    try {
      const pubKey = PublicKey.fromString((await this.awaitResponse() as any).compressedPublicKey[index].value);
      const address = Address.fromPublicKey(pubKey, 'livenet', 'witnesspubkeyhash');
      return address.toString();
    } catch {
      return undefined;
    }
  }
}
