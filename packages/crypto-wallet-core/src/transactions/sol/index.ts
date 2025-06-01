import * as SolComputeBudget from '@solana-program/compute-budget';
import * as SolSystem from '@solana-program/system';
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
    txType?:  'legacy' | '0'; // legacy, version 0
    category?: 'transfer' | 'createAccount'; // transfer, create account
    nonce?: string; // nonce is represented as a transaction id
    nonceAddress?: string;
    blockHash?: string;
    blockHeight?: number;
    priorityFee?: number;
    computeUnits?: number;
    txInstructions?: Array<SolKit.BaseTransactionMessage['instructions'][number]>;
    // account creation fields
    fromKeyPair?: SolKit.KeyPairSigner;
    space?: number; // amount of space to reserve a new account in bytes
  }) {
    const { recipients, from, nonce, nonceAddress, category, space, blockHash, blockHeight, priorityFee, txInstructions, computeUnits } = params;
    const fromAddress = SolKit.address(from);
    let txType: SolKit.TransactionVersion = ['0', 0].includes(params?.txType) ? 0 : 'legacy';

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
        let lifetimeConstrainedTx;

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
        const transferTxMessage = SolKit.appendTransactionMessageInstructions(transferInstructions, lifetimeConstrainedTx);
        const compiledTx = SolKit.compileTransaction(transferTxMessage);
        return SolKit.getBase64EncodedWireTransaction(compiledTx);
      case 'createAccount':
        const { fromKeyPair } = params;
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
    }
  }

  decodeRawTransaction({ rawTx }) {
    if (typeof rawTx !== 'string') {
      throw new Error(`Raw transaction expected to be a string. Found ${typeof rawTx} instead.`)
    }
    const uint8ArrayTx = SolKit.getBase64Encoder().encode(rawTx);
    const txObj = SolKit.getTransactionDecoder().decode(uint8ArrayTx);
    const compiledTransactionMessage = SolKit.getCompiledTransactionMessageDecoder().decode(txObj?.messageBytes);
    const decompiledTransactionMessage = SolKit.decompileTransactionMessage(compiledTransactionMessage);
    const compiledTransaction = SolKit.compileTransaction(decompiledTransactionMessage)
    return { ...compiledTransaction, signatures: txObj.signatures };
  }

  async sign(params: { tx: string; key: Key; }): Promise<string> {
    const { tx, key } = params;
    const decodedTx = this.decodeRawTransaction({ rawTx: tx });
    const privKeyBytes = SolKit.getBase58Encoder().encode(key.privKey);
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(privKeyBytes);
    const signedTransaciton = await SolKit.signTransaction([keypair], decodedTx);
    return SolKit.getBase64EncodedWireTransaction(signedTransaciton);
  }

  async getSignature(params: { tx: string; keys: Array<Key> }) {
    const { tx, keys } = params;
    const signedTx = await this.sign({ tx, key: keys[0] });
    const decodedTx = this.decodeRawTransaction({ rawTx: signedTx });
    const sigEncoding = this.getSignaturesEncoder().encode(decodedTx.signatures)
    return SolKit.getBase64Decoder().decode(sigEncoding);
  }

  applySignature(params: { tx: string; signature: string }): string {
    const { tx, signature } = params;
    const encoder = SolKit.getBase64Encoder();
    const signatures = [encoder.encode(signature)];
    const transaction = encoder.encode(tx);
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
    const decodedTx = this.decodeRawTransaction({ rawTx: tx });
    const sigEncoding = this.getSignaturesEncoder().encode(decodedTx.signatures)
    return SolKit.getBase58Decoder().decode(sigEncoding);
  }

  getSignaturesToEncode(signaturesMap) {
    const signatures = Object.values(signaturesMap);
    return signatures.map((signature) => {
      if (!signature) {
        return new Uint8Array(64).fill(0);
      }
      return signature;
    });
  }

  getSignaturesEncoder() {
    return SolKit.transformEncoder(
      SolKit.getArrayEncoder(SolKit.fixEncoderSize(SolKit.getBytesEncoder(), 64), { size: SolKit.getShortU16Encoder() }),
      this.getSignaturesToEncode
    );
  }
}