
'use strict';

/* jshint maxparams:5 */

var Signature = require('../crypto/signature');
var Script = require('../script');
var Output = require('./output');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var BN = require('../crypto/bn');
var Hash = require('../crypto/hash');
var ECDSA = require('../crypto/ecdsa');
var Blake2b = require('blake2b')
var $ = require('../util/preconditions');
var _ = require('lodash');

var PREVOUTS_HASH_PERSON = Buffer.from('ZcashPrevoutHash')
var SEQUENCE_HASH_PERSON = Buffer.from('ZcashSequencHash')
var OUTPUTS_HASH_PERSON = Buffer.from('ZcashOutputsHash')
var JOINSPLITS_HASH_PERSON = Buffer.from('ZcashJSplitsHash')
var SHIELDEDSPENDS_HASH_PERSON = Buffer.from('ZcashSSpendsHash')
var SHIELDEDOUTPUTS_HASH_PERSON = Buffer.from('ZcashSOutputHash')
var OVERWINTER_HASH_PERSON = Buffer.concat([Buffer.from('ZcashSigHash'), Buffer.from('76b809bb', 'hex')])
var SAPLING_HASH_PERSON = Buffer.concat([Buffer.from('ZcashSigHash'), Buffer.from('bb09b876', 'hex')])
var ZERO = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')

/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for Sapling as defined by ZIP-243.
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 * @param {Buffer} scriptCode
 * @param {Buffer} satoshisBuffer
 */
var sighash = function sighash(transaction, sighashType, inputNumber, scriptCode, satoshisBuffer) {
  /* jshint maxstatements: 50 */

  var hashPrevouts;
  var hashSequence;
  var hashOutputs;
  var hashZERO = ZERO;
  var h;

  if (!(sighashType & Signature.SIGHASH_ANYONECANPAY)) {
    var buffers = [];
    for (var n = 0; n < transaction.inputs.length; n++) {
      var input = transaction.inputs[n];
      var prevTxIdBuffer = new BufferReader(input.prevTxId).readReverse();
      buffers.push(prevTxIdBuffer);
      var outputIndexBuffer = Buffer.from(new Array(4));
      outputIndexBuffer.writeUInt32LE(input.outputIndex, 0);
      buffers.push(outputIndexBuffer);
    }
    h = Blake2b(32, null, null, PREVOUTS_HASH_PERSON);
    h.update(Buffer.concat(buffers));
    hashPrevouts = Buffer.from(h.digest());
  }

  if (!(sighashType & Signature.SIGHASH_ANYONECANPAY) &&
      (sighashType & 0x1f) !== Signature.SIGHASH_SINGLE && (sighashType & 0x1f) !== Signature.SIGHASH_NONE) {

    var sequenceBuffers = [];
    for (var m = 0; m < transaction.inputs.length; m++) {
      var sequenceBuffer = Buffer.from(new Array(4));
      sequenceBuffer.writeUInt32LE(transaction.inputs[m].sequenceNumber, 0);
      sequenceBuffers.push(sequenceBuffer);
    }
    h = Blake2b(32, null, null, SEQUENCE_HASH_PERSON);
    h.update(Buffer.concat(sequenceBuffers));
    hashSequence = Buffer.from(h.digest());
  }

  var outputWriter = new BufferWriter();
  if ((sighashType & 0x1f) !== Signature.SIGHASH_SINGLE && (sighashType & 0x1f) !== Signature.SIGHASH_NONE) {
    for (var p = 0; p < transaction.outputs.length; p++) {
      transaction.outputs[p].toBufferWriter(outputWriter);
    }
    h = Blake2b(32, null, null, OUTPUTS_HASH_PERSON);
    h.update(outputWriter.toBuffer());
    hashOutputs = Buffer.from(h.digest());
  } else if ((sighashType & 0x1f) === Signature.SIGHASH_SINGLE && inputNumber < transaction.outputs.length) {
    transaction.outputs[inputNumber].toBufferWriter(outputWriter);
    h = Blake2b(32, null, null, OUTPUTS_HASH_PERSON);
    h.update(outputWriter.toBuffer());
    hashOutputs = Buffer.from(h.digest());
  }

  // Version
  var writer = new BufferWriter();
  writer.writeUInt32LE(transaction.version + 0x80000000);

  // VersionGroupID
  writer.writeUInt32LE(transaction.nVersionGroupId);

  // Input prevouts/nSequence (none/all, depending on flags)
  writer.write(hashPrevouts);
  writer.write(hashSequence);

  // Outputs (none/one/all, depending on flags)
  writer.write(hashOutputs);

  // JoinSplits/ShieldedSpends/ShieldedOutputs
  writer.write(hashZERO);
  writer.write(hashZERO);
  writer.write(hashZERO);

  // Locktime
  writer.writeUInt32LE(transaction.nLockTime);

  // Expiry Height
  writer.writeUInt32LE(transaction.nExpiryHeight);

  // ValueBalance
  writer.writeInt32LE(0);
  writer.writeInt32LE(0);

  // Sighash type
  writer.writeInt32LE(sighashType);

  // The input being signed (replacing the scriptSig with scriptCode + amount)
  // The prevout may already be contained in hashPrevout, and the nSequence
  // may already be contain in hashSequence.
  var outpointId = new BufferReader(transaction.inputs[inputNumber].prevTxId).readReverse();
  writer.write(outpointId);
  writer.writeUInt32LE(transaction.inputs[inputNumber].outputIndex);

  writer.write(scriptCode);

  writer.write(satoshisBuffer);
  writer.writeUInt32LE(transaction.inputs[inputNumber].sequenceNumber);

  h = Blake2b(32, null, null, SAPLING_HASH_PERSON);
  h.update(writer.toBuffer());
  return Buffer.from(h.digest());
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
  var hashbuf = sighash(transaction, sighashType, inputIndex, scriptCode, satoshisBuffer);
  var sig = ECDSA.sign(hashbuf, privateKey).set({
    nhashtype: sighashType
  });
  return sig;
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
 * @return {boolean}
 */
function verify(transaction, signature, publicKey, inputIndex, scriptCode, satoshisBuffer) {
  $.checkArgument(!_.isUndefined(transaction));
  $.checkArgument(!_.isUndefined(signature) && !_.isUndefined(signature.nhashtype));
  var hashbuf = sighash(transaction, signature.nhashtype, inputIndex, scriptCode, satoshisBuffer);
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
