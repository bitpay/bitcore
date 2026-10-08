import { SolKit } from '@bitpay-labs/crypto-wallet-core';
import {
  Observable,
  lastValueFrom
} from 'rxjs';
import { BaseModule } from 'src/types/base.js';
import type * as SignerKitSolana from '@ledgerhq/device-signer-kit-solana';


export default class SolanaModule implements BaseModule {
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

    const result = await lastValueFrom(ob);
    const signature = result.output;

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
    const result = await lastValueFrom(ob);
    return result.output;
  }

  async getPublicKey() {
    return this.getAddress();
  }
}
