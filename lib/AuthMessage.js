'use strict';

var Message = require('./Message');
var ECIES = require('./ECIES');
var preconditions = require('preconditions').singleton();
var Key = require('./Key');


var majorVersion = 1;
var minorVersion = 0;

/* Encrypted, authenticated messages to be shared between copayers */
var AuthMessage = function() {};

AuthMessage.setVersion = function(major, minor) {
  majorVersion = major;
  minorVersion = minor;
};

AuthMessage.encode = function(topubkey, fromkey, payload, opts) {
  preconditions.checkArgument(fromkey instanceof Key, 'fromkey');
  if (typeof topubkey === 'string') {
    topubkey = new Buffer(topubkey, 'hex');
  }
  if (!(payload instanceof Buffer)) {
    payload = new Buffer(JSON.stringify(payload));
  }
  //peers should reject messges containing bigger major version
  //i.e., increment to prevent communications with old clients
  var version1 = new Buffer([majorVersion]);

  //peers should not reject messages containing not-understood minorversion
  //i.e., increment to allow communication with old clients, but signal new clients
  var version2 = new Buffer([minorVersion]);

  if (opts && opts.nonce && Buffer.isBuffer(opts.nonce) && opts.nonce.length == 8) {
    var nonce = opts.nonce;
  } else {
    var nonce = new Buffer(8);
    nonce.fill(0); //nonce is a big endian 8 byte number
  }

  var toencrypt = Buffer.concat([version1, version2, nonce, payload]);
  var toencrypthexbuf = new Buffer(toencrypt.toString('hex')); //due to bug in sjcl/bitcore, must use hex string
  var encrypted = AuthMessage._encrypt(topubkey, toencrypthexbuf);
  var sig = AuthMessage._sign(fromkey, encrypted);
  var encoded = {
    pubkey: fromkey.public.toString('hex'),
    sig: sig.toString('hex'),
    encrypted: encrypted.toString('hex'),
    to: topubkey.toString('hex')
  };
  return encoded;
};

AuthMessage.decode = function(key, encoded, opts) {
  if (opts && opts.prevnonce && Buffer.isBuffer(opts.prevnonce) && opts.prevnonce.length == 8) {
    var prevnonce = opts.prevnonce;
  } else {
    var prevnonce = new Buffer(8);
    prevnonce.fill(0); //nonce is a big endian 8 byte number
  }

  try {
    var frompubkey = new Buffer(encoded.pubkey, 'hex');
  } catch (e) {
    throw new Error('Error decoding public key: ' + e);
  }

  try {
    var sig = new Buffer(encoded.sig, 'hex');
    var encrypted = new Buffer(encoded.encrypted, 'hex');
  } catch (e) {
    throw new Error('Error decoding data: ' + e);
  }

  try {
    var v = AuthMessage._verify(frompubkey, sig, encrypted);
  } catch (e) {
    throw new Error('Error verifying signature: ' + e);
  }

  if (!v) {
    throw new Error('Invalid signature');
  }

  try {
    var decryptedhexbuf = AuthMessage._decrypt(key.private, encrypted);
    var decrypted = new Buffer(decryptedhexbuf.toString(), 'hex'); //workaround for bug in bitcore/sjcl
  } catch (e) {
    throw new Error('Cannot decrypt data: ' + e);
  }

  try {
    var version1 = decrypted[0];
    var version2 = decrypted[1];
    var nonce = decrypted.slice(2, 10);
    var payload = decrypted.slice(10);
  } catch (e) {
    throw new Error('Cannot parse decrypted data: ' + e);
  }

  if (payload.length === 0) {
    throw new Error('No data present');
  }

  if (version1 !== majorVersion) {
    throw new Error('Invalid version number');
  }

  if (version2 !== minorVersion) {
    //put special version2 handling code here, if ever needed
  }

  if (!AuthMessage._noncegt(nonce, prevnonce) && prevnonce.toString('hex') !== '0000000000000000') {
    throw new Error('Nonce not equal to zero and not greater than the previous nonce');
  }

  try {
    payload = JSON.parse(payload);
  } catch (e) {
    if (e instanceof SyntaxError) {
      // if we can't parse a JSON, just return what we found
    } else {
      throw e;
    }
  }

  var decoded = {
    version1: version1,
    version2: version2,
    nonce: nonce,
    payload: payload
  };

  return decoded;
};

//return true if nonce > prevnonce; false otherwise
AuthMessage._noncegt = function(nonce, prevnonce) {
  var noncep1 = nonce.slice(0, 4).readUInt32BE(0);
  var prevnoncep1 = prevnonce.slice(0, 4).readUInt32BE(0);

  if (noncep1 > prevnoncep1)
    return true;

  if (noncep1 < prevnoncep1)
    return false;

  var noncep2 = nonce.slice(4, 8).readUInt32BE(0);
  var prevnoncep2 = prevnonce.slice(4, 8).readUInt32BE(0);

  if (noncep2 > prevnoncep2)
    return true;

  return false;
};

AuthMessage._encrypt = function(topubkey, payload, r, iv) {
  var encrypted = ECIES.encrypt(topubkey, payload, r, iv);
  return encrypted;
};

AuthMessage._decrypt = function(privkey, encrypted) {
  var decrypted = ECIES.decrypt(privkey, encrypted);
  return decrypted;
};

AuthMessage._sign = function(key, payload) {
  var sig = Message.sign(payload, key);
  return sig;
};

AuthMessage._verify = function(pubkey, signature, payload) {
  var v = Message.verifyWithPubKey(pubkey, payload, signature);
  return v;
};

module.exports = AuthMessage;
