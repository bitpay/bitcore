
/*
    var tx = (new TransactionBuilder(opts))
      .setUnspent(utxos)
      .setOutputs(outs)
      .sign(keys)
      .build();


    var builder = (new TransactionBuilder(opts))
      .setUnspent(spent)
      .setOutputs(outs);

    // Uncomplete tx (no signed or partially signed)
    var tx = builder.build();

    ..later..

    builder.sign(keys);
    while ( builder.isFullySigned() ) {

      ... get new keys ...

      builder.sign(keys);
    }

    var tx = builder.build();
    broadcast(tx.serialize());

    To get selected unspent outputs:
    var selectedUnspent = builder.getSelectedUnspent();


   @unspent 
 *    unspent outputs array (UTXO), using the following format:
 *    [{
 *       address: "mqSjTad2TKbPcKQ3Jq4kgCkKatyN44UMgZ",
 *       hash: "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
 *       scriptPubKey: "76a9146ce4e1163eb18939b1440c42844d5f0261c0338288ac",
 *       vout: 1,
 *       amount: 0.01,                
 *       confirmations: 3
 *       }, ...
 *    ]
 * This is compatible con insight's utxo API. 
 * That amount is in BTCs (as returned in insight and bitcoind).
 * amountSat (instead of amount) can be given to provide amount in satochis.
 *
 *  @outs
 *    an array of [{
 *      address: xx, 
 *      amount:0.001
 *     },...]
 *
 *  @keys
 *     an array of strings representing private keys to sign the 
 *    transaction in WIF private key format OR WalletKey objects
 *
 *  @opts
 *    { 
 *      remainderOut: null,
 *      fee: 0.001,
 *      lockTime: null,
 *      spendUnconfirmed: false,
 *      signhash: SIGHASH_ALL
 *    }
 *  Amounts are in BTC. instead of fee and amount; feeSat and amountSat can be given, 
 *  repectively, to provide amounts in satoshis.
 *
 *  If no remainderOut is given, and there are remainder coins, the
 *  first IN out will be used to return the coins. remainderOut has the form:
 *    remainderOut = { address: 1xxxxx}
*    or
 *    remainderOut = { pubkeys: ['hex1','hex2',...} for multisig
 *
 *
 */


'use strict';

var imports = require('soop').imports();
var Address = imports.Address || require('./Address');
var Script = imports.Script || require('./Script');
var util = imports.util || require('./util/util');
var bignum = imports.bignum || require('bignum');
var buffertools = imports.buffertools || require('buffertools');
var networks = imports.networks || require('./networks');
var WalletKey = imports.WalletKey || require('./WalletKey');
var PrivateKey = imports.PrivateKey || require('./PrivateKey');

var Transaction = imports.Transaction || require('./Transaction');
var FEE_PER_1000B_SAT = parseInt(0.0001 * util.COIN);

function TransactionBuilder(opts) {
  opts                  = opts || {};
  this.txobj            = {};
  this.txobj.version    = 1;
  this.txobj.lock_time  = opts.lockTime || 0;
  this.txobj.ins  = [];
  this.txobj.outs = [];

  this.spendUnconfirmed = opts.spendUnconfirmed || false;

  if (opts.fee || opts.feeSat) {
    this.givenFeeSat = opts.fee ? opts.fee * util.COIN : opts.feeSat;
  }
  this.remainderOut = opts.remainderOut;
  this.signhash = opts.signhash || Transaction.SIGHASH_ALL;

  this.tx         = {};
  this.inputsSigned= 0;

  return this;
}

/*
 * scriptForAddress
 *
 *  Returns a scriptPubKey for the given address type
 */

TransactionBuilder.scriptForAddress = function(addressString) {

  var livenet = networks.livenet;
  var testnet = networks.testnet;
  var address = new Address(addressString);

  var version = address.version();
  var script;
  if (version === livenet.addressPubkey || version === testnet.addressPubkey)
    script = Script.createPubKeyHashOut(address.payload());
  else if (version === livenet.addressScript || version === testnet.addressScript)
    script = Script.createP2SH(address.payload());
  else
    throw new Error('invalid output address');

  return script;
};


TransactionBuilder._scriptForPubkeys = function(out) {

  var l = out.pubkeys.length;
  var pubKeyBuf=[];

  for (var i=0; i<l; i++) {
    pubKeyBuf.push(new Buffer(out.pubkeys[i],'hex'));
  }

  return Script.createMultisig(out.nreq, pubKeyBuf);
};

TransactionBuilder._scriptForOut = function(out) {
  var ret;
  if (out.address)
    ret = this.scriptForAddress(out.address);
  else if (out.pubkeys || out.nreq || out.nreq > 1)
    ret = this._scriptForPubkeys(out);
  else
    throw new Error('unknown out type');

  return ret;
};


TransactionBuilder.infoForP2sh = function(opts, networkName) {
  var script = this._scriptForOut(opts);
  var hash   = util.sha256ripe160(script.getBuffer());

  var version = networkName === 'testnet' ?
    networks.testnet.addressScript : networks.livenet.addressScript;

  var addr = new Address(version, hash);
  var addrStr = addr.as('base58');
  return {
    script: script,
    scriptBufHex: script.getBuffer().toString('hex'),
    hash: hash,
    address: addrStr,
  };
};

TransactionBuilder.prototype.setUnspent = function(utxos) {
  this.utxos = utxos;
  return this;
};

TransactionBuilder.prototype._setInputMap = function() {
  var inputMap = [];

  var l = this.selectedUtxos.length;
  for (var i = 0; i < l; i++) {
    var utxo          = this.selectedUtxos[i];
    var scriptBuf     = new Buffer(utxo.scriptPubKey, 'hex');
    var scriptPubKey  = new Script(scriptBuf);
    var scriptType    = scriptPubKey.classify();

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

  var sel            = [],
    totalSat         = bignum(0),
    fulfill          = false,
    maxConfirmations = null,
    l                = this.utxos.length;

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
    throw new Error('no enough unspent to fulfill totalNeededAmount [SAT]:' +
                    neededAmountSat);

  this.selectedUtxos = sel;
  this._setInputMap();
  return this;
};

TransactionBuilder.prototype._setInputs = function() {
  var ins = this.selectedUtxos;
  var l = ins.length;
  var valueInSat = bignum(0);

  this.txobj.ins=[];
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
    this.txobj.ins.push(txin);
  }
  this.valueInSat = valueInSat;
  return this;
};

TransactionBuilder.prototype._setFee = function(feeSat) {
  if ( typeof this.valueOutSat === 'undefined')
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

TransactionBuilder.prototype._setRemainder = function(remainderIndex) {

  if ( typeof this.valueInSat === 'undefined' ||
      typeof this.valueOutSat === 'undefined')
    throw new Error('valueInSat / valueOutSat undefined');

  // add remainder (without modifying outs[])
  var remainderSat = this.valueInSat.sub(this.valueOutSat).sub(this.feeSat);
  var l =this.txobj.outs.length;
  this.remainderSat = bignum(0);

  //remove old remainder?
  if (l > remainderIndex) {
    this.txobj.outs.pop();
  }

  if (remainderSat.cmp(0) > 0) {
    var remainderOut = this.remainderOut || this.selectedUtxos[0];
    var value = util.bigIntToValue(remainderSat);
    var script = TransactionBuilder._scriptForOut(remainderOut);
    var txout = {
      v: value,
      s: script.getBuffer(),
    };
    this.txobj.outs.push(txout);
    this.remainderSat = remainderSat;
  }

  return this;
};

TransactionBuilder.prototype._setFeeAndRemainder = function() {

  //starting size estimation
  var size = 500, maxSizeK, remainderIndex = this.txobj.outs.length;

  do {
    // based on https://en.bitcoin.it/wiki/Transaction_fees
    maxSizeK = parseInt(size / 1000) + 1;

    var feeSat = this.givenFeeSat ?
      this.givenFeeSat : maxSizeK * FEE_PER_1000B_SAT;

    var neededAmountSat = this.valueOutSat.add(feeSat);

    this._selectUnspent(neededAmountSat)
        ._setInputs()
        ._setFee(feeSat)
        ._setRemainder(remainderIndex);

        
    size = new Transaction(this.txobj).getSize();
  } while (size > (maxSizeK + 1) * 1000);
  return this;
};

TransactionBuilder.prototype.setOutputs = function(outs) {
  var valueOutSat = bignum(0);

  this.txobj.outs = [];
  var l =outs.length;

  for (var i = 0; i < l; i++) {
    var amountSat = outs[i].amountSat || util.parseValue(outs[i].amount);
    var value = util.bigIntToValue(amountSat);
    var script = TransactionBuilder._scriptForOut(outs[i]);
    var txout = {
      v: value,
      s: script.getBuffer(),
    };
    this.txobj.outs.push(txout);

    var sat = outs[i].amountSat || util.parseValue(outs[i].amount);
    valueOutSat = valueOutSat.add(sat);
  }

  this.valueOutSat = valueOutSat;

  this._setFeeAndRemainder();

  this.tx = new Transaction(this.txobj);
  return this;
};

TransactionBuilder._mapKeys = function(keys) {
  //prepare keys
  var walletKeyMap = {};
  var l = keys.length;
  var wk;
  for (var i = 0; i < l; i++) {
    var k = keys[i];

    if (typeof k === 'string') {
      var pk = new PrivateKey(k);
      wk = new WalletKey({ network: pk.network() });
      wk.fromObj({ priv: k });
    }
    else if (k instanceof WalletKey) {
      wk = k;
    }
    else {
      throw new Error('argument must be an array of strings (WIF format) or WalletKey objects');
    }
    walletKeyMap[wk.storeObj().addr] = wk;
  }
  return walletKeyMap;
};

TransactionBuilder._signHashAndVerify = function(wk, txSigHash) {
  var triesLeft = 10, sigRaw;

  do {
    sigRaw = wk.privKey.signSync(txSigHash);
  } while (wk.privKey.verifySignatureSync(txSigHash, sigRaw) === false &&
           triesLeft--);

  if (triesLeft<0)
    throw new Error('could not sign input: verification failed');

  return sigRaw;
};

TransactionBuilder.prototype._checkTx = function() {
  if (! this.tx || !this.tx.ins.length || !this.tx.outs.length)
    throw new Error('tx is not defined');
};


TransactionBuilder.prototype._multiFindKey = function(walletKeyMap,pubKeyHash) {
  var wk;
  [ networks.livenet, networks.testnet].forEach(function(n) {
    [ n.addressPubkey, n.addressScript].forEach(function(v) {
      var a = new Address(v,pubKeyHash);
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
    wk        = walletKeyMap[input.address];
  }
  else if (input.pubKeyHash) {
    wk             = this._multiFindKey(walletKeyMap, input.pubKeyHash);
  }
  else if (input.pubKeyBuf) {
    var pubKeyHash = util.sha256ripe160(input.pubKeyBuf);
    wk             = this._multiFindKey(walletKeyMap, pubKeyHash);
  } else {
    throw new Error('no infomation at input to find keys');
  }
  return wk;
};

TransactionBuilder.prototype._signPubKey = function(walletKeyMap, input, txSigHash) {
  if (this.tx.ins[input.i].s.length > 0) return {};

  var wk        = this._findWalletKey(walletKeyMap, input);
  if (!wk) return;

  var sigRaw    = TransactionBuilder._signHashAndVerify(wk, txSigHash);
  var sigType   = new Buffer(1);
  sigType[0]    = this.signhash;
  var sig       = Buffer.concat([sigRaw, sigType]);

  var scriptSig = new Script();
  scriptSig.chunks.push(sig);
  scriptSig.updateBuffer();
  return {isFullySigned: true, signaturesAdded: true, script: scriptSig.getBuffer()};
};

TransactionBuilder.prototype._signPubKeyHash = function(walletKeyMap, input, txSigHash) {

  if (this.tx.ins[input.i].s.length > 0) return {};

  var wk        = this._findWalletKey(walletKeyMap, input);
  if (!wk) return;

  var sigRaw    = TransactionBuilder._signHashAndVerify(wk, txSigHash);
  var sigType   = new Buffer(1);
  sigType[0]    = this.signhash;
  var sig       = Buffer.concat([sigRaw, sigType]);

  var scriptSig = new Script();
  scriptSig.chunks.push(sig);
  scriptSig.chunks.push(wk.privKey.public);
  scriptSig.updateBuffer();
  return {isFullySigned: true, signaturesAdded: true, script: scriptSig.getBuffer()};
};

// FOR TESTING
// var _dumpChunks = function (scriptSig, label) {
//   console.log('## DUMP: ' + label + ' ##');
//   for(var i=0; i<scriptSig.chunks.length; i++) {
//     console.log('\tCHUNK ', i, scriptSig.chunks[i]); 
//   }
// };

TransactionBuilder.prototype._initMultiSig = function(scriptSig, nreq) {
  var wasUpdated = false;
  if (scriptSig.chunks.length < nreq + 1) {
    wasUpdated = true;
    scriptSig.writeN(0);
    while (scriptSig.chunks.length <= nreq)
      scriptSig.chunks.push(util.EMPTY_BUFFER);
  }
  return wasUpdated;
};


TransactionBuilder.prototype._isSignedWithKey = function(wk, scriptSig, txSigHash, nreq) {
  var ret=0;
  for(var i=1; i<=nreq; i++) {
    var chunk = scriptSig.chunks[i];
    if (chunk ===0 || chunk.length === 0) continue;

    var sigRaw = new Buffer(chunk.slice(0,chunk.length-1));
    if(wk.privKey.verifySignatureSync(txSigHash, sigRaw) === true) {
      ret=true;
    }
  }
  return ret;
};

TransactionBuilder.prototype._chunkIsEmpty = function(chunk) {
  return chunk === 0 ||  // when serializing and back, EMPTY_BUFFER becomes 0
    buffertools.compare(chunk, util.EMPTY_BUFFER) === 0;
};


TransactionBuilder.prototype._updateMultiSig = function(wk, scriptSig, txSigHash, nreq) {
  var wasUpdated = this._initMultiSig(scriptSig, nreq);

  if (this._isSignedWithKey(wk,scriptSig, txSigHash, nreq))
    return null;
  
  // Find an empty slot and sign
  for(var i=1; i<=nreq; i++) {
    var chunk = scriptSig.chunks[i];
    if (!this._chunkIsEmpty(chunk))
      continue;

    // Add signature
    var sigRaw  = TransactionBuilder._signHashAndVerify(wk, txSigHash);
    var sigType = new Buffer(1);
    sigType[0]  = this.signhash;
    var sig     = Buffer.concat([sigRaw, sigType]);
    scriptSig.chunks[i] = sig;
    scriptSig.updateBuffer();
    wasUpdated=true;
    break;
  }
  return wasUpdated ? scriptSig : null;
};


TransactionBuilder.prototype._signMultiSig = function(walletKeyMap, input, txSigHash) {
  var pubkeys = input.scriptPubKey.capture(),
    nreq    = input.scriptPubKey.chunks[0] - 80, //see OP_2-OP_16
    l = pubkeys.length,
    originalScriptBuf = this.tx.ins[input.i].s;

  var scriptSig = new Script (originalScriptBuf);
  var signaturesAdded = false;

  for(var j=0; j<l && scriptSig.countMissingSignatures(); j++) {
    var wk = this._findWalletKey(walletKeyMap, {pubKeyBuf: pubkeys[j]});
    if (!wk) continue;

    var newScriptSig = this._updateMultiSig(wk, scriptSig, txSigHash, nreq);
    if (newScriptSig) {
      scriptSig = newScriptSig;
      signaturesAdded = true;
    }
  }

  return {
    isFullySigned:  scriptSig.countMissingSignatures() === 0,
    signaturesAdded: signaturesAdded,
    script: scriptSig.getBuffer(),
  };
};
 
var fnToSign = {};

TransactionBuilder.prototype._scriptIsAppended = function(script, scriptToAddBuf) {
  var len = script.chunks.length;

  if (script.chunks[len-1] === undefined)
    return false;
  if (typeof script.chunks[len-1] === 'number')
    return false;
  if (buffertools.compare(script.chunks[len-1] , scriptToAddBuf) !==0 )
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
  // pubKeyHash is needed for TX_PUBKEYHASH and TX_PUBKEY to retrieve the keys.
  var pubKeyHash;
  switch(scriptType) {
    case Script.TX_PUBKEYHASH:
      pubKeyHash = script.captureOne();
      break;
    case Script.TX_PUBKEY:
      var chunk  = script.captureOne();
      pubKeyHash = util.sha256ripe160(chunk);
  }

  return {
    i: index,
    pubKeyHash: pubKeyHash,
    scriptPubKey: script,
    scriptType: scriptType,
  };
};


TransactionBuilder.prototype._signScriptHash = function(walletKeyMap, input, txSigHash) {
  var originalScriptBuf = this.tx.ins[input.i].s;

  if (!this.hashToScriptMap)
    throw new Error('hashToScriptMap not set');

  var scriptHex = this.hashToScriptMap[input.address];
  if (!scriptHex) return;

  var scriptBuf     = new Buffer(scriptHex,'hex');
  var script        = new Script(scriptBuf);
  var scriptType    = script.classify();

  if (!fnToSign[scriptType] || scriptType === Script.TX_SCRIPTHASH)
    throw new Error('dont know how to sign p2sh script type:'+ script.getRawOutType());

  var newInput      = this._getInputForP2sh(script, input.i);
  var newTxSigHash  = this.tx.hashForSignature( script, newInput.i, this.signhash);
  var ret           =  fnToSign[scriptType].call(this, walletKeyMap, newInput, newTxSigHash);

  if (ret && ret.script && ret.signaturesAdded) {
    ret.script = this._addScript(ret.script, scriptBuf);
  }
  return ret;
};

fnToSign[Script.TX_PUBKEYHASH] = TransactionBuilder.prototype._signPubKeyHash;
fnToSign[Script.TX_PUBKEY]     = TransactionBuilder.prototype._signPubKey;
fnToSign[Script.TX_MULTISIG]   = TransactionBuilder.prototype._signMultiSig;
fnToSign[Script.TX_SCRIPTHASH] = TransactionBuilder.prototype._signScriptHash;

TransactionBuilder.prototype.sign = function(keys) {
  this._checkTx();
  var tx  = this.tx,
      ins = tx.ins,
      l   = ins.length,
      walletKeyMap = TransactionBuilder._mapKeys(keys);



  for (var i = 0; i < l; i++) {
    var input = this.inputMap[i];

    var txSigHash = this.tx.hashForSignature(
      input.scriptPubKey, i, this.signhash);

    var ret = fnToSign[input.scriptType].call(this, walletKeyMap, input, txSigHash);
    if (ret && ret.script) {
      tx.ins[i].s = ret.script;
      if (ret.isFullySigned) this.inputsSigned++;
    }
  }
  return this;
};

// [ { address:scriptHex }]
TransactionBuilder.prototype.setHashToScriptMap = function(hashToScriptMap) {
  this.hashToScriptMap= hashToScriptMap;
  return this;
};


TransactionBuilder.prototype.isFullySigned = function() {
  return this.inputsSigned === this.tx.ins.length;
};

TransactionBuilder.prototype.build = function() {
  this._checkTx();
  return this.tx;
};

module.exports = require('soop')(TransactionBuilder);

