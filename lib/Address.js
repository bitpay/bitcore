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

/**
 * Creates a new Address from a public Key and network
 *
 * @param {string} pubKey The public key associated with the address
 * @param {string} network The blockchain. eg. 'testnet', 'livenet'
 * @returns {Address} The new Address object
 */
Address.fromPubKey = function(pubKey, network) {
  if (!network)
    network = 'livenet';

  if (pubKey.length != 33 && pubKey.length != 65)
    throw new Error('Invalid public key');

  var version = networks[network].addressVersion;
  var hash = coinUtil.sha256ripe160(pubKey);

  return new Address(version, hash);
};

/**
 * Creates a new Address using p2sh m-of-n multisig
 *
 * @param mReq
 * @param {array<string>} pubKeys The public keys
 * @param {string} network The blockchain. eg. 'testnet', 'livenet'
 * @param {object} opts
 * @returns {Address} The new Address object
 */
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

/**
 * Creates a new Address from redeemScript
 *
 * @param {Script/string} script
 * @param {string} network The blockchain. eg. 'testnet', 'livenet'
 * @returns {Address} The new Address object
 */
Address.fromScript = function(script, network) {
  if (!network)
    network = 'livenet';

  if (typeof script === 'string') {
    script = new Script(new Buffer(script,'hex'));
  }

  var version = networks[network].P2SHVersion;
  var buf = script.getBuffer();
  var hash = coinUtil.sha256ripe160(buf);

  return new Address(version, hash);
};

//extract and address from scriptPubKey
Address.fromScriptPubKey = function(scriptPubKey, network) {

  if (typeof scriptPubKey === 'string') {
    scriptPubKey = new Script(new Buffer(scriptPubKey,'hex'));
  }

  if (!network)
    network = 'livenet';

  var ret=[], version;
  var payload = scriptPubKey.capture();

  if (payload)  {
    var txType = scriptPubKey.classify();
    switch (txType) {
      case Script.TX_PUBKEY:
        payload[0] = coinUtil.sha256ripe160(payload[0]);
        version = networks[network].addressVersion;
        break;
      case Script.TX_PUBKEYHASH:
        version = networks[network].addressVersion;
        break;
      case Script.TX_MULTISIG:
        version = networks[network].addressVersion;
        for(var i in payload)
          payload[i] = coinUtil.sha256ripe160(payload[i]);
        break;
      case Script.TX_SCRIPTHASH:
        version = networks[network].P2SHVersion;
        break;
    }
    for(var i in payload)
      ret.push(new Address(version,payload[i]));
  }
  return ret;
};

/**
 * Validates the Address object. Throws an error if invalid
 *
 */
Address.prototype.validate = function() {
  this.doAsBinary(function() {
    Address.super(this, 'validate', arguments);
    if(this.data.length !== 21) throw new Error('invalid data length');
  });
  if (typeof this.network() === 'undefined') throw new Error('invalid network');
};

/**
 * Checks for validity of the Address
 *
 * @returns {boolean}
 */
Address.prototype.isValid = function() {
  var answer = Address.super(this, 'isValid', arguments);
  return answer;
};

/**
 * Returns an object that indicates which blockchain the Address belongs to
 *
 * @returns {object} network object. (similar to the ones in networks.js)
 */
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

/**
 *
 *
 * @returns {boolean}
 */
Address.prototype.isScript = function() {
  return this.isValid() && this.version() === this.network().P2SHVersion;
};


module.exports = require('soop')(Address);
