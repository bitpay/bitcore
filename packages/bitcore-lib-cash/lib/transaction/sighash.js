'use strict';

const Signature = require('../crypto/signature');
const Script = require('../script');
const Output = require('./output');
const BufferReader = require('../encoding/bufferreader');
const BufferWriter = require('../encoding/bufferwriter');
const BN = require('../crypto/bn');
const Hash = require('../crypto/hash');
const ECDSA = require('../crypto/ecdsa');
const Schnorr = require('../crypto/schnorr');
const $ = require('../util/preconditions');
const BufferUtil = require('../util/buffer');
const Interpreter = require('../script/interpreter');

const SIGHASH_SINGLE_BUG = '0000000000000000000000000000000000000000000000000000000000000001';
const BITS_64_ON = 'ffffffffffffffff';

// By default, we sign with sighash_forkid
const DEFAULT_SIGN_FLAGS = Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID;


const _sighashForForkId = function(transaction, sighashType, inputNumber, subscript, satoshisBN) {
  const input = transaction.inputs[inputNumber];
  $.checkArgument(satoshisBN instanceof BN, 'For ForkId=0 signatures, satoshis or complete input must be provided');

  function GetForkId() {
    return 0; // In the UAHF, a fork id of 0 is used (see [4] REQ-6-2 NOTE 4)
  };

  function GetPrevoutHash(tx) {
    const writer = new BufferWriter();

    for (const input of tx.inputs) {
      writer.writeReverse(input.prevTxId);
      writer.writeUInt32LE(input.outputIndex);
    }

    const buf = writer.toBuffer();
    const ret = Hash.sha256sha256(buf);
    return ret;
  }

  function GetSequenceHash(tx) {
    const writer = new BufferWriter();

    for (const input of tx.inputs) {
      writer.writeUInt32LE(input.sequenceNumber);
    }

    const buf = writer.toBuffer();
    const ret = Hash.sha256sha256(buf);
    return ret;
  }

  function GetOutputsHash(tx, n) {
    const writer = new BufferWriter();

    if (n == null) {
      for (const output of tx.outputs) {
        output.toBufferWriter(writer);
      }
    } else {
      tx.outputs[n].toBufferWriter(writer);
    }
   
    const buf = writer.toBuffer();
    const ret = Hash.sha256sha256(buf);
    return ret;
  }

  let hashPrevouts = BufferUtil.emptyBuffer(32);
  let hashSequence = BufferUtil.emptyBuffer(32);
  let hashOutputs = BufferUtil.emptyBuffer(32);

  if (!(sighashType & Signature.SIGHASH_ANYONECANPAY)) {
    hashPrevouts = GetPrevoutHash(transaction);
  }

  if (
    !(sighashType & Signature.SIGHASH_ANYONECANPAY) &&
    (sighashType & 31) != Signature.SIGHASH_SINGLE &&
    (sighashType & 31) != Signature.SIGHASH_NONE
  ) {
    hashSequence = GetSequenceHash(transaction);
  }

  if ((sighashType & 31) != Signature.SIGHASH_SINGLE && (sighashType & 31) != Signature.SIGHASH_NONE) {
    hashOutputs = GetOutputsHash(transaction);
  } else if ((sighashType & 31) == Signature.SIGHASH_SINGLE && inputNumber < transaction.outputs.length) {
    hashOutputs = GetOutputsHash(transaction, inputNumber);
  }

  function getHash (w) {
    const buf = w.toBuffer();
    let ret = Hash.sha256sha256(buf);
    ret = new BufferReader(ret).readReverse();
    return ret;
  };  

  const writer = new BufferWriter();

  // Version
  writer.writeInt32LE(transaction.version);

  // Input prevouts/nSequence (none/all, depending on flags)
  writer.write(hashPrevouts);
  writer.write(hashSequence);

  //  outpoint (32-byte hash + 4-byte little endian)
  writer.writeReverse(input.prevTxId);
  writer.writeUInt32LE(input.outputIndex);

  // scriptCode of the input (serialized as scripts inside CTxOuts)
  writer.writeVarintNum(subscript.toBuffer().length)
  writer.write(subscript.toBuffer());

  // value of the output spent by this input (8-byte little endian)
  writer.writeUInt64LEBN(satoshisBN);
  
  // nSequence of the input (4-byte little endian) 
  var sequenceNumber = input.sequenceNumber;
  writer.writeUInt32LE(sequenceNumber);

  // Outputs (none/one/all, depending on flags)
  writer.write(hashOutputs);

  // Locktime
  writer.writeUInt32LE(transaction.nLockTime);

  // sighashType 
  writer.writeUInt32LE(sighashType >>>0);

  const buf = writer.toBuffer();
  let ret = Hash.sha256sha256(buf);
  ret = new BufferReader(ret).readReverse();

  // Note, ret is little endian, but must be signed big endian.
  // Thus, the sign() method below passes { endian: 'little' } to ECDSA.sign(),
  //  but if the sighash is signed manually, it should be reversed first.
  return ret;
}

/**
 * Returns a buffer of length 32 bytes with the hash that needs to be signed
 * for OP_CHECKSIG.
 *
 * @name Signing.sighash
 * @param {Transaction} transaction the transaction to sign
 * @param {number} sighashType the type of the hash
 * @param {number} inputNumber the input index for the signature
 * @param {Script} subscript the script that will be signed
 * @param {BN} satoshisBN input's amount (for ForkId signatures)
 * @param {number} flags the flags to use for signing (default: Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID)
 * @returns {Buffer} the hash to sign in little endian. NOTE: this must be signed big endian
 */
function sighash(transaction, sighashType, inputNumber, subscript, satoshisBN, flags) {
  const Transaction = require('./transaction');
  const Input = require('./input');
  
  if (flags == null){
    flags = DEFAULT_SIGN_FLAGS;
  }

  // Copy transaction
  const txcopy = Transaction.shallowCopy(transaction);

  // Copy script
  subscript = new Script(subscript);

  if (flags & Interpreter.SCRIPT_ENABLE_REPLAY_PROTECTION) {
    // Legacy chain's value for fork id must be of the form 0xffxxxx.
    // By xoring with 0xdead, we ensure that the value will be different
    // from the original one, even if it already starts with 0xff.
    const forkValue = sighashType >> 8;
    const newForkValue =  0xff0000 | ( forkValue ^ 0xdead);
    sighashType = (newForkValue << 8) | (sighashType & 0xff);
  }

  if ((sighashType & Signature.SIGHASH_FORKID) && (flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID)) {
    return _sighashForForkId(txcopy, sighashType, inputNumber, subscript, satoshisBN);
  }

  // For no ForkId sighash, separators need to be removed.
  subscript.removeCodeseparators();

  for (let i = 0; i < txcopy.inputs.length; i++) {
    // Blank signatures for other inputs
    txcopy.inputs[i] = new Input(txcopy.inputs[i]).setScript(Script.empty());
  }

  txcopy.inputs[inputNumber] = new Input(txcopy.inputs[inputNumber]).setScript(subscript);

  if (
    (sighashType & 31) === Signature.SIGHASH_NONE ||
    (sighashType & 31) === Signature.SIGHASH_SINGLE
  ) {
    // clear all sequenceNumbers
    for (let i = 0; i < txcopy.inputs.length; i++) {
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

    for (let i = 0; i < inputNumber; i++) {
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
 * @param {BN} satoshisBN input's amount
 * @param {number} flags the flags to use for signing (default: Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID)
 * @param {signingMethod} signingMethod "ecdsa" or "schnorr" to sign a tx
 * @return {Signature}
 */
function sign(transaction, privateKey, sighashType, inputIndex, subscript, satoshisBN, flags, signingMethod) {
  const hashbuf = sighash(transaction, sighashType, inputIndex, subscript, satoshisBN, flags);

  signingMethod = signingMethod || 'ecdsa';

  if (signingMethod === 'schnorr') {
    const sig = Schnorr.sign(hashbuf, privateKey, 'little')
      .set({ nhashtype: sighashType });
    return sig;
  } else if (signingMethod === 'ecdsa') {
    const sig = ECDSA.sign(hashbuf, privateKey, { endian: 'little' });
    sig.nhashtype = sighashType;
    return sig;
  }
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
 * @param {satoshisBN} input's amount
 * @param {flags} verification flags
 * @param {signingMethod} signingMethod 'ecdsa' or 'schnorr' to sign a tx
 * @return {boolean}
 */
function verify(transaction, signature, publicKey, inputIndex, subscript, satoshisBN, flags, signingMethod) {
  $.checkArgument(transaction != null, 'transaction cannot be nullish');
  $.checkArgument(signature != null && signature.nhashtype != null, 'signature and signature.nhashtype cannot be nullish');
  const hashbuf = sighash(transaction, signature.nhashtype, inputIndex, subscript, satoshisBN, flags);

  signingMethod = signingMethod || 'ecdsa';

  if (signingMethod === 'schnorr') {
    return Schnorr.verify(hashbuf, signature, publicKey, 'little')
  } else if(signingMethod === 'ecdsa') {
    return ECDSA.verify(hashbuf, signature, publicKey, { endian: 'little' });
  }
}

/**
 * @namespace Signing
 */
module.exports = {
  sighash: sighash,
  sign: sign,
  verify: verify
};
