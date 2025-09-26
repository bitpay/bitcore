'use strict';

const Signature = require('../crypto/signature');
const Script = require('../script');
const BufferReader = require('../encoding/bufferreader');
const BufferWriter = require('../encoding/bufferwriter');
const Hash = require('../crypto/hash');
const ECDSA = require('../crypto/ecdsa');
const $ = require('../util/preconditions');

/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for witness programs as defined by:
 * https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 * @param {Buffer} scriptCode
 * @param {Buffer} satoshisBuffer
 * @returns {Buffer}
 */
function sighash(transaction, sighashType, inputNumber, scriptCode, satoshisBuffer) {
  let hashPrevouts = Buffer.alloc(32);
  let hashSequence = Buffer.alloc(32);
  let hashOutputs = Buffer.alloc(32);

  if (!(sighashType & Signature.SIGHASH_ANYONECANPAY)) {
    const buffers = [];
    for (let n = 0; n < transaction.inputs.length; n++) {
      const input = transaction.inputs[n];
      const prevTxIdBuffer = new BufferReader(input.prevTxId).readReverse();
      buffers.push(prevTxIdBuffer);
      const outputIndexBuffer = Buffer.alloc(4);
      outputIndexBuffer.writeUInt32LE(input.outputIndex, 0);
      buffers.push(outputIndexBuffer);
    }
    hashPrevouts = Hash.sha256sha256(Buffer.concat(buffers));
  }

  if (
    !(sighashType & Signature.SIGHASH_ANYONECANPAY) &&
    (sighashType & 0x1f) !== Signature.SIGHASH_SINGLE &&
    (sighashType & 0x1f) !== Signature.SIGHASH_NONE
  ) {
    const sequenceBuffers = [];
    for (let m = 0; m < transaction.inputs.length; m++) {
      const sequenceBuffer = Buffer.alloc(4);
      sequenceBuffer.writeUInt32LE(transaction.inputs[m].sequenceNumber, 0);
      sequenceBuffers.push(sequenceBuffer);
    }
    hashSequence = Hash.sha256sha256(Buffer.concat(sequenceBuffers));
  }

  const outputWriter = new BufferWriter();
  if (
    (sighashType & 0x1f) !== Signature.SIGHASH_SINGLE &&
    (sighashType & 0x1f) !== Signature.SIGHASH_NONE
  ) {
    for (let p = 0; p < transaction.outputs.length; p++) {
      transaction.outputs[p].toBufferWriter(outputWriter);
    }
    hashOutputs = Hash.sha256sha256(outputWriter.toBuffer());
  } else if (
    (sighashType & 0x1f) === Signature.SIGHASH_SINGLE &&
    inputNumber < transaction.outputs.length
  ) {
    transaction.outputs[inputNumber].toBufferWriter(outputWriter);
    hashOutputs = Hash.sha256sha256(outputWriter.toBuffer());
  }

  // Version
  const writer = new BufferWriter();
  writer.writeUInt32LE(transaction.version);

  // Input prevouts/nSequence (none/all, depending on flags)
  writer.write(hashPrevouts);
  writer.write(hashSequence);

  // The input being signed (replacing the scriptSig with scriptCode + amount)
  // The prevout may already be contained in hashPrevout, and the nSequence
  // may already be contain in hashSequence.
  const outpointId = new BufferReader(transaction.inputs[inputNumber].prevTxId).readReverse();
  writer.write(outpointId);
  writer.writeUInt32LE(transaction.inputs[inputNumber].outputIndex);

  writer.write(scriptCode);

  writer.write(satoshisBuffer);

  writer.writeUInt32LE(transaction.inputs[inputNumber].sequenceNumber);

  // Outputs (none/one/all, depending on flags)
  writer.write(hashOutputs);

  // Locktime
  writer.writeUInt32LE(transaction.nLockTime);

  // Sighash type
  writer.writeInt32LE(sighashType);

  return Hash.sha256sha256(writer.toBuffer());
};

/**
 * Create a signature
 *
 * @name Signing.sign
 * @param {Transaction} transaction
 * @param {PrivateKey} privateKey
 * @param {number} sighash
 * @param {number} inputIndex
 * @param {Script} subscript
 * @return {Signature}
 */
function sign(transaction, privateKey, sighashType, inputIndex, scriptCode, satoshisBuffer) {
  let hashbuf = sighash(transaction, sighashType, inputIndex, scriptCode, satoshisBuffer);
  return ECDSA.sign(hashbuf, privateKey).set({ nhashtype: sighashType });
}

/**
 * Verify a signature
 *
 * @name Signing.verify
 * @param {Transaction} transaction
 * @param {Signature} signature
 * @param {PublicKey} publicKey
 * @param {number} inputIndex
 * @param {Script} subscript
 * @param {Buffer} satoshisBuffer
 * @return {boolean}
 */
function verify(transaction, signature, publicKey, inputIndex, scriptCode, satoshisBuffer) {
  $.checkArgument(transaction != null, 'transaction cannot be nullish');
  $.checkArgument(signature != null && signature.nhashtype != null, 'signature and signature.nhashtype cannot be nullish');

  let hashbuf = sighash(transaction, signature.nhashtype, inputIndex, scriptCode, satoshisBuffer);
  return ECDSA.verify(hashbuf, signature, publicKey);
}

/**
 * @namespace Signing
 */
module.exports = {
  sighash: sighash,
  sign: sign,
  verify: verify
};
