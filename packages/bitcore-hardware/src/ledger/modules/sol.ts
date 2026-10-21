import { SolKit } from '@bitpay-labs/crypto-wallet-core';
import { Observable } from 'rxjs';
import { Module } from 'src/types/modules.js';
import Util from '../../util.js';
import type * as SignerKitSolana from '@ledgerhq/device-signer-kit-solana';


export default class SolanaModule implements Module {
  signer: SignerKitSolana.SignerSolana;
  derivationPath = "44'/501'/0'";
  constructor(signer: SignerKitSolana.SignerSolana) {
    this.signer = signer;
  }

  async sign(params: { tx: string }) {
    const { tx } = params;
    const wireBytes = SolKit.getBase64Encoder().encode(tx);
    const transaction = SolKit.getTransactionDecoder().decode(wireBytes);
    
    const ob: Observable<any> = this.signer.signTransaction(
      this.derivationPath,
      Uint8Array.from(transaction.messageBytes)
    ).observable;

    const signature = await Util.getObservableOutputOrError(ob);

    return SolKit.getBase64EncodedWireTransaction({
      ...transaction,
      signatures: {
        ...transaction.signatures,
        [await this.getAddress()]: signature
      }
    });
  }
  
  async getAddress() {
    const ob: Observable<any> = this.signer.getAddress(this.derivationPath).observable;
    const address = await Util.getObservableOutputOrError(ob);
    return address;
  }

  async getPublicKey() {
    return this.getAddress();
  }
}
