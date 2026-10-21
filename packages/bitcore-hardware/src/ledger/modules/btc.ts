import { createRequire } from 'module';
import CWC from '@bitpay-labs/crypto-wallet-core';
import { Psbt } from 'bitcoinjs-lib';
import { Observable } from 'rxjs';
import { UtxoChainType } from 'src/types/chains.js';
import { Module } from 'src/types/modules.js';
import { TransactionType } from 'src/types/tx.js';
import Util from '../../util.js';
import type { EveryUtxoType } from '@bitpay-labs/crypto-wallet-core/ts_build/src/transactions/btc/index.js';
import type * as SignerKitBtc from '@ledgerhq/device-signer-kit-bitcoin';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  DefaultDescriptorTemplate,
  DefaultWallet
}: typeof SignerKitBtc = require('@ledgerhq/device-signer-kit-bitcoin');

const { BitcoreLib } = CWC;

export default class BitcoinModule implements Module {
  signer: SignerKitBtc.SignerBtc;
  derivationPath = "84'/0'/0'";
  // BitcoinModule is extended by other utxo chains
  chain: UtxoChainType = 'BTC';
  
  constructor(signer: SignerKitBtc.SignerBtc) {
    this.signer = signer;
  }

  async sign(params: { tx: string; utxos: EveryUtxoType[] })
  async sign(params: { tx: TransactionType; utxos?: EveryUtxoType[] }) {
    const { tx, utxos } = params;
    const bitcoreTx = Util.buildTransaction(tx, utxos, this.chain);
    
    const psbt = new Psbt();

    const pubkey = new Util.libs[this.chain].PublicKey(await this.getPublicKey()).toBuffer();
    const masterFingerprint = await this.getMasterKeyFingerprint();

    psbt.addInputs(bitcoreTx.inputs.map(input => ({
      hash: input.prevTxId.toString('hex'),
      index: input.outputIndex,
      witnessUtxo: {
        script: input.output._script.toBuffer(),
        value: input.output._satoshis
      },
      bip32Derivation: [{
        masterFingerprint: Buffer.from(masterFingerprint.buffer, masterFingerprint.byteOffset, masterFingerprint.byteLength),
        pubkey,
        path: 'm/' + this.derivationPath + '/0/0',
      }]
    })));
    psbt.addOutputs(bitcoreTx.outputs.map(utxo => ({ script: utxo.script.toBuffer(), value: utxo.satoshis })));

    const ob: Observable<any> = this.signer.signTransaction(
      new DefaultWallet(this.derivationPath, DefaultDescriptorTemplate.NATIVE_SEGWIT),
      psbt
    ).observable;
    const signedTx = await Util.getObservableOutputOrError(ob);
    return signedTx.slice(2); // remove 0x prefix
  }
  
  async getAddress() {
    const ob: Observable<any> = this.signer.getWalletAddress({ derivationPath: this.derivationPath, template: DefaultDescriptorTemplate.NATIVE_SEGWIT }, 0).observable;
    const { address } = await Util.getObservableOutputOrError(ob);
    return address;
  }

  async getPublicKey() {
    const ob: Observable<any> = this.signer.getExtendedPublicKey(this.derivationPath).observable;
    const { extendedPublicKey } = await Util.getObservableOutputOrError(ob);
    return BitcoreLib.HDPublicKey(extendedPublicKey).derive('m/0/0').publicKey.toString();
  }

  async getMasterKeyFingerprint(): Promise<Uint8Array> {
    const ob: Observable<any> = this.signer.getMasterFingerprint().observable;
    const { masterFingerprint } = await Util.getObservableOutputOrError(ob);
    return masterFingerprint;
  }
}
