import CWC, { ethers } from '@bitpay-labs/crypto-wallet-core';
import { Observable } from 'rxjs';
import { Module } from 'src/types/modules.js';
import Util from '../../util.js';
import type * as SignerKitEth from '@ledgerhq/device-signer-kit-ethereum';

export default class EthereumModule implements Module {
  signer: SignerKitEth.SignerEth;
  derivationPath = "44'/60'/0'/0/0";
  
  constructor(signer: SignerKitEth.SignerEth) {
    this.signer = signer;
  }

  async sign(params: { tx: string }) {
    const { tx } = params;
    const bytes = ethers.getBytes(tx);
    const ob: Observable<any> = this.signer.signTransaction(
      this.derivationPath,
      bytes
    ).observable;

    const signature = await Util.getObservableOutputOrError(ob);
    const signedTx = CWC.Transactions.applySignature({
      chain: 'ETH',
      tx,
      signature
    });
    return signedTx;
  }

  async getAddress() {
    const ob: Observable<any> = this.signer.getAddress(this.derivationPath).observable;
    const { address } = await Util.getObservableOutputOrError(ob);
    return address;
  }

  async getPublicKey() {
    const ob: Observable<any> = this.signer.getAddress(this.derivationPath).observable;
    const { publicKey } = await Util.getObservableOutputOrError(ob);
    return publicKey;
  }
}
