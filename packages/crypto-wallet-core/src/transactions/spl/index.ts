import * as SolKit from '@solana/kit';
import * as SolToken from '@solana-program/token';
import { SOLTxProvider } from '../sol';

export class SPLTxProvider extends SOLTxProvider {

  create(params: CreateParams) {
    // Reuse exposed TransactionProxy API (Create)
    // @ts-expect-error - so public api is minimally changed
    if (params.category === 'recoverNestedAssociatedToken') {
      return SPLTxProvider.createRecoverNestedAssociatedTokenTransaction(params as unknown as CreateRecoverNestedAssociatedTokenParams);
    }
    // @ts-expect-error - so public api is minimally changed
    if (params.category === 'closeTokenAccount') {
      return SPLTxProvider.createCloseTokenAccountTransaction(params as unknown as CreateCloseTokenAccountParams);
    }

    const { recipients, from, fromAta, tokenAddress, decimals, instructions = [] } = params;
    // Start with custom instructions
    const allInstructions = [...instructions];
    if (recipients.length > 0 && !instructions?.length) {
      // Add SPL token transfer instructions for each recipient
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
    }

    return super.create({ ...params, txInstructions: allInstructions });
  }

  static createAtokenInstructions(instructionType: InstructionType, params: any) {
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

  static createRecoverNestedAssociatedTokenTransaction(params: CreateRecoverNestedAssociatedTokenParams) {
    const {
      fromKeyPair,
      blockHash,
      blockHeight,
      nestedAssociatedAccountAddress,
      nestedTokenMintAddress,
      destinationAssociatedAccountAddress,
      ownerAssociatedAccountAddress,
      ownerTokenMintAddress
    } = params;
    // Validate
    if (!SolKit.isKeyPairSigner(fromKeyPair)) {
      throw new Error('fromKeyPair required to implement KeyPairSigner');
    }
    if (!(blockHash && blockHeight)) {
      throw new Error('blockHash and blockHeight required');
    }

    const instruction = SolToken.getRecoverNestedAssociatedTokenInstruction({
      nestedAssociatedAccountAddress: SolKit.address(nestedAssociatedAccountAddress),
      nestedTokenMintAddress: SolKit.address(nestedTokenMintAddress),
      destinationAssociatedAccountAddress: SolKit.address(destinationAssociatedAccountAddress),
      ownerAssociatedAccountAddress: SolKit.address(ownerAssociatedAccountAddress),
      ownerTokenMintAddress: SolKit.address(ownerTokenMintAddress),
      walletAddress: params.fromKeyPair
    });

    const recentBlockhash = {
      blockhash: blockHash as SolKit.Blockhash,
      lastValidBlockHeight: BigInt(blockHeight)
    };

    // Create transaction
    const transactionMessage = SolKit.pipe(
      SolKit.createTransactionMessage({ version: 'legacy' }),
      (tx) => SolKit.setTransactionMessageFeePayer(fromKeyPair.address, tx),
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions(
        [instruction], tx
      )
    );

    const compiledTx = SolKit.compileTransaction(transactionMessage);
    return SolKit.getBase64EncodedWireTransaction(compiledTx);
  }

  static createCloseTokenAccountTransaction(params: CreateCloseTokenAccountParams) {
    const {
      fromKeyPair,
      blockHash,
      blockHeight,
      ataAddressToClose,
      solRentReturnAddress,
      ataAddressToCloseOwnerSolAddress
    } = params;
    // Validate
    if (!SolKit.isKeyPairSigner(fromKeyPair)) {
      throw new Error('fromKeyPair required to implement KeyPairSigner');
    }
    if (!(blockHash && blockHeight)) {
      throw new Error('blockHash and blockHeight required');
    }

    const instruction = SolToken.getCloseAccountInstruction({
      account: SolKit.address(ataAddressToClose),
      destination: SolKit.address(solRentReturnAddress),
      owner: SolKit.address(ataAddressToCloseOwnerSolAddress)
    });

    const recentBlockhash = {
      blockhash: blockHash as SolKit.Blockhash,
      lastValidBlockHeight: BigInt(blockHeight)
    };

    // Create transaction
    const transactionMessage = SolKit.pipe(
      SolKit.createTransactionMessage({ version: 'legacy' }),
      (tx) => SolKit.setTransactionMessageFeePayer(fromKeyPair.address, tx),
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions(
        [instruction], tx
      )
    );

    const compiledTx = SolKit.compileTransaction(transactionMessage);
    return SolKit.getBase64EncodedWireTransaction(compiledTx);
  }
}

interface CreateParams {
  recipients: Array<{ address: string; amount: string; addressKeyPair?: SolKit.KeyPairSigner; }>;
  from: string;
  fee?: number;
  feeRate: number;
  txType?: 'legacy' | '0'; // legacy, version 0
  category?: 'transfer' | 'createAccount';
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
  fromAta?: string;
  decimals?: number;
}

interface CreateRecoverNestedAssociatedTokenParams {
  category: 'recoverNestedAssociatedToken';
  blockHash: string;
  blockHeight: number;
  fromKeyPair: SolKit.KeyPairSigner;
  nestedAssociatedAccountAddress: string;
  nestedTokenMintAddress: string;
  destinationAssociatedAccountAddress: string;
  ownerAssociatedAccountAddress: string;
  ownerTokenMintAddress: string;
}

interface CreateCloseTokenAccountParams {
  category: 'closeTokenAccount';
  blockHash: string;
  blockHeight: number;
  fromKeyPair: SolKit.KeyPairSigner;
  ataAddressToClose: string;
  solRentReturnAddress: string;
  ataAddressToCloseOwnerSolAddress: string;
}

type InstructionType = 'createAssociatedToken' | 'createAssociatedTokenIdempotent' | 'recoverNestedAssociatedToken';
