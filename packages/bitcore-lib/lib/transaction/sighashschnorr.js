'use strict';

/* jshint maxparams:5 */

const Signature = require('../crypto/signature');
const Script = require('../script');
const BufferWriter = require('../encoding/bufferwriter');
const Hash = require('../crypto/hash');
const Schnorr = require('../crypto/schnorr');
const $ = require('../util/preconditions');
const _ = require('lodash');
const TaggedHash = require('../crypto/taggedhash');

/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for witness v1 programs as defined by:
 * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {Number} sighashType the type of the hash
 * @param {Number} inputNumber the input index for the signature
 * @param {Number} sigversion Taproot or Tapscript version number
 * @param {Object} execdata Object with directives and data for creating the signature hash
 */
function _signatureHash(transaction, sighashType, inputNumber, sigversion, execdata) {
  let extFlag, keyVersion;

  switch (sigversion) {
    case Signature.Version.TAPROOT:
      extFlag = 0;
      // keyVersion is not used and left uninitialized.
      break;
    case Signature.Version.TAPSCRIPT:
      extFlag = 1;
      // keyVersion must be 0 for now, representing the current version of
      // 32-byte public keys in the tapscript signature opcode execution.
      // An upgradable public key version (with a size not 32-byte) may
      // request a different keyVersion with a new sigversion.
      keyVersion = 0;
      break;
    default:
      return false;
  }
  if (inputNumber > transaction.inputs.length - 1) {
    throw new Error('inputNumber is greater than number of inputs')
  }

  const ss = TaggedHash.TAPSIGHASH;

  // Epoch
  ss.writeUInt8(0);

  // Hash type
  const outputType = (sighashType == Signature.SIGHASH_DEFAULT) ? Signature.SIGHASH_ALL : (sighashType & Signature.SIGHASH_OUTPUT_MASK); // Default (no sighash byte) is equivalent to SIGHASH_ALL
  const inputType = sighashType & Signature.SIGHASH_INPUT_MASK;
  if (!(sighashType <= 0x03 || (sighashType >= 0x81 && sighashType <= 0x83))) {
    return false;
  }
  ss.writeUInt8(sighashType);

  // Transaction level data
  ss.writeInt32LE(transaction.version);
  ss.writeUInt32LE(transaction.nLockTime);
  if (inputType !== Signature.SIGHASH_ANYONECANPAY) {
    const prevoutsBW = new BufferWriter();
    const spentAmountsBW = new BufferWriter();
    const spentScriptsBW = new BufferWriter();
    const sequencesBW = new BufferWriter();

    for(let vin of transaction.inputs) {
      prevoutsBW.writeReverse(vin.prevTxId);
      prevoutsBW.writeInt32LE(vin.outputIndex);

      spentAmountsBW.writeUInt64LEBN(vin.output._satoshisBN);

      spentScriptsBW.writeUInt8(vin.output.script.toBuffer().length);
      spentScriptsBW.write(vin.output.script.toBuffer());

      sequencesBW.writeUInt32LE(vin.sequenceNumber);
    }

    // ss << cache.m_prevouts_single_hash;
    const prevoutsSingleHash = Hash.sha256(prevoutsBW.toBuffer());
    ss.write(prevoutsSingleHash);

    // ss << cache.m_spent_amounts_single_hash;
    const spentAmountsSingleHash = Hash.sha256(spentAmountsBW.toBuffer());
    ss.write(spentAmountsSingleHash);

    // ss << cache.m_spent_scripts_single_hash;
    const spentScriptsSingleHash = Hash.sha256(spentScriptsBW.toBuffer());
    ss.write(spentScriptsSingleHash);

    // ss << cache.m_sequences_single_hash;
    const sequencesSingleHash = Hash.sha256(sequencesBW.toBuffer());
    ss.write(sequencesSingleHash);
  }
  if (outputType === Signature.SIGHASH_ALL) {
    const outputsBW = new BufferWriter();
    for (let vout of transaction.outputs) {
      outputsBW.write(vout.toBufferWriter().toBuffer());
    }
    // ss << cache.m_outputs_single_hash;
    const outputsSingleHash = Hash.sha256(outputsBW.toBuffer());
    ss.write(outputsSingleHash);
  }

  // Data about the input/prevout being spent
  $.checkArgument(execdata.annexInit, 'missing or invalid annexInit');
  const spendType = (extFlag << 1) + (execdata.annexPresent ? 1 : 0); // The low bit indicates whether an annex is present.
  ss.writeUInt8(spendType);
  if (inputType === Signature.SIGHASH_ANYONECANPAY) {
    // ss << tx_to.vin[in_pos].prevout;
    const buf = new BufferWriter();
    buf.writeReverse(transaction.inputs[inputNumber].prevTxId);
    buf.writeInt32LE(transaction.inputs[inputNumber].outputIndex);
    ss.write(buf.toBuffer());
    // ss << cache.m_spent_outputs[inputNumber];
    ss.write(transaction.inputs[inputNumber].output.toBufferWriter().toBuffer());
    ss.writeUInt32LE(transaction.inputs[inputNumber].sequenceNumber);
  } else {
    ss.writeUInt32LE(inputNumber);
  }
  if (execdata.annexPresent) {
    ss.write(execdata.annexHash);
  }

  // Data about the output (if only one).
  if (outputType === Signature.SIGHASH_SINGLE) {
    if (inputNumber >= transaction.outputs.length) {
      return false;
    }
    const bw = new BufferWriter();
    bw.writeUInt64LEBN(transaction.outputs[inputNumber]._satoshisBN);
    const buf = transaction.outputs[inputNumber].script.toBuffer();
    bw.writeVarintNum(buf.length);
    bw.write(buf);
    ss.write(Hash.sha256(bw.toBuffer()));
  }

  // Additional data for BIP 342 signatures
  if (sigversion == Signature.Version.TAPSCRIPT) {
    $.checkArgument(execdata.tapleafHashInit, 'missing or invalid tapleafHashInit');
    ss.write(execdata.tapleafHash);
    ss.writeUInt8(keyVersion);
    $.checkArgument(execdata.codeseparatorPosInit, 'missing or invalid codeseparatorPosInit');
    ss.writeUInt32LE(execdata.codeseparatorPos);
  }

  // Return the SHA256 hash
  return ss.finalize();
};


/**
 * Create a Schnorr signature
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
  let hashbuf = _signatureHash(transaction, sighashType, inputIndex, scriptCode, satoshisBuffer);
  let sig = Schnorr.sign(privateKey.toString(), hashbuf);
  return sig;
}

/**
 * Verify a Schnorr signature
 *
 * @name Signing.verify
 * @param {Transaction} transaction
 * @param {Signature} signature
 * @param {PublicKey} publicKey
 * @param {Number} inputIndex
 * @param {Object} execdata
 * @return {Boolean}
 */
function verify(transaction, signature, publicKey, sigversion, inputIndex, execdata) {
  $.checkArgument(!_.isUndefined(transaction), 'Transaction Undefined');

  let hashbuf = _signatureHash(transaction, signature.nhashtype, inputIndex, sigversion, execdata);
  if (!hashbuf) {
    return false;
  }
  let verified = Schnorr.verify(publicKey, hashbuf, signature);
  return verified;
}

/**
 * @namespace Signing
 */
module.exports = {
  sign: sign,
  verify: verify
};