// Address
// =======
//
// Handles a bitcoin address
//
//
// Synopsis
// --------
// ```
//     var address = new Address('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
//     if (address.isValid()) {
//        //...
//     }
//
//     // Also an address can be created from 
//     // public keys
//     var address = Address.fromPubKey(myPubkey, netname);
//
//     // Or from a ScriptPubKey (from a transaction output)
//     var address  = Address.fromScriptPubKey(scriptPubKey, netname);
//
//     // Multisig address p2sh handling
//     var myPukeys = [pubkey0, pubkey1, pubkey2]; 
//     var p2shAddress = Address.fromPubKeys(2, myPubkeys, netname);
//     if (p2shAddress.isScript()) { //true 
//     }
//
//
// ```


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

// create a pubKeyHash address
Address.fromPubKey = function(pubKey, netname) {
  if (!netname) {
    throw new Error('network missing');
  }

  if (pubKey.length !== 33 && pubKey.length !== 65)
    throw new Error('Invalid public key');

  var version = networks[netname].addressVersion;
  var hash = coinUtil.sha256ripe160(pubKey);

  return new Address(version, hash);
};

// create an address from a Key object
Address.fromKey = function(key, netname) {
  return Address.fromPubKey(key.public, netname);
};

// create a p2sh m-of-n multisig address
Address.fromPubKeys = function(mReq, pubKeys, netname, opts) {
  if (!netname) {
    throw new Error('network missing');
  }

  for (var i in pubKeys) {
    var pubKey = pubKeys[i];
    if (pubKey.length != 33 && pubKey.length != 65)
      throw new Error('Invalid public key');
  }

  var script = Script.createMultisig(mReq, pubKeys, opts);
  return Address.fromScript(script, netname);
};

//create a p2sh address from redeemScript
Address.fromScript = function(script, netname) {
  if (!netname) {
    throw new Error('network missing');
  }

  if (typeof script === 'string') {
    script = new Script(new Buffer(script,'hex'));
  }

  var version = networks[netname].P2SHVersion;
  var buf = script.getBuffer();
  var hash = coinUtil.sha256ripe160(buf);

  return new Address(version, hash);
};

//extract and address from scriptPubKey
Address.fromScriptPubKey = function(scriptPubKey, netname) {

  if (typeof scriptPubKey === 'string') {
    scriptPubKey = new Script(new Buffer(scriptPubKey,'hex'));
  }

  if (!netname) {
    throw new Error('network missing');
  }

  var ret=[], version;
  var payload = scriptPubKey.capture();

  if (payload)  {
    var txType = scriptPubKey.classify();
    switch (txType) {
      case Script.TX_PUBKEY:
        payload[0] = coinUtil.sha256ripe160(payload[0]);
        version = networks[netname].addressVersion;
        break;
      case Script.TX_PUBKEYHASH:
        version = networks[netname].addressVersion;
        break;
      case Script.TX_MULTISIG:
        version = networks[netname].addressVersion;
        for(var i in payload)
          payload[i] = coinUtil.sha256ripe160(payload[i]);
        break;
      case Script.TX_SCRIPTHASH:
        version = networks[netname].P2SHVersion;
        break;
    }
    for(var i in payload)
      ret.push(new Address(version,payload[i]));
  }
  return ret;
};

// validates the address
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

// returns the network information (as described on networks.js) of the address
Address.prototype.network = function() {
  if(this.networkHint) {
    return networks[this.networkHint];
  }
  var version = this.version();
  var answer;
  for(var netname in networks) {
    var network = networks[netname];
    if (version === network.addressVersion || version === network.P2SHVersion) {
      answer = network;
      break;
    }
  }
  return answer;
};

// returns possible netnames of this address, normal address has only one but p2sh address may be different networks
Address.prototype.possibleNetworks = function() {
  var version = this.version();
  var networkChoices = [];
  //for(var netname in networks) {
  networks.supportedNetnames.forEach(function(netname) {
    var network = networks[netname];
    if (version === network.addressVersion ||
	version === network.P2SHVersion) {
      networkChoices.push(network);
    }
  });
  return networkChoices;
};

// returns true is the address is a pay-to-script (P2SH) address type.
Address.prototype.isScript = function() {
  return this.isValid() && this.version() === this.network().P2SHVersion;
};


module.exports = require('soop')(Address);
