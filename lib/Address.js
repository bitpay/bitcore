'use strict';
var imports = require('soop').imports();
var coinUtil = imports.coinUtil || require('../util');
var parent = imports.parent || require('../util/VersionedData');
var networks = imports.networks || require('../networks');
var Script = imports.Script || require('./Script');

function Address() {
  Address.super(this, arguments);
}

Address.parent = parent;
parent.applyEncodingsTo(Address);

//create a pubKeyHash address
Address.fromPubKey = function(pubKey, network) {
  if (!network)
    network = 'livenet';

  if (pubKey.length != 33 && pubKey.length != 65)
    throw new Error('Invalid public key');

  var version = networks[network].addressVersion;
  var hash = coinUtil.sha256ripe160(pubKey);

  return new Address(version, hash);
};

//create a p2sh m-of-n multisig address
Address.fromPubKeys = function(mReq, pubKeys, network, opts) {
  if (!network)
    network = 'livenet';

  for (var i in pubKeys) {
    var pubKey = pubKeys[i];
    if (pubKey.length != 33 && pubKey.length != 65)
      throw new Error('Invalid public key');
  }

  var script = Script.createMultisig(mReq, pubKeys, opts);

  return Address.fromScript(script, network);
};

//create a p2sh address from redeemScript
Address.fromScript = function(script, network) {
  if (!network)
    network = 'livenet';

  var version = networks[network].P2SHVersion;
  var buf = script.getBuffer();
  var hash = coinUtil.sha256ripe160(buf);

  return new Address(version, hash);
};

Address.prototype.validate = function() {
  this.doAsBinary(function() {
    Address.super(this, 'validate', arguments);
    if(this.data.length !== 21) throw new Error('invalid data length');
  });
  if (typeof this.network() === 'undefined') throw new Error('invalid network');
};

Address.prototype.isValid = function() {
  var answer = Address.super(this, 'isValid', arguments);
  return answer;
};

Address.prototype.network = function() {
  var version = this.version();

  var livenet = networks.livenet;
  var testnet = networks.testnet;

  var answer;
  if (version === livenet.addressVersion || version === livenet.P2SHVersion)
    answer = livenet;
  else if (version === testnet.addressVersion || version === testnet.P2SHVersion)
    answer = testnet;

  return answer;
};

Address.prototype.isScript = function() {
  return this.isValid() && this.version() === this.network().P2SHVersion;
};


module.exports = require('soop')(Address);
