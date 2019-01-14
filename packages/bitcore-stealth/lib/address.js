'use strict';

var _ = require('lodash');

var bitcore = require('bitcore-lib-cash');

var Base58 = bitcore.encoding.Base58;
var Base58Check = bitcore.encoding.Base58Check;
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var preconditions = bitcore.util.preconditions;

var BN = bitcore.crypto.BN;
var Hash = bitcore.crypto.Hash;
var Point = bitcore.crypto.Point;

var PublicKey = bitcore.PublicKey;
var PrivateKey = bitcore.PrivateKey;
var Networks = bitcore.Networks;
var Transcation = bitcore.Transcation;

const Base32 = bitcore.util.base32;


function Address(scanKey, spendKeys, signatures) {
  if (!(this instanceof Address)) {
    return new Address(scanKey, spendKeys, signatures);
  }

  if (scanKey instanceof Address) {
    return scanKey;
  }

  var info = this._classifyArguments(scanKey, spendKeys, signatures);

  if (info.signatures != 1 && info.signatures > info.spendKeys.length) {
    throw new Error('Invalid number of required signatures');
  }

  Object.defineProperty(this, 'network', {
    configurable: false,
    value: info.network
  });

  Object.defineProperty(this, 'reuseScan', {
    configurable: false,
    value: !!info.options
  });

  Object.defineProperty(this, 'scanKey', {
    configurable: false,
    value: info.scanKey
  });

  Object.defineProperty(this, 'spendKeys', {
    configurable: false,
    value: info.spendKeys
  });

  Object.defineProperty(this, 'signatures', {
    configurable: false,
    value: info.signatures
  });

  Object.defineProperty(this, 'prefix', {
    configurable: false,
    value: info.prefix
  });

}

/**
 * Internal function used to split different kinds of arguments of the constructor
 */
Address.prototype._classifyArguments = function(scanKey, spendKeys, signatures) {
  preconditions.checkArgument(scanKey);

  // Parse address string
  var base32;
  try { 
    base32 = _.isString(scanKey) && Base32.decode(scanKey.toLowerCase());
  } catch (ex) {
//console.log('[address.js.84:ex:]',ex); //TODO
  };

  if (base32) {
    var convertedBits =  bitcore.util.convertBits(base32, 5, 8, true);
    return this._fromBuffer(new Buffer(convertedBits));
  }

  var scanKey;

  try {
    scanKey = new PrivateKey(scanKey).toPublicKey();
  } catch (ex) {
    try {
    scanKey = new PublicKey(scanKey);
    } catch (ex) {
      throw new Error('Invalid scanKey');
    }
  }

  // Build stealth address info
  var info = {};
  info.scanKey = scanKey;
  info.network = info.scanKey.network || Networks.livenet;
  info.options = spendKeys ? 0 : 1; // reuseScan
 
  spendKeys = spendKeys ? [].concat(spendKeys) : [];
  info.spendKeys = spendKeys.map((x) => {
    var ret;
    try {
      ret = new PrivateKey(x).toPublicKey();
    } catch (ex) {
      try {
      ret = new PublicKey(x);
      } catch (ex) {
        throw new Error('Invalid spendKeys');
      }
    }
    return ret;
  });

  info.signatures = signatures || info.spendKeys.length || 1;
  info.prefix = '';

  return info;
};

// TODO: Improve this (yemel)
Address.isValid = function(address) {
  try {
    var address = new Address(address);
    return true;
  } catch (err) {
    return false;
  }
};

Address.prototype._fromString = function(address) {
  var buffer = Base32.decode(address.toLowerCase());
  return this._fromBuffer(new Buffer(buffer));
};

Address.prototype._fromBuffer = function(buffer) {
  var reader = new BufferReader(buffer);
  var info = {};

  var version = reader.readUInt8();
  if (version != 42 && version != 43) {
    throw new Error('Invalid version number');
  }

  info.network = version == 42 ? Networks.livenet : Networks.testnet;
  info.options = reader.readUInt8();

  info.scanKey = PublicKey.fromBuffer(reader.read(33));
  var spendKeys = reader.readUInt8();
  info.spendKeys = [];
  for (var i = 0; i < spendKeys; i++) {
    info.spendKeys.push(PublicKey.fromBuffer(reader.read(33)));
  }

  info.signatures = reader.readUInt8();

  var prefix = reader.readUInt8();
  info.prefix = reader.read(prefix / 8).toString('hex');
  return info;
};


/**
 * Internal function to perform curvedh
 * @param {BN} bn - private key part
 * @param {PublicKey} pubKey - public key
 * @returns {BN}
 */
Address._stealthDH = function(bn, spendKey) {
  var point = spendKey.point.mul(bn);
  var buffer = new PublicKey(point, spendKey.network).toBuffer();
  var c = Hash.sha256(buffer);
  return BN.fromBuffer(c);
};

/**
 * Internal function to derive a public key from spend public key and shared secret
 * @param {PublicKey} spendKey - private key asociated with spendKey
 * @param {BN} c - Derivation value
 * @returns {PublicKey}
 */
Address._derivePublicKey = function(spendKey, c) {
  var sharedPoint = new PrivateKey(c).publicKey.point;
  return new PublicKey(spendKey.point.add(sharedPoint), spendKey.network);
};

/**
 * Internal function to derive a private key from spend private key and shared secret
 * @param {PrivateKey} spendKey - private key asociated with spendKey
 * @param {BN} c - Derivation value
 * @returns {PrivateKey}
 */
Address._derivePrivateKey = function(spendKey, c) {
  var derived = spendKey.bn.add(c).mod(Point.getN());
  return new PrivateKey(derived, spendKey.network);
};

/**
 * Returns if the sthealth address is multisig
 * @returns {Boolean}
 */
Address.prototype.isMultisig = function() {
  return this.spendKeys.length > 1;
};


/**
 * Sender: Generate a public key to make the stealth payment
 * E.g: sx stealth-initiate $EPHEM_SECRET $SCAN_PUBKEY $SPEND_PUBKEY
 *
 * @param {PrivateKey} ephemeral - A new private key
 * @returns {PublicKey}
 */
Address.prototype.toPaymentAddress = function(ephemeral) {
  if (!(ephemeral instanceof PrivateKey)) {
    throw new Error('Ephemeral must be a private key');
  }

  return this.isMultisig()
    ? this._toMultisigPaymentAddress(ephemeral)
    : this._toPubkeyHashPaymentAddress(ephemeral);
};

/**
 * Internal function to generate the public key to make a stealth payment
 *
 * @param {PrivateKey} ephemeral - A new private key
 * @returns {PublicKey}
 */
Address.prototype._toPubkeyHashPaymentAddress = function(ephemeral) {
  var c = Address._stealthDH(ephemeral.bn, this.scanKey);
  var pubkey = Address._derivePublicKey(this.spendKeys[0], c); // TODO: honor reuseScan
  return pubkey.toAddress(this.network);
};

/**
 * Internal function to generate the public keys to make a multisig stealth payment
 *
 * @param {PrivateKey} ephemeral - A new private key
 * @returns {PublicKey}
 */
Address.prototype._toMultisigPaymentAddress = function(ephemeral) {
  var c = Address._stealthDH(ephemeral.bn, this.scanKey);
  var derivedPubkeys = this.spendKeys.map(function(pubkey) {
    return Address._derivePublicKey(pubkey, c);
  });

  return bitcore.Address.createMultisig(derivedPubkeys, this.signatures);;
};

/**
 * Scanner: Generate a public key to verify a stealth output
 * E.g: sx stealth-uncover $EPHEM_PUBKEY $SCAN_SECRET $SPEND_PUBKEY
 *
 * @param {PublicKey} ephemeral - Tx ephemeral public key
 * @param {PrivateKey} scanKey - Scan private key
 * @param {PublicKey} spendKey - Spend public key
 * @returns {PublicKey}
 */
Address.getPubkeyHashPaymentAddress = function(ephemeral, scanKey, spendKey) {
  if (!(ephemeral instanceof PublicKey)) {
    throw new Error('ephemeral must be a public key');
  }
  if (!(scanKey instanceof PrivateKey)) {
    throw new Error('scanKey key must be a private key');
  }
  if (!(spendKey instanceof PublicKey)) {
    throw new Error('spendKey key must be a public key');
  }

  var c = Address._stealthDH(scanKey.bn, ephemeral);
  return Address._derivePublicKey(spendKey, c).toAddress(); // TODO: Network?
};

/**
 * Scanner: Generate a multisig payment address to verify a stealth output
 *
 * @param {PublicKey} ephemeral - Tx ephemeral public key
 * @param {PrivateKey} scanKey - Scan private key
 * @param {PublicKey} spendKey - Spend public key
 * @returns {PublicKey}
 */
Address.getMultisigPaymentAddress = function(ephemeral, scanKey, spendKeys, signatures) {
  if (!(ephemeral instanceof PublicKey)) {
    throw new Error('ephemeral must be a public key');
  }
  if (!(scanKey instanceof PrivateKey)) {
    throw new Error('scanKey key must be a private key');
  }
  if (!(_.isArray(spendKeys))) {
    throw new Error('spendKey key must be a public key');
  }

  var c = Address._stealthDH(scanKey.bn, ephemeral);
  var derivedPubkeys = spendKeys.map(function(pubkey) {
    return Address._derivePublicKey(pubkey, c);
  });

  return bitcore.Address.createMultisig(derivedPubkeys, signatures); // TODO: Network?
};


/**
 * Receiver: Generate a private key to spend the funds of a stealth payment
 * E.g: sx stealth-uncover-secret $EPHEM_PUBKEY $SCAN_SECRET $SPEND_SECRET
 *
 * @param {PublicKey} ephemeral - Tx ephemeral public key
 * @param {PrivateKey} scannKey - Scan private key
 * @param {PrivateKey} spendKey - Spend private key
 * @returns {PublicKey}
 */
Address.getStealthPrivateKey = function(ephemeral, scanKey, spendKey) {
  if (!(ephemeral instanceof PublicKey)) {
    throw new Error('ephemeral must be a public key');
  }
  if (!(scanKey instanceof PrivateKey)) {
    throw new Error('scanKey key must be a private key');
  }
  if (!(spendKey instanceof PrivateKey)) {
    throw new Error('spendKey key must be a private key');
  }

  var c = Address._stealthDH(scanKey.bn, ephemeral);
  return Address._derivePrivateKey(spendKey, c);
};

/**
 * Will return a buffer representation of the stealth address
 *
 * @returns {Buffer} stealth address buffer
 */
Address.prototype.toBuffer = function() {
  var version = this.network == Networks.livenet ? 42 : 43;

  var writer = new BufferWriter();
  writer.writeUInt8(version);

  var options = this.reuseScan ? 1 : 0;
  writer.writeUInt8(options);
  writer.write(this.scanKey.toBuffer());

  writer.writeUInt8(this.spendKeys.length);
  for (var i = 0; i < this.spendKeys.length; i++) {
    var spendKey = this.spendKeys[i];
    writer.write(spendKey.toBuffer());
  }
  writer.writeUInt8(this.signatures);
  writer.writeUInt8(this.prefix.length);
  writer.write(new Buffer(this.prefix, 'hex'));
  return writer.concat();
};

/**
 * @returns {Object} A plain object with the stealth address information
 */
Address.prototype.toObject = function toObject() {
  return {
    network: this.network.toString(),
    options: this.options,
    scanKey: this.scanKey,
    spendKeys: this.spendKeys,
    signatures: this.signatures,
    prefix: prefix
  };
};

/**
 * @returns {String} A JSON representation of a plain object with the stealth address information
 */
Address.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

/**
 * Will return a the string representation of the stealth address
 *
 * @returns {String} Stealth address
 */
Address.prototype.toString = function() {

//  return Base58Check.encode(this.toBuffer());
  var payl = bitcore.util.convertBits(this.toBuffer(), 8, 5);
  return Base32.encode(payl).toUpperCase();
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} Stealth address
 */
Address.prototype.inspect = function() {
  return '<Stealth Address: ' + this.toString() + ', network: ' + this.network + '>';
};

module.exports = Address;
