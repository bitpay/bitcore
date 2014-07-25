// TransactionBuilder
// ==================
//
// Creates a bitcore Transaction object
//
//
// Synopsis
// --------
// ```
//     var tx = (new TransactionBuilder(opts))
//       .setUnspent(utxos)
//       .setOutputs(outs)
//       .sign(keys)
//       .build();
//
//
//     var builder = (new TransactionBuilder(opts))
//       .setUnspent(spent)
//       .setOutputs(outs);
//
//     // Uncomplete tx (no signed or partially signed)
//     var tx = builder.build();
//
//     ..later..
//
//     builder.sign(keys);
//     while ( builder.isFullySigned() ) {
//
//       ... get new keys ...
//
//       builder.sign(keys);
//     }
//
//     var tx = builder.build();
//     broadcast(tx.serialize());
//
//     //Serialize it and pass it around...
//     var string = JSON.stringify(builder.toObj()); 
//     // then...
//     var builder = TransactionBuilder.fromObj(JSON.parse(str); 
//     builder.sign(keys);
//     // Also
//     var builder2 = TransactionBuilder.fromObj(JSON.parse(str2); 
//     builder2.merge(builder); // Will merge signatures for p2sh mulsig txs.
//      
//
// ```
//
//  
//  


'use strict';

var Address = require('./Address');
var Script = require('./Script');
var util = require('../util');
var bignum = require('bignum');
var buffertools = require('buffertools');
var networks = require('../networks');
var WalletKey = require('./WalletKey');
var PrivateKey = require('./PrivateKey');
var Key = require('./Key');
var log = require('../util/log');
var Transaction = require('./Transaction');

var FEE_PER_1000B_SAT = parseInt(0.0001 * util.COIN);
var TOOBJ_VERSION = 1;

// Methods
// -------
//
// TransactionBuilder
// ------------------
// Creates a TransactionBuilder instance
// `opts`
//  ```
//      { 
//        remainderOut: null,
//        fee: 0.001,
//        lockTime: null,
//        spendUnconfirmed: false,
//        signhash: SIGHASH_ALL
//      }
//  ```    
//  Amounts are in BTC. instead of fee and amount; feeSat and amountSat can be given, 
//  repectively, to provide amounts in satoshis.
//  
//  If no remainderOut is given, and there are remainder coins, the
//  first IN out will be used to return the coins. remainderOut has the form:
//  ```
//      remainderOut = { address: 1xxxxx}
//  ```    
//  or
//  ```
//      remainderOut = { pubkeys: ['hex1','hex2',...} for multisig
//  ```    

function TransactionBuilder(opts) {
  opts = opts || {};

  this.vanilla = {};
  this.vanilla.scriptSig = [];
  this.vanilla.opts = JSON.stringify(opts);

  // If any default opts is changed, TOOBJ_VERSION should be changed as
  // a caution measure.

  this.lockTime = opts.lockTime || 0;
  this.spendUnconfirmed = opts.spendUnconfirmed || false;

  if (opts.fee || opts.feeSat) {
    this.givenFeeSat = opts.fee ? opts.fee * util.COIN : opts.feeSat;
  }
  this.remainderOut = opts.remainderOut;
  this.signhash = opts.signhash || Transaction.SIGHASH_ALL;

  this.tx = {};
  this.inputsSigned = 0;

  return this;
}

TransactionBuilder.FEE_PER_1000B_SAT = FEE_PER_1000B_SAT;

TransactionBuilder._scriptForPubkeys = function(out) {

  var l = out.pubkeys.length;
  var pubKeyBuf = [];

  for (var i = 0; i < l; i++) {
    pubKeyBuf.push(new Buffer(out.pubkeys[i], 'hex'));
  }

  return Script.createMultisig(out.nreq, pubKeyBuf);
};

TransactionBuilder._scriptForOut = function(out) {
  var ret;
  if (out.address)
    ret = new Address(out.address).getScriptPubKey();
  else if (out.pubkeys || out.nreq || out.nreq > 1)
    ret = this._scriptForPubkeys(out);
  else
    throw new Error('unknown out type');

  return ret;
};


TransactionBuilder.infoForP2sh = function(opts, networkName) {
  var script = this._scriptForOut(opts);
  var hash = util.sha256ripe160(script.getBuffer());

  var version = networkName === 'testnet' ?
    networks.testnet.P2SHVersion : networks.livenet.P2SHVersion;

  var addr = new Address(version, hash);
  var addrStr = addr.as('base58');
  return {
    script: script,
    scriptBufHex: script.getBuffer().toString('hex'),
    hash: hash,
    address: addrStr,
  };
};

// setUnspent
// ----------
//  Sets the `unspent` available for the transaction. Some (or all) 
//  of them to fullfil the transaction's outputs and fee.
//  The expected format is:
//  ```
//      [{
//         address: "mqSjTad2TKbPcKQ3Jq4kgCkKatyN44UMgZ",
//         txid: "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
//         scriptPubKey: "76a9146ce4e1163eb18939b1440c42844d5f0261c0338288ac",
//         vout: 1,
//         amount: 0.01,                
//        confirmations: 3
//         }, ...
//      ]
//  ```    
//   This is compatible con insight's utxo API. 
//   That amount is in BTCs (as returned in insight and bitcoind).
//   amountSat (instead of amount) can be given to provide amount in satochis.
TransactionBuilder.prototype.setUnspent = function(unspent) {
  this.vanilla.utxos = JSON.stringify(unspent);
  this.utxos = unspent;
  return this;
};

TransactionBuilder.prototype._setInputMap = function() {
  var inputMap = [];

  var l = this.selectedUtxos.length;
  for (var i = 0; i < l; i++) {
    var utxo = this.selectedUtxos[i];
    var scriptBuf = new Buffer(utxo.scriptPubKey, 'hex');
    var scriptPubKey = new Script(scriptBuf);
    var scriptType = scriptPubKey.classify();

    if (scriptType === Script.TX_UNKNOWN)
      throw new Error('unkown output type at:' + i +
        ' Type:' + scriptPubKey.getRawOutType());

    inputMap.push({
      address: utxo.address,
      scriptPubKey: scriptPubKey,
      scriptType: scriptType,
      i: i,
    });
  }
  this.inputMap = inputMap;
  return this;
};


// getSelectedUnspent
// ------------------
//
// Returns the selected unspent outputs, to be used in the transaction.

TransactionBuilder.prototype.getSelectedUnspent = function() {
  return this.selectedUtxos;
};

/* _selectUnspent
 * TODO(?): sort sel (at the end) and check is some inputs can be avoided.
 * If the initial utxos are sorted, this step would be necesary only if
 * utxos were selected from different minConfirmationSteps.
 */

TransactionBuilder.prototype._selectUnspent = function(neededAmountSat) {

  if (!this.utxos || !this.utxos.length)
    throw new Error('unspent not set');

  var minConfirmationSteps = [6, 1];
  if (this.spendUnconfirmed) minConfirmationSteps.push(0);

  var sel = [],
    totalSat = bignum(0),
    fulfill = false,
    maxConfirmations = null,
    l = this.utxos.length;

  do {
    var minConfirmations = minConfirmationSteps.shift();
    for (var i = 0; i < l; i++) {
      var u = this.utxos[i];
      var c = u.confirmations || 0;

      if (c < minConfirmations || (maxConfirmations && c >= maxConfirmations))
        continue;

      var sat = u.amountSat || util.parseValue(u.amount);
      totalSat = totalSat.add(sat);
      sel.push(u);
      if (totalSat.cmp(neededAmountSat) >= 0) {
        fulfill = true;
        break;
      }
    }
    maxConfirmations = minConfirmations;
  } while (!fulfill && minConfirmationSteps.length);

  if (!fulfill)
    throw new Error('not enough unspent tx outputs to fulfill totalNeededAmount [SAT]:' +
      neededAmountSat);

  this.selectedUtxos = sel;
  this._setInputMap();
  return this;
};

TransactionBuilder.prototype._setInputs = function(txobj) {
  var ins = this.selectedUtxos;
  var l = ins.length;
  var valueInSat = bignum(0);

  txobj.ins = [];
  for (var i = 0; i < l; i++) {
    valueInSat = valueInSat.add(util.parseValue(ins[i].amount));

    var txin = {};
    txin.s = util.EMPTY_BUFFER;
    txin.q = 0xffffffff;

    var hash = new Buffer(ins[i].txid, 'hex');
    var hashReversed = buffertools.reverse(hash);

    var vout = parseInt(ins[i].vout);
    var voutBuf = new Buffer(4);
    voutBuf.writeUInt32LE(vout, 0);

    txin.o = Buffer.concat([hashReversed, voutBuf]);
    txobj.ins.push(txin);
  }
  this.valueInSat = valueInSat;
  return this;
};

TransactionBuilder.prototype._setFee = function(feeSat) {
  if (typeof this.valueOutSat === 'undefined')
    throw new Error('valueOutSat undefined');


  var valueOutSat = this.valueOutSat.add(feeSat);

  if (this.valueInSat.cmp(valueOutSat) < 0) {
    var inv = this.valueInSat.toString();
    var ouv = valueOutSat.toString();
    throw new Error('transaction input amount is less than outputs: ' +
      inv + ' < ' + ouv + ' [SAT]');
  }
  this.feeSat = feeSat;
  return this;
};

TransactionBuilder.prototype._setRemainder = function(txobj, remainderIndex) {

  if (typeof this.valueInSat === 'undefined' ||
    typeof this.valueOutSat === 'undefined')
    throw new Error('valueInSat / valueOutSat undefined');

  /* add remainder (without modifying outs[]) */
  var remainderSat = this.valueInSat.sub(this.valueOutSat).sub(this.feeSat);
  var l = txobj.outs.length;
  this.remainderSat = bignum(0);

  /*remove old remainder? */
  if (l > remainderIndex) {
    txobj.outs.pop();
  }

  if (remainderSat.cmp(0) > 0) {
    var remainderOut = this.remainderOut || this.selectedUtxos[0];
    var value = util.bigIntToValue(remainderSat);
    var script = TransactionBuilder._scriptForOut(remainderOut);
    var txout = {
      v: value,
      s: script.getBuffer(),
    };
    txobj.outs.push(txout);
    this.remainderSat = remainderSat;
  }

  return this;
};

TransactionBuilder.prototype._setFeeAndRemainder = function(txobj) {

  /* starting size estimation */
  var size = 500,
    maxSizeK, remainderIndex = txobj.outs.length;
  do {
    /* based on https://en.bitcoin.it/wiki/Transaction_fees */
    maxSizeK = parseInt(size / 1000) + 1;

    var feeSat = this.givenFeeSat ?
      this.givenFeeSat : maxSizeK * FEE_PER_1000B_SAT;

    var neededAmountSat = this.valueOutSat.add(feeSat);

    this._selectUnspent(neededAmountSat)
      ._setInputs(txobj)
      ._setFee(feeSat)
      ._setRemainder(txobj, remainderIndex);


    size = new Transaction(txobj).getSize();
  } while (size > (maxSizeK + 1) * 1000);
  return this;
};

// setOutputs
// ----------
// Sets the outputs for the transaction. Format is:
// ```
//      an array of [{
//        address: xx, 
//        amount:0.001
//       },...]
// ```      
//
// Note that only some of this outputs will be selected
// to create the transaction. The selected ones can be checked
// after calling `setOutputs`, with `.getSelectedUnspent`.
// amountSatStr could be used to pass in the amount in satoshis, as a string.
//

TransactionBuilder.prototype.setOutputs = function(outs) {
  this.vanilla.outs = JSON.stringify(outs);

  var valueOutSat = bignum(0);
  var txobj = {};
  txobj.version = 1;
  txobj.lock_time = this.lockTime || 0;
  txobj.ins = [];
  txobj.outs = [];

  var l = outs.length;
  for (var i = 0; i < l; i++) {
    var amountSat = outs[i].amountSat || outs[i].amountSatStr ? bignum(outs[i].amountSatStr) : util.parseValue(outs[i].amount);
    var value = util.bigIntToValue(amountSat);
    var script = TransactionBuilder._scriptForOut(outs[i]);
    var txout = {
      v: value,
      s: script.getBuffer(),
    };
    txobj.outs.push(txout);

    valueOutSat = valueOutSat.add(amountSat);
  }

  this.valueOutSat = valueOutSat;

  this._setFeeAndRemainder(txobj);

  this.tx = new Transaction(txobj);
  return this;
};

TransactionBuilder._mapKeys = function(keys) {
  /* prepare keys */
  var walletKeyMap = {};
  var l = keys.length;
  var wk;
  for (var i = 0; i < l; i++) {
    var k = keys[i];

    if (typeof k === 'string') {
      var pk = new PrivateKey(k);
      wk = new WalletKey({
        network: pk.network()
      });
      wk.fromObj({
        priv: k
      });
    } else if (k instanceof WalletKey) {
      wk = k;
    } else {
      throw new Error('argument must be an array of strings (WIF format) or WalletKey objects');
    }
    var addr = wk.storeObj().addr;
    walletKeyMap[addr] = wk;

  }
  return walletKeyMap;
};

TransactionBuilder._signHashAndVerify = function(wk, txSigHash) {
  var triesLeft = 10,
    sigRaw;

  do {
    sigRaw = wk.privKey.signSync(txSigHash);
  } while (wk.privKey.verifySignatureSync(txSigHash, sigRaw) === false &&
    triesLeft--);

  if (triesLeft < 0)
    throw new Error('could not sign input: verification failed');

  return sigRaw;
};

TransactionBuilder.prototype._checkTx = function() {
  if (!this.tx || !this.tx.ins || !this.tx.ins.length || !this.tx.outs.length)
    throw new Error('tx is not defined');
};


TransactionBuilder.prototype._multiFindKey = function(walletKeyMap, pubKeyHash) {
  var wk;
  [networks.livenet, networks.testnet].forEach(function(n) {
    [n.addressVersion, n.P2SHVersion].forEach(function(v) {
      var a = new Address(v, pubKeyHash);
      if (!wk && walletKeyMap[a]) {
        wk = walletKeyMap[a];
      }
    });
  });

  return wk;
};

TransactionBuilder.prototype._findWalletKey = function(walletKeyMap, input) {
  var wk;

  if (input.address) {
    wk = walletKeyMap[input.address];
  } else if (input.pubKeyHash) {
    wk = this._multiFindKey(walletKeyMap, input.pubKeyHash);
  } else if (input.pubKeyBuf) {
    var pubKeyHash = util.sha256ripe160(input.pubKeyBuf);
    wk = this._multiFindKey(walletKeyMap, pubKeyHash);
  } else {
    throw new Error('no infomation at input to find keys');
  }
  return wk;
};

TransactionBuilder.prototype._signPubKey = function(walletKeyMap, input, txSigHash) {
  if (this.tx.ins[input.i].s.length > 0) return {};

  var wk = this._findWalletKey(walletKeyMap, input);
  if (!wk) return;

  var sigRaw = TransactionBuilder._signHashAndVerify(wk, txSigHash);
  var sigType = new Buffer(1);
  sigType[0] = this.signhash;
  var sig = Buffer.concat([sigRaw, sigType]);

  var scriptSig = new Script();
  scriptSig.chunks.push(sig);
  scriptSig.updateBuffer();
  return {
    inputFullySigned: true,
    signaturesAdded: 1,
    script: scriptSig.getBuffer()
  };
};

TransactionBuilder.prototype._signPubKeyHash = function(walletKeyMap, input, txSigHash) {

  if (this.tx.ins[input.i].s.length > 0) return {};

  var wk = this._findWalletKey(walletKeyMap, input);
  if (!wk) return;

  var sigRaw = TransactionBuilder._signHashAndVerify(wk, txSigHash);
  var sigType = new Buffer(1);
  sigType[0] = this.signhash;
  var sig = Buffer.concat([sigRaw, sigType]);

  var scriptSig = new Script();
  scriptSig.chunks.push(sig);
  scriptSig.chunks.push(wk.privKey.public);
  scriptSig.updateBuffer();
  return {
    inputFullySigned: true,
    signaturesAdded: 1,
    script: scriptSig.getBuffer()
  };
};

/* FOR TESTING
var _dumpChunks = function (scriptSig, label) {
  console.log('## DUMP: ' + label + ' ##');
  for(var i=0; i<scriptSig.chunks.length; i++) {
    console.log('\tCHUNK ', i, Buffer.isBuffer(scriptSig.chunks[i])
                ?scriptSig.chunks[i].toString('hex'):scriptSig.chunks[i] ); 
  }
};
*/

TransactionBuilder.prototype._chunkSignedWithKey = function(scriptSig, txSigHash, publicKey) {
  var ret;
  var k = new Key();
  k.public = publicKey;

  for (var i = 1; i <= scriptSig.countSignatures(); i++) {
    var chunk = scriptSig.chunks[i];
    var sigRaw = new Buffer(chunk.slice(0, chunk.length - 1));
    if (k.verifySignatureSync(txSigHash, sigRaw)) {
      ret = chunk;
    }
  }
  return ret;
};


TransactionBuilder.prototype._getSignatureOrder = function(sigPrio, sigRaw, txSigHash, pubkeys) {
  var l = pubkeys.length;
  for (var j = 0; j < l; j++) {
    var k = new Key();
    k.public = new Buffer(pubkeys[j], 'hex');
    if (k.verifySignatureSync(txSigHash, sigRaw))
      break;
  }
  return j;
};

TransactionBuilder.prototype._getNewSignatureOrder = function(sigPrio, scriptSig, txSigHash, pubkeys) {
  var iPrio;
  for (var i = 1; i <= scriptSig.countSignatures(); i++) {
    var chunk = scriptSig.chunks[i];
    var sigRaw = new Buffer(chunk.slice(0, chunk.length - 1));
    iPrio = this._getSignatureOrder(sigPrio, sigRaw, txSigHash, pubkeys);
    if (sigPrio <= iPrio) break;
  }
  return (sigPrio === iPrio ? -1 : i - 1);
};

TransactionBuilder.prototype._chunkIsEmpty = function(chunk) {
  return chunk === 0 || // when serializing and back, EMPTY_BUFFER becomes 0
    buffertools.compare(chunk, util.EMPTY_BUFFER) === 0;
};

TransactionBuilder.prototype._initMultiSig = function(script) {
  var wasUpdated = false;
  if (script.chunks[0] !== 0) {
    script.prependOp0();
    wasUpdated = true;
  }
  return wasUpdated;
};

TransactionBuilder.prototype._updateMultiSig = function(sigPrio, wk, scriptSig, txSigHash, pubkeys) {
  var wasUpdated = this._initMultiSig(scriptSig);

  if (this._chunkSignedWithKey(scriptSig, txSigHash, wk.privKey.public))
    return null;

  // Create signature
  var sigRaw = TransactionBuilder._signHashAndVerify(wk, txSigHash);
  var sigType = new Buffer(1);
  sigType[0] = this.signhash;
  var sig = Buffer.concat([sigRaw, sigType]);

  // Add signature
  var order = this._getNewSignatureOrder(sigPrio, scriptSig, txSigHash, pubkeys);
  scriptSig.chunks.splice(order + 1, 0, sig);
  scriptSig.updateBuffer();
  wasUpdated = true;

  return wasUpdated ? scriptSig : null;
};


TransactionBuilder.prototype._signMultiSig = function(walletKeyMap, input, txSigHash) {
  var pubkeys = input.scriptPubKey.capture(),
    nreq = input.scriptPubKey.chunks[0] - 80, //see OP_2-OP_16
    l = pubkeys.length,
    originalScriptBuf = this.tx.ins[input.i].s;

  var scriptSig = new Script(originalScriptBuf);
  var signaturesAdded = 0;

  for (var j = 0; j < l && scriptSig.countSignatures() < nreq; j++) {
    var wk = this._findWalletKey(walletKeyMap, {
      pubKeyBuf: pubkeys[j]
    });
    if (!wk) continue;

    var newScriptSig = this._updateMultiSig(j, wk, scriptSig, txSigHash, pubkeys);
    if (newScriptSig) {
      scriptSig = newScriptSig;
      signaturesAdded++;
    }
  }

  var ret = {
    inputFullySigned: scriptSig.countSignatures() === nreq,
    signaturesAdded: signaturesAdded,
    script: scriptSig.getBuffer(),
  };
  return ret;
};

var fnToSign = {};
TransactionBuilder.prototype._scriptIsAppended = function(script, scriptToAddBuf) {
  var len = script.chunks.length;

  if (script.chunks[len - 1] === undefined)
    return false;
  if (typeof script.chunks[len - 1] === 'number')
    return false;
  if (buffertools.compare(script.chunks[len - 1], scriptToAddBuf) !== 0)
    return false;

  return true;
};

TransactionBuilder.prototype._addScript = function(scriptBuf, scriptToAddBuf) {
  var s = new Script(scriptBuf);

  if (!this._scriptIsAppended(s, scriptToAddBuf)) {
    s.chunks.push(scriptToAddBuf);
    s.updateBuffer();
  }
  return s.getBuffer();
};

TransactionBuilder.prototype._getInputForP2sh = function(script, index) {
  var scriptType = script.classify();
  /* pubKeyHash is needed for TX_PUBKEYHASH and TX_PUBKEY to retrieve the keys. */
  var pubKeyHash;
  switch (scriptType) {
    case Script.TX_PUBKEYHASH:
      pubKeyHash = script.captureOne();
      break;
    case Script.TX_PUBKEY:
      var chunk = script.captureOne();
      pubKeyHash = util.sha256ripe160(chunk);
  }

  return {
    i: index,
    pubKeyHash: pubKeyHash,
    scriptPubKey: script,
    scriptType: scriptType,
    isP2sh: true,
  };
};

TransactionBuilder.prototype._p2shInput = function(input) {
  if (!this.hashToScriptMap)
    throw new Error('hashToScriptMap not set');

  var scriptHex = this.hashToScriptMap[input.address];
  if (!scriptHex) return;

  var scriptBuf = new Buffer(scriptHex, 'hex');
  var script = new Script(scriptBuf);
  var scriptType = script.classify();

  if (!fnToSign[scriptType] || scriptType === Script.TX_SCRIPTHASH)
    throw new Error('dont know how to sign p2sh script type:' + script.getRawOutType());

  return {
    input: this._getInputForP2sh(script, input.i),
    txSigHash: this.tx.hashForSignature(script, input.i, this.signhash),
    scriptType: script.classify(),
    scriptBuf: scriptBuf,
  };
};

TransactionBuilder.prototype._signScriptHash = function(walletKeyMap, input, txSigHash) {

  var p2sh = this._p2shInput(input);

  var ret = fnToSign[p2sh.scriptType].call(this, walletKeyMap, p2sh.input, p2sh.txSigHash);
  if (ret && ret.script && ret.signaturesAdded) {
    ret.script = this._addScript(ret.script, p2sh.scriptBuf);
  }
  return ret;
};

fnToSign[Script.TX_PUBKEYHASH] = TransactionBuilder.prototype._signPubKeyHash;
fnToSign[Script.TX_PUBKEY] = TransactionBuilder.prototype._signPubKey;
fnToSign[Script.TX_MULTISIG] = TransactionBuilder.prototype._signMultiSig;
fnToSign[Script.TX_SCRIPTHASH] = TransactionBuilder.prototype._signScriptHash;

// sign
// ----
// Signs a transaction. 
// `keys`: an array of strings representing private keys to sign the 
// transaction in WIF private key format OR bitcore's `WalletKey` objects
//
// If multiple keys are given, each will be tested against the transaction's 
// scriptPubKeys. Only the valid private keys will be used to sign.
// This method is fully compatible with *multisig* transactions.
//
// `.isFullySigned` can be queried to check is the transactions have all the needed
// signatures.
//
//
TransactionBuilder.prototype.sign = function(keys) {
  if (!(keys instanceof Array))
    throw new Error('parameter should be an array');

  this._checkTx();
  var tx = this.tx,
    ins = tx.ins,
    l = ins.length,
    walletKeyMap = TransactionBuilder._mapKeys(keys);


  for (var i = 0; i < l; i++) {
    var input = this.inputMap[i];

    var txSigHash = this.tx.hashForSignature(
      input.scriptPubKey, i, this.signhash);

    var ret = fnToSign[input.scriptType].call(this, walletKeyMap, input, txSigHash);
    if (ret && ret.script) {
      this.vanilla.scriptSig[i] = ret.script.toString('hex');

      tx.ins[i].s = ret.script;
      if (ret.inputFullySigned) this.inputsSigned++;
    }
  }
  return this;
};

// setHashToScriptMap
// ------------------
// Needed for setup Address to Script maps
// for p2sh transactions. See `.infoForP2sh`
// for generate the input for this call.
//
TransactionBuilder.prototype.setHashToScriptMap = function(hashToScriptMap) {
  this.vanilla.hashToScriptMap = JSON.stringify(hashToScriptMap);

  this.hashToScriptMap = hashToScriptMap;
  return this;
};


// isFullySigned
// -------------
// Checks if the transaction have all the necesary signatures.
//
TransactionBuilder.prototype.isFullySigned = function() {
  return this.inputsSigned === this.tx.ins.length;
};

TransactionBuilder.prototype.build = function() {
  this._checkTx();
  return this.tx;
};

// toObj
// -----
// Returns a plain Javascript object that contains
// the full status of the TransactionBuilder instance,
// suitable for serialization, storage and transmition.
// See `.fromObj`
//
TransactionBuilder.prototype.toObj = function() {

  var ret = {
    version: TOOBJ_VERSION,
    outs: JSON.parse(this.vanilla.outs),
    utxos: JSON.parse(this.vanilla.utxos),
    opts: JSON.parse(this.vanilla.opts),
    scriptSig: this.vanilla.scriptSig,
  };
  if (this.vanilla.hashToScriptMap)
    ret.hashToScriptMap = JSON.parse(this.vanilla.hashToScriptMap);

  return ret;
};

TransactionBuilder.prototype._setScriptSig = function(inScriptSig) {
  this.vanilla.scriptSig = inScriptSig;

  for (var i in inScriptSig) {
    this.tx.ins[i].s = new Buffer(inScriptSig[i], 'hex');
    var scriptSig = new Script(this.tx.ins[i].s);
    if (scriptSig.finishedMultiSig() !== false)
      this.inputsSigned++;
  }
};

// fromObj
// -------
// Returns a TransactionBuilder instance given
// a plain Javascript object created previously 
// with `.toObj`. See `.toObj`.

TransactionBuilder.fromObj = function(data) {

  if (data.version !== TOOBJ_VERSION)
    throw new Error('Incompatible version at TransactionBuilder fromObj');

  var b = new TransactionBuilder(data.opts);
  if (data.utxos) {
    b.setUnspent(data.utxos);

    if (data.hashToScriptMap)
      b.setHashToScriptMap(data.hashToScriptMap);

    if (data.outs) {
      b.setOutputs(data.outs);

      if (data.scriptSig) {
        b._setScriptSig(data.scriptSig);
      }
    }
  }
  return b;
};


TransactionBuilder.prototype._checkMergeability = function(b) {

  var toCompare = ['opts', 'hashToScriptMap', 'outs', 'uxtos'];
  for (var i in toCompare) {
    var k = toCompare[i];
    if (JSON.stringify(this.vanilla[k]) !== JSON.stringify(b.vanilla[k]))
      throw new Error('cannot merge: incompatible builders:' + k)
  }
};

// TODO this could be on Script class
TransactionBuilder.prototype._mergeInputSigP2sh = function(input, s0, s1) {
  var p2sh = this._p2shInput(input);
  var redeemScript = new Script(p2sh.scriptBuf);
  var pubkeys = redeemScript.capture();

  // Look for differences
  var s0keys = {};
  var l = pubkeys.length;
  for (var j = 0; j < l; j++) {
    if (this._chunkSignedWithKey(s0, p2sh.txSigHash, pubkeys[j]))
      s0keys[pubkeys[j].toString('hex')] = 1;
  }

  var diff = [];
  for (var j = 0; j < l; j++) {
    var chunk = this._chunkSignedWithKey(s1, p2sh.txSigHash, pubkeys[j]);
    var pubHex = pubkeys[j].toString('hex');
    if (chunk && !s0keys[pubHex]) {
      diff.push({
        prio: j,
        chunk: chunk,
        pubHex: pubHex,
      });
    }
  }

  // Add signatures
  for (var j in diff) {
    var newSig = diff[j];
    var order = this._getNewSignatureOrder(newSig.prio, s0, p2sh.txSigHash, pubkeys);
    s0.chunks.splice(order + 1, 0, newSig.chunk);
  }
  s0.updateBuffer();
  return s0.getBuffer();
};


// TODO: move this to script
TransactionBuilder.prototype._getSighashType = function(sig) {
  return sig[sig.length - 1];
};


TransactionBuilder.prototype._checkSignHash = function(s1) {
  var l = s1.chunks.length - 1;

  for (var i = 0; i < l; i++) {

    if (i == 0 && s1.chunks[i] === 0)
      continue;

    if (this._getSighashType(s1.chunks[i]) !== this.signhash)
      throw new Error('signhash type mismatch at merge p2sh');
  }
};



// TODO this could be on Script class
TransactionBuilder.prototype._mergeInputSig = function(index, s0buf, s1buf) {
  if (buffertools.compare(s0buf, s1buf) === 0)
    return s0buf;

  var s0 = new Script(s0buf);
  var s1 = new Script(s1buf);
  var l0 = s0.chunks.length;
  var l1 = s1.chunks.length;
  var s0map = {};

  if (l0 && l1 && ((l0 < 2 && l1 > 2) || (l1 < 2 && l0 > 2)))
    throw new Error('TX sig types mismatch in merge');

  if ((!l0 && !l1) || (l0 && !l1))
    return s0buf;

  this._checkSignHash(s1);

  if ((!l0 && l1))
    return s1buf;

  // Get the pubkeys
  var input = this.inputMap[index];
  var type = input.scriptPubKey.classify();

  //p2pubkey or p2pubkeyhash
  if (type === Script.TX_PUBKEYHASH || type === Script.TX_PUBKEY) {
    var s = new Script(s1buf);
    log.debug('Merging two signed inputs type:' +
      input.scriptPubKey.getRawOutType() + '. Signatures differs. Using the first version.');
    return s0buf;
  } else if (type !== Script.TX_SCRIPTHASH) {
    // No support for normal multisig or strange txs.
    throw new Error('Script type:' + input.scriptPubKey.getRawOutType() + 'not supported at #merge');
  }

  return this._mergeInputSigP2sh(input, s0, s1);
};

// TODO this could be on Transaction class
TransactionBuilder.prototype._mergeTx = function(tx) {
  var v0 = this.tx;
  var v1 = tx;

  var l = v0.ins.length;
  if (l !== v1.ins.length)
    throw new Error('TX in length mismatch in merge');

  this.inputsSigned = 0;
  for (var i = 0; i < l; i++) {
    var i0 = v0.ins[i];
    var i1 = v1.ins[i];

    if (i0.q !== i1.q)
      throw new Error('TX sequence ins mismatch in merge. Input:', i);

    if (buffertools.compare(i0.o, i1.o) !== 0)
      throw new Error('TX .o in mismatch in merge. Input:', i);

    i0.s = this._mergeInputSig(i, i0.s, i1.s);
    this.vanilla.scriptSig[i] = i0.s.toString('hex');

    if (v0.isInputComplete(i)) this.inputsSigned++;
  }
};

// clone
// -----
// Clone current TransactionBuilder, regenerate derived fields.
//
TransactionBuilder.prototype.clone = function() {
  return new TransactionBuilder.fromObj(this.toObj());
};

// merge
// -----
// Merge to TransactionBuilder objects, merging inputs signatures.
// This function supports multisig p2sh inputs.

TransactionBuilder.prototype.merge = function(inB) {
  // 
  var b = inB.clone();

  this._checkMergeability(b);

  // Does this tX have any signature already?
  if (this.tx || b.tx) {
    if (this.tx.getNormalizedHash().toString('hex') !== b.tx.getNormalizedHash().toString('hex'))
      throw new Error('mismatch at TransactionBuilder NTXID');

    this._mergeTx(b.tx);
  }
};

module.exports = TransactionBuilder;
