import * as SolToken from '@solana-program/token';
import * as SolKit from '@solana/kit'
import { SOLTxProvider } from '../sol';


export class SPLTxProvider extends SOLTxProvider {

  create(params: {
    recipients: Array<{ address: string; amount: string; addressKeyPair?: SolKit.KeyPairSigner; }>;
    from: string;
    fee?: number;
    feeRate: number;
    txType?:  'legacy' | '0'; // legacy, version 0
    category?: 'transfer' | 'createAccount'; // transfer, create account
    nonce?: string; // nonce is represented as a transaction id
    nonceAddress?: string;
    blockHash?: string;
    blockHeight?: number;
    priorityFee?: number;
    computeUnits?: number;
    memo?: string;
    // account creation fields
    fromKeyPair?: SolKit.KeyPairSigner,
    space?: number; // amount of space to reserve a new account in bytes
    // SPL token transfer fields
    tokenAddress: string; // mint address
    fromAta: string;
    decimals: number;
    memo?: string;
  }) {
    const { recipients, from, fromAta, tokenAddress, decimals } = params;

    const transferInstructions = [];
    for (const recipient of recipients) {
      const { address: recipientAddress, amount: recipientAmount } = recipient;
      transferInstructions.push( SolToken.getTransferCheckedInstruction({
        source: SolKit.address(fromAta), // ATA address
        authority: SolKit.address(from),
        mint: SolKit.address(tokenAddress),
        destination: SolKit.address(recipientAddress), // ATA address
        amount: BigInt(recipientAmount),
        decimals
      }));
    }
    return super.create({ ...params, txInstructions: transferInstructions });
  }
}