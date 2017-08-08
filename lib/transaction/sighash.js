'use strict';

var buffer = require('buffer');

var Signature = require('../crypto/signature');
var Script = require('../script');
var Output = require('./output');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var BN = require('../crypto/bn');
var Hash = require('../crypto/hash');
var ECDSA = require('../crypto/ecdsa');
var $ = require('../util/preconditions');
var BufferUtil = require('../util/buffer');
var _ = require('lodash');

var SIGHASH_SINGLE_BUG = '0000000000000000000000000000000000000000000000000000000000000001';
var BITS_64_ON = 'ffffffffffffffff';


var ENABLE_SIGHASH_FORKID = true;


var sighashForForkId = function(transaction, sighashType, inputNumber, subscript, satoshisBN) {

console.log('[sighash.js.56:SIGHASH_FORKID:]'); //TODO
  console.log('[sighash.js.29:transaction:]', transaction); //TODO
  console.log('[sighash.js.29:sighashType:]', sighashType); //TODO
  console.log('[sighash.js.29:inputNumber:]', inputNumber); //TODO
  console.log('[sighash.js.29:subscript:]', subscript); //TODO
console.log('[sighash.js.24:satoshisBN:]',satoshisBN); //TODO
console.log('========================================================');

  var input = transaction.inputs[inputNumber];
  $.checkArgument(
    satoshisBN instanceof BN || (input.output && input.output._satoshisBN),
    'For ForkId=0 signatures, satoshis or complete input must be provided'
  );

  

  function GetForkId() {
    return 0; // In the UAHF, a fork id of 0 is used (see [4] REQ-6-2 NOTE 4)
  };

  function GetPrevoutHash() {
    var buf = new BufferWriter()
      // for ( n = 0; n < txTo.vin.size(); n++) {
      //   ss << txTo.vin[n].prevout;
      // }
    return buf.GetHash();
  }

  function GetSequenceHash() {
    // CHashWriter ss(SER_GETHASH, 0);
    // for ( n = 0; n < txTo.vin.size(); n++) {
    //   ss << txTo.vin[n].nSequence;
    // }
    //
    // return ss.GetHash();
  }

  function GetOutputsHash(tx) {
    var writer = new BufferWriter()
    _.each(tx.outputs, function(output) {
      output.toBufferWriter(writer);
    });

    var buf = writer.toBuffer();
    var ret = Hash.sha256sha256(buf);
console.log('[sighash.js.58:ret:]',ret); //TODO
    return ret;
  }

  satoshisBN = satoshisBN || input.output._satoshisBN;
  var hashPrevouts = BufferUtil.emptyBuffer(32);
  var hashSequence = BufferUtil.emptyBuffer(32);
  var hashOutputs = BufferUtil.emptyBuffer(32);

  if (!(sighashType & Signature.SIGHASH_ANYONECANPAY)) {
    console.log('NOT [sighash.js.62:SIGHASH_ANYONECANPAY:]'); //TODO
    // hashPrevouts = cache ? cache->hashPrevouts : GetPrevoutHash(txTo);
  }

  if (!(sighashType & Signature.SIGHASH_ANYONECANPAY) &&
    (sighashType & 31) != Signature.SIGHASH_SINGLE &&
    (sighashType & 31) != Signature.SIGHASH_NONE) {
    console.log('NOT [sighash.js.62:SIGHASH_ANYONECANPAY:] & !SINGLE && !NONE'); //TODO
    // hashSequence = cache ? cache->hashSequence : GetSequenceHash(txTo);
  }

  if ((sighashType & 31) != Signature.SIGHASH_SINGLE &&
    (sighashType & 31) != Signature.SIGHASH_NONE) {
    console.log('!SINGLE && !NONE'); //TODO
    hashOutputs = GetOutputsHash(transaction);
console.log('[sighash.js.94:hashOutputs:]',hashOutputs); //TODO

  } else if ((sighashType & 31) == Signature.SIGHASH_SINGLE &&
    nIn < txTo.vout.size()) {
    console.log('SINGLE'); //TODO
    // CHashWriter ss(SER_GETHASH, 0);
    // ss << txTo.vout[nIn];
    // hashOutputs = ss.GetHash();
  }


function getHash (w) {

  var buf = w.toBuffer();
  var ret = Hash.sha256sha256(buf);
  ret = new BufferReader(ret).readReverse();
  return ret;
};  



  var writer = new BufferWriter()

  // Version
  writer.writeInt32LE(transaction.version);


  // // Input prevouts/nSequence (none/all, depending on flags)
  writer.write(hashPrevouts);
  writer.write(hashSequence);
// OK  

  //  outpoint (32-byte hash + 4-byte little endian)
  writer.writeReverse(input.prevTxId);
  writer.writeUInt32LE(input.outputIndex);
// OK

  // scriptCode of the input (serialized as scripts inside CTxOuts)
  writer.writeUInt8(subscript.toBuffer().length)
  writer.write(subscript.toBuffer());
// OK

  // value of the output spent by this input (8-byte little endian)
  writer.writeUInt64LEBN(satoshisBN);
  
// OK
   
  // nSequence of the input (4-byte little endian) 
  var sequenceNumber = input.sequenceNumber;
  writer.writeUInt32LE(sequenceNumber);
  //ok

  // Outputs (none/one/all, depending on flags)
  writer.write(hashOutputs);
  //Ok

  // Locktime
  writer.writeUInt32LE(transaction.nLockTime);
  //OK

  // sighashType 
  //writer.writeUInt32LE((GetForkId() << 24) | (sighashType & 31));
console.log('[sighash.js.158:sighashType:]',sighashType); //TODO
  writer.writeUInt32LE(sighashType >>>0);
  //OK!

  var buf = writer.toBuffer();
  var ret = Hash.sha256sha256(buf);
  ret = new BufferReader(ret).readReverse();
  return ret;

  //
  // writer.writeVarintNum(this.inputs.length);
  // _.each(this.inputs, function(input) {
  //   input.toBufferWriter(writer);
  // });
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
 * @param {opts.satoshis} Optional, only used in ForkId signatures. If not provided, outputs's amount is used.
 *
 */
var sighash = function sighash(transaction, sighashType, inputNumber, subscript, opts) {
  opts = opts || {};

  var Transaction = require('./transaction');
  var Input = require('./input');

  // Copy transaction
  var txcopy = Transaction.shallowCopy(transaction);

  // Copy script
  subscript = new Script(subscript);


console.log('[sighash.js.197] type, ', sighashType, Signature.SIGHASH_FORKID,  sighashType & Signature.SIGHASH_FORKID ); //TODO

  if ( ( sighashType & Signature.SIGHASH_FORKID) && ENABLE_SIGHASH_FORKID) {
    return sighashForForkId(txcopy, sighashType, inputNumber, subscript, opts.satoshisBN);
  }
console.log('[sighash.js.200] NO FORKID'); //TODO

  // For no ForkId sighash, separators need to be removed.
  subscript.removeCodeseparators();

  var i;

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
      return new Buffer(SIGHASH_SINGLE_BUG, 'hex');
    }

    txcopy.outputs.length = inputNumber + 1;

    for (i = 0; i < inputNumber; i++) {
      txcopy.outputs[i] = new Output({
        satoshis: BN.fromBuffer(new buffer.Buffer(BITS_64_ON, 'hex')),
        script: Script.empty()
      });
    }
  }

  if (sighashType & Signature.SIGHASH_ANYONECANPAY) {
    txcopy.inputs = [txcopy.inputs[inputNumber]];
  }
console.log('[sighash.js.252:sighashType:]',sighashType); //TODO

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
 * @return {Signature}
 */
function sign(transaction, privateKey, sighashType, inputIndex, subscript) {
  var hashbuf = sighash(transaction, sighashType, inputIndex, subscript);
  var sig = ECDSA.sign(hashbuf, privateKey, 'little').set({
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
function verify(transaction, signature, publicKey, inputIndex, subscript) {
  $.checkArgument(!_.isUndefined(transaction));
  $.checkArgument(!_.isUndefined(signature) && !_.isUndefined(signature.nhashtype));
  var hashbuf = sighash(transaction, signature.nhashtype, inputIndex, subscript);
  return ECDSA.verify(hashbuf, signature, publicKey, 'little');
}

/**
 * @namespace Signing
 */
module.exports = {
  sighash: sighash,
  sign: sign,
  verify: verify
};
