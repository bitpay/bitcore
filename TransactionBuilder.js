
/*
    var tx = TransactionBuilder.init(opts)
      .setUnspent(utxos)
      .setOutputs(outs)
      .sign(keys)
      .build();


    var builder = TransactionBuilder.init(opts)
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
 *      remainderAddress: null,
 *      fee: 0.001,
 *      lockTime: null,
 *      spendUnconfirmed: false,
 *      signhash: SIGHASH_ALL
 *    }
 *  Amounts are in BTC. instead of fee and amount; feeSat and amountSat can be given, 
 *  repectively, to provide amounts in satoshis.
 *
 *  If no remainderAddress is given, and there are remainder coins, the
 *  first IN address will be used to return the coins. (TODO: is this is reasonable?)
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

function TransactionBuilder() {
  this.txobj = {};
}

/*
 * _scriptForAddress
 *
 *  Returns a scriptPubKey for the given address type
 */

TransactionBuilder._scriptForAddress = function(addressString) {

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

TransactionBuilder.prototype.setUnspent = function(utxos) {
  this.utxos = utxos;
  return this;
};

TransactionBuilder.prototype._setInputMap = function() {
  var inputMap = [];

  var l = this.selectedUtxos.length;
  for (var i = 0; i < l; i++) {
    var s = this.selectedUtxos[i];

    inputMap.push({
      address: s.address,
      scriptPubKey: s.scriptPubKey
    });
  }
  this.inputMap = inputMap;
  return this;
};

TransactionBuilder.prototype.getSelectedUnspent = function(neededAmountSat) {
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
    throw new Error('no enough unspent to fulfill totalNeededAmount');

  this.selectedUtxos = sel;
  this._setInputMap();
  return this;
};


TransactionBuilder.prototype.init = function(opts) {
  var opts              = opts || {};
  this.txobj            = {};
  this.txobj.version    = 1;
  this.txobj.lock_time  = opts.lockTime || 0;
  this.txobj.ins  = [];
  this.txobj.outs = [];

  this.spendUnconfirmed = opts.spendUnconfirmed || false;

  if (opts.fee || opts.feeSat) {
    this.givenFeeSat = opts.fee ? opts.fee * util.COIN : opts.feeSat;
  }
  this.remainderAddress = opts.remainderAddress;
  this.signhash = opts.signhash || Transaction.SIGHASH_ALL;

  this.tx         = {};
  this.inputsSigned= 0;

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
    var remainderAddress = this.remainderAddress || this.selectedUtxos[0].address;
    var value = util.bigIntToValue(remainderSat);
    var script = TransactionBuilder._scriptForAddress(remainderAddress);
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
    var script = TransactionBuilder._scriptForAddress(outs[i].address);
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

TransactionBuilder._checkSupportedScriptType = function (s) {
  if (s.classify() !== Script.TX_PUBKEYHASH) {
    throw new Error('scriptSig type:' + s.getRawOutType() +
                    ' not supported yet');
  }
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


TransactionBuilder.prototype.sign = function(keys) {
  this._checkTx();

  var tx  = this.tx,
      ins = tx.ins,
      l   = ins.length;

  var walletKeyMap = TransactionBuilder._mapKeys(keys);

  for (var i = 0; i < l; i++) {
    var im = this.inputMap[i];
    if (typeof im === 'undefined') continue;
    var wk        = walletKeyMap[im.address];
    if (!wk) continue;

    var scriptBuf = new Buffer(im.scriptPubKey, 'hex');

//TODO: support p2sh
    var s = new Script(scriptBuf);
    TransactionBuilder._checkSupportedScriptType(s);

    var txSigHash = this.tx.hashForSignature(s, i, this.signhash);
    var sigRaw    = TransactionBuilder._signHashAndVerify(wk, txSigHash);
    var sigType   = new Buffer(1);
    sigType[0]    = this.signhash;
    var sig       = Buffer.concat([sigRaw, sigType]);

    var scriptSig = new Script();
    scriptSig.chunks.push(sig);
    scriptSig.chunks.push(wk.privKey.public);
    scriptSig.updateBuffer();
    tx.ins[i].s = scriptSig.getBuffer();
    this.inputsSigned++;
  }
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

