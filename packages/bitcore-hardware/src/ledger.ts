import { createRequire } from 'module';
import BIP32Factory from 'bip32';
import { Psbt, payments } from 'bitcoinjs-lib';
import {
  Observable,
  lastValueFrom
} from 'rxjs';
import * as ecc from 'tiny-secp256k1';
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

const bip32 = BIP32Factory(ecc);

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
    const psbt = new Psbt();

    // Derive the specific child key for external chain (0), address index (0)
    const childNode = bip32.fromBase58(await this.getPublicKey({ index: 0 })).derive(0).derive(0);
    const pubkey = Buffer.from(childNode.publicKey);

    // Compute the P2WPKH scriptPubKey from the derived child key
    const p2wpkh = payments.p2wpkh({ pubkey: pubkey });
    const script = p2wpkh.output!;

    const masterFingerprint = await this.getMasterKeyFingerprint();
    psbt.addInput({
      hash: '78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4',
      index: 0,
      witnessUtxo: {
        script,
        value: 1000,
      },
      bip32Derivation: [{
        masterFingerprint: Buffer.from(masterFingerprint.buffer, masterFingerprint.byteOffset, masterFingerprint.byteLength),
        pubkey,
        path: "m/84'/0'/0'/0/0",
      }],
    });
    psbt.addOutput({ address: 'bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq', value: 1000 });

    const ob: Observable<any> = this.signer.signTransaction(
      new DefaultWallet("84'/0'/0'", 'wpkh(@0/**)'),
      psbt
    ).observable;

    const result = await lastValueFrom(ob);
    return result.output;
  }

  async getMasterKeyFingerprint(): Promise<Uint8Array> {
    const ob: Observable<any> = this.signer.getMasterFingerprint().observable;
    const result = await lastValueFrom(ob);

    return result.output.masterFingerprint;
  }
}
