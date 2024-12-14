import * as Web3 from '@solana/web3.js'
import { Key } from '../../derivation';

const bs58 = require('bs58');

export class SOLTxProvider {
  create(params: {
    recipients: Array<{ address: string; amount: string; }>;
    from: string;
    fee?: number;
    feeRate: number;
    network: string;
    txType?: string; // legacy, version 0, etc
    category?: string; // transfer, create account, create nonce account
    nonce?: string; // nonce is represented as a transaction id
    nonceAddress?: string;
    blockHash?: string;
    blockHeight?: number;
    space?: number; // amount of space to reserve a new account in bytes
  }) {
    const { recipients, from, nonce, nonceAddress, category, network, space, blockHash, blockHeight, txType } = params;
    const { address, amount } = recipients[0];
    const toPubkey = new Web3.PublicKey(address);
    const fromPubkey = new Web3.PublicKey(from);

    switch (category?.toLowerCase()) {
      case 'transfer':
      default:
        let transferTx;

        if (txType == 'legacy') {
          transferTx = this._createLegacyTransfer({ fromPubkey, nonce, nonceAddress, blockHash, blockHeight, toPubkey, amount });
        } else {
          transferTx = this._createVersionedTransfer({ fromPubkey, nonce, blockHash, toPubkey, amount });
        }

        return this.toBuffer(transferTx.serialize()).toString('base64');
      case 'createAcccount':
        const _space = space || 200;
        const _amount = Number(amount);
        const createAccountParams = {
          fromPubkey,
          newAccountPubkey: new Web3.PublicKey(address),
          lamports: _amount,
          space: _space,
          programId: Web3.SystemProgram.programId,
        };
        const createAccountTx = new Web3.Transaction().add(
          Web3.SystemProgram.createAccount(createAccountParams),
        );

        return this.toBuffer(createAccountTx.serialize()).toString('base64');
      case 'createNonceAccount':
        const noncePubkey = new Web3.PublicKey(nonceAddress);
        const nonceAccountTx = new Web3.Transaction({
          feePayer: fromPubkey,
          blockhash: blockHash,
          lastValidBlockHeight: blockHeight
        }).add(
          Web3.SystemProgram.createAccount({
            fromPubkey,
            newAccountPubkey: noncePubkey,
            lamports: Number(amount),
            space: space || Web3.NONCE_ACCOUNT_LENGTH,
            programId: Web3.SystemProgram.programId,
          }),
          Web3.SystemProgram.nonceInitialize({
            noncePubkey,
            authorizedPubkey: fromPubkey,
          }));

        return this.toBuffer(nonceAccountTx.serialize()).toString('base64');
    }
  }

  _createVersionedTransfer(params: { fromPubkey, nonce, blockHash, toPubkey, amount }) {
    const { fromPubkey, nonce, blockHash, toPubkey, amount } = params;
    let recentBlockhash = blockHash;
    if (nonce) {
      recentBlockhash = nonce;
    }
    const instructions = [
      Web3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: BigInt(amount)
      })
    ];
    const message = new Web3.TransactionMessage({
      payerKey: fromPubkey,
      recentBlockhash,
      instructions
    }).compileToV0Message();
    return new Web3.VersionedTransaction(message);
  }

  _createLegacyTransfer(params: { fromPubkey, nonce, nonceAddress, blockHash, blockHeight, toPubkey, amount }) {
    const { fromPubkey, nonce, nonceAddress, blockHash, blockHeight, toPubkey, amount } = params;
    let initParams: any = {
      blockhash: blockHash,
      feePayer: fromPubkey,
      lastValidBlockHeight: blockHeight + 1000 // buffer
    };
    if (nonceAddress) {
      const nonceAccount = new Web3.PublicKey(nonceAddress);
      initParams = {
        blockhash: nonce, // TODO make endpoint to get nonce from an account
        feePayer: fromPubkey,
        minContextSlot: blockHeight,
        nonceInfo: {
          nonce,
          nonceInstruction: Web3.SystemProgram.nonceAdvance({
            noncePubkey: nonceAccount,
            authorizedPubkey: fromPubkey
          })
        }
      };
    }
    return new Web3.Transaction(initParams).add(Web3.SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: BigInt(amount)
    }));
  }

  getSignatureObject(params: { tx: string; key: Key; hash?: string; }) {
    const { tx, key, hash } = params;    
    const privateKey =  this.base64ToUint8Array(key?.privKey)
    const keypair = Web3.Keypair.fromSecretKey(privateKey);
    const decodedTx = (this.decodeRawTransaction({ rawTx: tx }) as unknown) as Web3.VersionedTransaction;
    if (hash) { // update to recent hash
      decodedTx.message.recentBlockhash = hash;
    }
    decodedTx.sign([keypair]);
    const signedTransaction = this.toBuffer(decodedTx.serialize()).toString('base64');
    const _hash = bs58.encode(decodedTx.signatures[0]);
    return { signedTransaction, hash: _hash };
  }

  getSignature(params: { tx: string; key: Key; hash?: string; }): string {
    const { signedTransaction } = this.getSignatureObject(params);
    return signedTransaction;
  }

  getHash(params: { tx: string; network?: string }): string {
    const { tx } = params;
    const decodedTx = (this.decodeRawTransaction({ rawTx: tx }) as unknown) as Web3.VersionedTransaction;
    return bs58.encode(decodedTx?.signatures[0]);
  }

  applySignature(params: { tx: string; signature: string, signer: string }): string {
    const { tx, signature, signer } = params;
    const decodedTx = (this.decodeRawTransaction({ rawTx: tx }) as unknown) as Web3.VersionedTransaction;
    let _signature = this.base64ToUint8Array(signature)
    decodedTx.addSignature(new Web3.PublicKey(signer), _signature);
    return this.toBuffer(decodedTx.serialize()).toString('base64');
  }

  sign(params: { tx: string; key: Key; hash: string; }): string {
    const { tx, key, hash } = params;
    const signedTx = this.getSignature({ tx, key, hash });
    return signedTx;
  }

  decodeRawTransaction({ rawTx }) {
    if (rawTx && typeof rawTx === 'string') {
      rawTx = this.base64ToUint8Array(rawTx);
    }
    if (!(rawTx instanceof Uint8Array)) {
      return null;
    }
    return Web3.VersionedTransaction.deserialize(rawTx);
  }

  base64ToUint8Array(str) {
    // Decode the base64 string to a Buffer
    const buffer = Buffer.from(str, 'base64');
    // Convert the Buffer to a Uint8Array
    const uint8Array = new Uint8Array(buffer);
    return uint8Array;
  }

  toBuffer(arr) {
    if (Buffer.isBuffer(arr)) {
      return arr;
    } else if (arr instanceof Uint8Array) {
      return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    } else {
      return Buffer.from(arr);
    }
  }
}