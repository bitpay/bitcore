'use strict';

var Signature = require('../crypto/signature');
var Script = require('../script');
var Output = require('./output');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var BN = require('../crypto/bn');
var Hash = require('../crypto/hash');
var ECDSA = require('../crypto/ecdsa');
var $ = require('../util/preconditions');
var _ = require('lodash');
const schnorr = require('bip-schnorr');

var SIGHASH_SINGLE_BUG = '0000000000000000000000000000000000000000000000000000000000000001';
var BITS_64_ON = 'ffffffffffffffff';

/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for OP_CHECKSIG.
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 * @param {Script} subscript the script that will be signed
 */
var sighash = function sighash(transaction, sighashType, inputNumber, subscript) {
  var Transaction = require('./transaction');
  var Input = require('./input');

  var i;
  // Copy transaction
  var txcopy = Transaction.shallowCopy(transaction);

  // Copy script
  subscript = new Script(subscript);
  subscript.removeCodeseparators();

  for (i = 0; i < txcopy.inputs.length; i++) {
    // Blank signatures for other inputs
    txcopy.inputs[i] = new Input(txcopy.inputs[i]).setScript(Script.empty());
  }

  txcopy.inputs[inputNumber] = new Input(txcopy.inputs[inputNumber]).setScript(subscript);

  if ((sighashType & 31) === Signature.SIGHASH_NONE ||
    (sighashType & 31) === Signature.SIGHASH_SINGLE) {

    // clear all sequenceNumbers
    for (i = 0; i < txcopy.inputs.length; i++) {
      if (i !== inputNumber) {
        txcopy.inputs[i].sequenceNumber = 0;
      }
    }
  }

  if ((sighashType & 31) === Signature.SIGHASH_NONE) {
    txcopy.outputs = [];

  } else if ((sighashType & 31) === Signature.SIGHASH_SINGLE) {
    // The SIGHASH_SINGLE bug.
    // https://bitcointalk.org/index.php?topic=260595.0
    if (inputNumber >= txcopy.outputs.length) {
      return Buffer.from(SIGHASH_SINGLE_BUG, 'hex');
    }

    txcopy.outputs.length = inputNumber + 1;

    for (i = 0; i < inputNumber; i++) {
      txcopy.outputs[i] = new Output({
        satoshis: BN.fromBuffer(Buffer.from(BITS_64_ON, 'hex')),
        script: Script.empty()
      });
    }
  }

  if (sighashType & Signature.SIGHASH_ANYONECANPAY) {
    txcopy.inputs = [txcopy.inputs[inputNumber]];
  }

  var buf = new BufferWriter()
    .write(txcopy.toBuffer())
    .writeInt32LE(sighashType)
    .toBuffer();
  var ret = Hash.sha256sha256(buf);
  ret = new BufferReader(ret).readReverse();
  return ret;
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
 * @param {String} signingMethod - method used to sign - 'ecdsa' or 'schnorr' (future signing method)
 * @return {Signature}
 */
function sign(transaction, privateKey, sighashType, inputIndex, subscript, signingMethod) {
  signingMethod = signingMethod || 'ecdsa';

  let hashbuf = sighash(transaction, sighashType, inputIndex, subscript);
  let sig; 
  switch (signingMethod) {
    case 'ecdsa':
      sig = ECDSA.sign(hashbuf, privateKey, 'little').set({ nhashtype: sighashType });
      break;
    case 'schnorr':
      sig = schnorr.sign(privateKey.toString(), hashbuf);
      break;
    default: 
      throw new Error("signingMethod not supported ", signingMethod);
  }
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
 * @param {String} signingMethod - method used to sign - 'ecdsa' or 'schnorr'
 * @return {boolean}
 */
function verify(transaction, signature, publicKey, inputIndex, subscript, signingMethod) {
  $.checkArgument(!_.isUndefined(transaction), "Transaction Undefined");
  $.checkArgument(!_.isUndefined(signature) && !_.isUndefined(signature.nhashtype), "Signature Undefined");

  signingMethod = signingMethod || 'ecdsa';
  let hashbuf = sighash(transaction, signature.nhashtype, inputIndex, subscript);
  let verified = false;

  switch (signingMethod) {
    case 'ecdsa':
      verified = ECDSA.verify(hashbuf, signature, publicKey, 'little');
      break;
    case 'schnorr':
      verified = schnorr.verify(publicKey, hashbuf, signature);
      break;
    default:
      throw new Error("signingMethod not supported ", signingMethod);
  }
  return verified;
}

/**
 * @namespace Signing
 */
module.exports = {
  sighash: sighash,
  sign: sign,
  verify: verify
};
