import { createRequire } from 'module';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Psbt } from 'bitcoinjs-lib';
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
const {
  DefaultWallet,
  SignerBtcBuilder
} = require('@ledgerhq/device-signer-kit-bitcoin');

const { HDPublicKey, Transaction } = BitcoreLib;

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

  async sign(tx: BitcoreLib.Transaction) {
    const psbt = new Psbt();

    const pubkey = new HDPublicKey(await this.getPublicKey({ index: 0 })).derive('m/0/0').publicKey.toBuffer();
    const masterFingerprint = await this.getMasterKeyFingerprint();

    psbt.addInputs(tx.inputs.map(input => ({
      hash: input.prevTxId,
      index: input.outputIndex,
      witnessUtxo: {
        script: input.output._script.toBuffer(),
        value: input.output._satoshis
      },
      bip32Derivation: [{
        masterFingerprint: Buffer.from(masterFingerprint.buffer, masterFingerprint.byteOffset, masterFingerprint.byteLength),
        pubkey,
        path: "m/84'/0'/0'/0/0",
      }]
    })));

    psbt.addOutputs([{ address: 'bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq', value: 900 }]);

    const ob: Observable<any> = this.signer.signTransaction(
      new DefaultWallet("84'/0'/0'", 'wpkh(@0/**)'),
      psbt
    ).observable;

    const result = await lastValueFrom(ob);
    return new Transaction(result.output.slice(2));
  }

  async getMasterKeyFingerprint(): Promise<Uint8Array> {
    const ob: Observable<any> = this.signer.getMasterFingerprint().observable;
    const result = await lastValueFrom(ob);

    return result.output.masterFingerprint;
  }
}
