import { createRequire } from 'module';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Psbt } from 'bitcoinjs-lib';
import {
  Observable,
  lastValueFrom
} from 'rxjs';
import { BaseModule } from 'src/types/base.js';
import { EveryUtxoType, TransactionType } from 'src/types/txTypes.js';
import Util from '../../util.js';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  DefaultWallet
} = require('@ledgerhq/device-signer-kit-bitcoin');

const { HDPublicKey } = BitcoreLib;

export default class BitcoinModule implements BaseModule {
  signer: any;
  derivationPath = "84'/0'/0'";
  
  constructor(signer: any) {
    this.signer = signer;
  }

  async sign(params: { tx: string; utxos: EveryUtxoType[] })
  async sign(params: { tx: TransactionType; utxos?: EveryUtxoType[] }) {
    const { tx, utxos } = params;
    const bitcoreTx = Util.buildTransaction(tx, utxos);
    
    const psbt = new Psbt();

    const pubkey = new HDPublicKey(await this.getPublicKey()).derive('m/0/0').publicKey.toBuffer();
    const masterFingerprint = await this.getMasterKeyFingerprint();

    psbt.addInputs(bitcoreTx.inputs.map(input => ({
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
      new DefaultWallet(this.derivationPath, 'wpkh(@0/**)'),
      psbt
    ).observable;

    const result = await lastValueFrom(ob);
    return result.output.slice(2);
  }
  
  async getAddress() {
    const ob: Observable<any> = this.signer.getWalletAddress({ derivationPath: this.derivationPath, template: 'wpkh(@0/**)' }, 0).observable;
    const result = await lastValueFrom(ob);
    return result.output.address;
  }

  async getPublicKey() {
    const ob: Observable<any> = this.signer.getExtendedPublicKey(this.derivationPath, 0).observable;
    const result = await lastValueFrom(ob);
    return result.output.extendedPublicKey;
  }

  async getMasterKeyFingerprint(): Promise<Uint8Array> {
    const ob: Observable<any> = this.signer.getMasterFingerprint().observable;
    const result = await lastValueFrom(ob);
    return result.output.masterFingerprint;
  }
}
