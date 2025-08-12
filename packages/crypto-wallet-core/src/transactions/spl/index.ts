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
    instructions?: Array<SolKit.BaseTransactionMessage['instructions'][number]>;
    // SPL token transfer fields (required for token transfers)
    tokenAddress: string; // mint address
    fromAta: string;
    decimals: number;
  }) {
    const { recipients, from, fromAta, tokenAddress, decimals, instructions = [] } = params;

    const allInstructions = [...instructions];

    // Add token transfer instructions for each recipient
    for (const recipient of recipients) {
      const { address: recipientAddress, amount: recipientAmount } = recipient;
      allInstructions.push(SolToken.getTransferCheckedInstruction({
        source: SolKit.address(fromAta), // ATA address
        authority: SolKit.address(from),
        mint: SolKit.address(tokenAddress),
        destination: SolKit.address(recipientAddress), // ATA address
        amount: BigInt(recipientAmount),
        decimals
      }));
    }

    return super.create({ ...params, instructions: allInstructions });
  }

    static createAtokenInstructions(instructionType: 'createAssociatedToken' | 'createAssociatedTokenIdempotent' | 'recoverNestedAssociatedToken', params: any) {
    try {
      switch (instructionType) {
        case 'createAssociatedToken':
          return SolToken.getCreateAssociatedTokenInstruction(params);
        case 'createAssociatedTokenIdempotent':
          return SolToken.getCreateAssociatedTokenIdempotentInstruction(params);
        case 'recoverNestedAssociatedToken':
          return SolToken.getRecoverNestedAssociatedTokenInstruction(params);
        default:
          throw new Error(`Unsupported AToken instruction type: ${instructionType}`);
      }
    } catch (error) {
      throw new Error(`Failed to create AToken instruction: ${error.message}`);
    }
  }
}