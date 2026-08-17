import CWC, { ethers } from '@bitpay-labs/crypto-wallet-core';
import {
  Observable,
  lastValueFrom
} from 'rxjs';
import { BaseModule } from 'src/base.js';

export default class EthereumModule implements BaseModule {
  signer: any;
  derivationPath = "44'/60'/0'/0/0";
  
  constructor(signer: any) {
    this.signer = signer;
  }

  async sign(params: { tx: string }) {
    const { tx } = params;
    const bytes = ethers.getBytes(tx);
    const ob: Observable<any> = this.signer.signTransaction(
      this.derivationPath,
      bytes
    ).observable;

    const result = await lastValueFrom(ob);
    const signature = result.output;
    const signedTx = CWC.Transactions.applySignature({
      chain: 'ETH',
      tx,
      signature
    });
    return signedTx;
  }

  async getAddress() {
    const ob: Observable<any> = this.signer.getAddress(this.derivationPath).observable;
    const result = await lastValueFrom(ob);
    console.log(result);
    return result.output.address;
  }

  async getPublicKey() {
    const ob: Observable<any> = this.signer.getAddress(this.derivationPath).observable;
    const result = await lastValueFrom(ob);
    return result.output.publicKey;
  }
}
