'use strict';

const Signature = require('../crypto/signature');
const Script = require('../script');
const Output = require('./output');
const BufferReader = require('../encoding/bufferreader');
const BufferWriter = require('../encoding/bufferwriter');
const BN = require('../crypto/bn');
const Hash = require('../crypto/hash');
const ECDSA = require('../crypto/ecdsa');
const $ = require('../util/preconditions');

const SIGHASH_SINGLE_BUG = '0000000000000000000000000000000000000000000000000000000000000001';
const BITS_64_ON = 'ffffffffffffffff';

/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for OP_CHECKSIG.
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 * @param {Script} subscript the script that will be signed
 * @returns {Buffer} the hash to sign in little endian. NOTE: this must be signed big endian
 *   which is why the Sighash.sign() method passes { endian: 'little' } to ECDSA.sign(),
 *   but you're signing the sighash manually, you should call .reverse() first.
 */
function sighash(transaction, sighashType, inputNumber, subscript) {
  const Transaction = require('./transaction');
  const Input = require('./input');

  // Convert a string to a number
  inputNumber = parseInt(inputNumber);

  let i;
  // Copy transaction
  const txcopy = Transaction.shallowCopy(transaction);

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

  const buf = new BufferWriter()
    .write(txcopy.toBuffer())
    .writeInt32LE(sighashType)
    .toBuffer();
  let ret = Hash.sha256sha256(buf);
  ret = new BufferReader(ret).readReverse();

  // Note, ret is little endian, but must be signed big endian.
  // Thus, the sign() method below passes { endian: 'little' } to ECDSA.sign(),
  //  but if the sighash is signed manually, it should be reversed first.
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
 * @return {Signature}
 */
function sign(transaction, privateKey, sighashType, inputIndex, subscript) {
  let hashbuf = sighash(transaction, sighashType, inputIndex, subscript);
  const sig = ECDSA.sign(hashbuf, privateKey, { endian: 'little' });
  sig.nhashtype = sighashType;
  return sig;
};

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
function verify(transaction, signature, publicKey, inputIndex, subscript) {
  $.checkArgument(transaction != null, 'transaction cannot be nullish');
  $.checkArgument(signature != null && signature.nhashtype != null, 'signature and signature.nhashtype cannot be nullish');

  let hashbuf = sighash(transaction, signature.nhashtype, inputIndex, subscript);
  return ECDSA.verify(hashbuf, signature, publicKey, { endian: 'little' });
};

/**
 * @namespace Signing
 */
module.exports = {
  sighash: sighash,
  sign: sign,
  verify: verify
};
