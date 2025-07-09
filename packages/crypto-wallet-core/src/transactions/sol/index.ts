import * as SolComputeBudget from '@solana-program/compute-budget';
import * as SolComputeMemo from '@solana-program/memo';
import * as SolSystem from '@solana-program/system';
import * as SolToken from '@solana-program/token';
import * as SolKit from '@solana/kit'
import { Key } from '../../derivation';


export class SOLTxProvider {

  MAX_TRANSFERS = 12;
  MINIMUM_PRIORITY_FEE = 1000;

  create(params: {
    recipients: Array<{ address: string; amount: string; addressKeyPair?: SolKit.KeyPairSigner; }>;
    from: string;
    fee?: number;
    feeRate: number;
    txType?: 'legacy' | '0'; // legacy, version 0
    category?: 'transfer' | 'createAccount'; // transfer, create account
    nonce?: string; // nonce is represented as a transaction id
    nonceAddress?: string;
    blockHash?: string;
    blockHeight?: number;
    priorityFee?: number;
    computeUnits?: number;
    memo?: string;
    txInstructions?: Array<SolKit.BaseTransactionMessage['instructions'][number]>;
    // account creation fields
    fromKeyPair?: any;
    space?: number; // amount of space to reserve a new account in bytes
    mint?: string; // mint address for createATA
    ataAddress?: any; // ATA address for createATA
  }) {
    const { recipients, from, nonce, nonceAddress, category, space, blockHash, blockHeight, priorityFee, txInstructions, computeUnits, fromKeyPair, memo } = params;
    const fromAddress = SolKit.address(from);
    let txType: SolKit.TransactionVersion = ['0', 0].includes(params?.txType) ? 0 : 'legacy';
    let lifetimeConstrainedTx;
    switch (category?.toLowerCase()) {
      case 'transfer':
      default:
        if (recipients.length > this.MAX_TRANSFERS) {
          throw new Error('Too many recipients')
        }
        let transactionMessage = SolKit.pipe(
          SolKit.createTransactionMessage({ version: txType }),
          tx => SolKit.setTransactionMessageFeePayer(fromAddress, tx),
        );

        if (nonce) {
          const nonceAccountAddress = SolKit.address(nonceAddress);
          const nonceAuthorityAddress = fromAddress;
          lifetimeConstrainedTx = SolKit.setTransactionMessageLifetimeUsingDurableNonce({
            nonce: nonce as SolKit.Nonce,
            nonceAccountAddress,
            nonceAuthorityAddress
          }, transactionMessage);
        } else {
          const recentBlockhash = {
            blockhash: blockHash as SolKit.Blockhash,
            lastValidBlockHeight: BigInt(blockHeight)
          }
          lifetimeConstrainedTx = SolKit.setTransactionMessageLifetimeUsingBlockhash(
            recentBlockhash,
            transactionMessage,
          );
        }
        const transferInstructions = txInstructions || [];
        if (!transferInstructions.length) {
          for (const recipient of recipients) {
            const { address: recipientAddress, amount: recipientAmount } = recipient;
            transferInstructions.push(SolSystem.getTransferSolInstruction({
              amount: BigInt(recipientAmount),
              destination: SolKit.address(recipientAddress),
              source: {
                address: fromAddress,
                signTransactions: async () => []
              } as SolKit.TransactionPartialSigner
            }));
          }
        }
        if (priorityFee) {
          const maxPriorityFee = Math.max(this.MINIMUM_PRIORITY_FEE, priorityFee);
          transferInstructions.push(SolComputeBudget.getSetComputeUnitPriceInstruction({ microLamports: maxPriorityFee }));
        }
        if (computeUnits) {
          transferInstructions.push(SolComputeBudget.getSetComputeUnitLimitInstruction({ units: computeUnits }));
        }
        if (memo) {
          const memoInstruction = SolComputeMemo.getAddMemoInstruction({
            memo
          });
          transferInstructions.push(memoInstruction);
        }
        const transferTxMessage = SolKit.appendTransactionMessageInstructions(transferInstructions, lifetimeConstrainedTx);
        const compiledTx = SolKit.compileTransaction(transferTxMessage);
        return SolKit.getBase64EncodedWireTransaction(compiledTx);
      case 'createaccount':
        const { amount, addressKeyPair } = recipients[0];
        const _space = space || 200;
        const _amount = Number(amount);

        if (!addressKeyPair) {
          throw new Error('New address keypair is required to create an account.')
        }
        const recentBlockhash = {
          blockhash: blockHash as SolKit.Blockhash,
          lastValidBlockHeight: BigInt(blockHeight)
        }
        const createAccountInstructions = []
        createAccountInstructions.push(SolSystem.getCreateAccountInstruction({
          payer: fromKeyPair,
          newAccount: addressKeyPair,
          lamports: _amount,
          space: _space,
          programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
        }));
        const txMessage = SolKit.pipe(
          SolKit.createTransactionMessage({ version: txType }),
          (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeyPair, tx),
        )
        lifetimeConstrainedTx = SolKit.setTransactionMessageLifetimeUsingBlockhash(
          recentBlockhash,
          txMessage,
        );
        if (priorityFee) {
          const maxPriorityFee = Math.max(this.MINIMUM_PRIORITY_FEE, priorityFee);
          createAccountInstructions.push(SolComputeBudget.getSetComputeUnitPriceInstruction({ microLamports: maxPriorityFee }));
        }
        if (computeUnits) {
          createAccountInstructions.push(SolComputeBudget.getSetComputeUnitLimitInstruction({ units: computeUnits }));
        }
        const completeMessage = SolKit.appendTransactionMessageInstructions(
          createAccountInstructions,
          lifetimeConstrainedTx
        );
        const compiled = SolKit.compileTransaction(completeMessage);
        return SolKit.getBase64EncodedWireTransaction(compiled);
      case 'createata':
        const { mint, ataAddress } = params;
        const createAssociatedTokenIdempotentInstruction = SolToken.getCreateAssociatedTokenIdempotentInstruction({
          payer: fromKeyPair,
          owner: fromAddress,
          mint: SolKit.address(mint),
          ata: ataAddress
        });
        const ataTxMessage = SolKit.pipe(
          SolKit.createTransactionMessage({ version: 0 }),
          (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeyPair, tx),
          (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockHash as SolKit.Blockhash, lastValidBlockHeight: BigInt(blockHeight) }, tx),
          (tx) => SolKit.appendTransactionMessageInstructions(
              [createAssociatedTokenIdempotentInstruction],
              tx
          )
        );
        const compiledAtaTx = SolKit.compileTransaction(ataTxMessage);
        return SolKit.getBase64EncodedWireTransaction(compiledAtaTx);
      }
  }

  decodeRawTransaction({ rawTx, decodeTransactionMessage = true }) {
    if (typeof rawTx !== 'string') {
      throw new Error(`Raw transaction expected to be a string. Found ${typeof rawTx} instead.`);
    }
    const uint8ArrayTx = SolKit.getBase64Encoder().encode(rawTx);
    const decodedTx: any = SolKit.getTransactionDecoder().decode(uint8ArrayTx);

    // decoding and decompiling the transaction message allows extraction of key data such as lifetimeConstraint
    // certain advance transactions such as dex swaps, lookup table txs, may need additional data to perform decompilation and will throw errors if not provided
    if (decodeTransactionMessage) {
      const decompiledTransactionMessage = this.decodeTransactionMessage(decodedTx?.messageBytes);
      decodedTx.lifetimeConstraint = decompiledTransactionMessage.lifetimeConstraint;
    }
    return decodedTx;
  }

  decodeTransactionMessage(bytes) {
    // TODO support lookup tables
    const compiledTransactionMessage = SolKit.getCompiledTransactionMessageDecoder().decode(bytes);
    return SolKit.decompileTransactionMessage(compiledTransactionMessage);
  }

  async sign(params: { tx: string; key: Key; }): Promise<string> {
    const { tx, key } = params;
    const decodedTx = this.decodeRawTransaction({ rawTx: tx, decodeTransactionMessage: false });
    const privKeyBytes = SolKit.getBase58Encoder().encode(key.privKey);
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(privKeyBytes);
    const signedTransaciton = await SolKit.signTransaction([keypair], decodedTx);
    return SolKit.getBase64EncodedWireTransaction(signedTransaciton);
  }

  async signPartially(params) {
    const { tx, key } = params;
    const decodedTx = this.decodeRawTransaction({ rawTx: tx, decodeTransactionMessage: false });
    const privKeyBytes = SolKit.getBase58Encoder().encode(key.privKey);
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(privKeyBytes);
    const signedTransaciton = await SolKit.partiallySignTransaction([keypair], decodedTx);
    return SolKit.getBase64EncodedWireTransaction(signedTransaciton);
  }

  async signMessage(params) {
    const { key, messageBytes } = params;
    const privKeyBytes = SolKit.getBase58Encoder().encode(key.privKey);
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(privKeyBytes);
    const signedBytes = await SolKit.signBytes(keypair.privateKey, messageBytes);
    return SolKit.getBase58Decoder().decode(signedBytes);
  }

  async getSignature(params: { tx: string; keys: Array<Key> }) {
    const { tx, keys } = params;
    const key = keys[0];
    const signedTx = await this.sign({ tx, key });
    const decodedTx = this.decodeRawTransaction({ rawTx: signedTx, decodeTransactionMessage: false });
    const sigEncoding = decodedTx.signatures[key.address];
    return SolKit.getBase58Decoder().decode(sigEncoding);
  }

  applySignature(params: { tx: string; signature: string }): string {
    const { tx, signature } = params;
    const signatures = [SolKit.getBase58Encoder().encode(signature)];
    const transaction = SolKit.getBase64Encoder().encode(tx);
    const transformWithNewSignatures = (_tx) => {
      const { messageBytes } = _tx;
      const signerAddressesDecoder = SolKit.getTupleDecoder([
        // read transaction version
        SolKit.getTransactionVersionDecoder(),
        // read first byte of header, `numSignerAccounts`
        // padRight to skip the next 2 bytes, `numReadOnlySignedAccounts` and `numReadOnlyUnsignedAccounts` which we don't need
        SolKit.padRightDecoder(SolKit.getU8Decoder(), 2),
        // read static addresses
        SolKit.getArrayDecoder(SolKit.getAddressDecoder(), { size: SolKit.getShortU16Decoder() })
      ]);
      const [, numRequiredSignatures, staticAddresses] = signerAddressesDecoder.decode(messageBytes);
      const signerAddresses = staticAddresses.slice(0, numRequiredSignatures);
      if (signerAddresses.length !== signatures.length) {
        throw new Error(`The transaction message expected the transaction to have ${signerAddresses.length} signatures, got ${signatures.length}.`);
      }
      const signaturesMap = {};
      for (let index = 0; index < signerAddresses.length; index++) {
        const address = signerAddresses[index];
        const signatureForAddress = signatures[index];

        if (signatureForAddress.every((b) => b === 0)) {
          signaturesMap[address] = null;
        } else {
          signaturesMap[address] = signatureForAddress;
        }
      }
      return {
        messageBytes,
        signatures: Object.freeze(signaturesMap)
      };
    };
    const decoderTransform = SolKit.transformDecoder(
      SolKit.getStructDecoder([
        ['signatures', SolKit.getArrayDecoder(SolKit.fixDecoderSize(SolKit.getBytesDecoder(), 64), { size: SolKit.getShortU16Decoder() })],
        ['messageBytes', SolKit.getBytesDecoder()]
      ]),
      transformWithNewSignatures
    );
    const signedTx = decoderTransform.decode(transaction);
    return SolKit.getBase64EncodedWireTransaction(signedTx);
  }

  getHash(params: { tx: string; }): string {
    const { tx } = params;
    const decodedTx = this.decodeRawTransaction({ rawTx: tx, decodeTransactionMessage: false });
    const pubKeys = Object.keys(decodedTx.signatures);
    let signature;

    if (pubKeys.length == 1) {
      signature = decodedTx.signatures[pubKeys[0]];
    } else if (pubKeys.length > 1) {
      try {
        const compiledTransactionMessage = SolKit.getCompiledTransactionMessageDecoder().decode(decodedTx.messageBytes);
        const feePayerAddress = compiledTransactionMessage.staticAccounts[0];
        signature = decodedTx.signatures[feePayerAddress];
      } catch (err) {
        throw new Error('unable to get fee payer signature %o', err.stack || err.message || err);
      }
    }
    if (!signature) {
      throw new Error('tx is unsigned by fee payer');
    }

    return SolKit.getBase58Decoder().decode(signature);
  }
}