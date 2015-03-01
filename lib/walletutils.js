'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var sjcl = require('sjcl');

var Bitcore = require('bitcore');
var Address = Bitcore.Address;
var PrivateKey = Bitcore.PrivateKey;
var PublicKey = Bitcore.PublicKey;
var crypto = Bitcore.crypto;
var encoding = Bitcore.encoding;
var Utils = require('./utils');

function WalletUtils() {};

/* TODO: It would be nice to be compatible with bitcoind signmessage. How
 * the hash is calculated there? */
WalletUtils.hashMessage = function(text) {
  $.checkArgument(text);
  var buf = new Buffer(text);
  var ret = crypto.Hash.sha256sha256(buf);
  ret = new Bitcore.encoding.BufferReader(ret).readReverse();
  return ret;
};


WalletUtils.signMessage = function(text, privKey) {
  $.checkArgument(text);
  var priv = new PrivateKey(privKey);
  var hash = WalletUtils.hashMessage(text);
  return crypto.ECDSA.sign(hash, priv, 'little').toString();
};


WalletUtils.verifyMessage = function(text, signature, pubKey) {
  $.checkArgument(text);
  $.checkArgument(pubKey);

  if (!signature)
    return false;

  var pub = new PublicKey(pubKey);
  var hash = WalletUtils.hashMessage(text);

  try {
    var sig = new crypto.Signature.fromString(signature);
    return crypto.ECDSA.verify(hash, sig, pub, 'little');
  } catch (e) {
    return false;
  }
};

WalletUtils.deriveAddress = function(publicKeyRing, path, m, network) {
  var publicKeys = _.map(publicKeyRing, function(xPubKey) {
    var xpub = new Bitcore.HDPublicKey(xPubKey);
    return xpub.derive(path).publicKey;
  });

  var bitcoreAddress = Address.createMultisig(publicKeys, m, network);

  return {
    address: bitcoreAddress.toString(),
    path: path,
    publicKeys: _.invoke(publicKeys, 'toString'),
  };
};

WalletUtils.getProposalHash = function(toAddress, amount, message) {
  return toAddress + '|' + amount + '|' + (message || '');
};

WalletUtils.xPubToCopayerId = function(xpub) {
  var hash = sjcl.hash.sha256.hash(xpub);
  return sjcl.codec.hex.fromBits(hash);
};

WalletUtils.toSecret = function(walletId, walletPrivKey, network) {
  var widHex = new Buffer(walletId.replace(/-/g, ''), 'hex');
  var widBase58 = new encoding.Base58(widHex).toString();
  return _.padRight(widBase58, 22, '0') + walletPrivKey.toWIF() + (network == 'testnet' ? 'T' : 'L');
};

WalletUtils.fromSecret = function(secret) {
  $.checkArgument(secret);

  function split(str, indexes) {
    var parts = [];
    indexes.push(str.length);
    var i = 0;
    while (i < indexes.length) {
      parts.push(str.substring(i == 0 ? 0 : indexes[i - 1], indexes[i]));
      i++;
    };
    return parts;
  };

  try {
    var secretSplit = split(secret, [22, 74]);
    var widBase58 = secretSplit[0].replace(/0/g, '');
    var widHex = encoding.Base58.decode(widBase58).toString('hex');
    var walletId = split(widHex, [8, 12, 16, 20]).join('-');

    var walletPrivKey = Bitcore.PrivateKey.fromString(secretSplit[1]);
    var networkChar = secretSplit[2];

    return {
      walletId: walletId,
      walletPrivKey: walletPrivKey,
      network: networkChar == 'T' ? 'testnet' : 'livenet',
    };
  } catch (ex) {
    throw new Error('Invalid secret');
  }
};


WalletUtils.encryptMessage = function(message, encryptingKey) {
  var key = sjcl.codec.base64.toBits(encryptingKey);
  return sjcl.encrypt(key, message, {
    ks: 128,
    iter: 1
  });
};

WalletUtils.decryptMessage = function(cyphertextJson, encryptingKey) {
  var key = sjcl.codec.base64.toBits(encryptingKey);
  return sjcl.decrypt(key, cyphertextJson);
};

WalletUtils.privateKeyToAESKey = function(privKey) {
  var pk = Bitcore.PrivateKey.fromString(privKey);
  return Bitcore.crypto.Hash.sha256(pk.toBuffer()).slice(0, 16).toString('base64');
};

WalletUtils.decryptWallet = function(data, password) {
  $.checkArgument(data.enc);
  var extraFields = JSON.parse(sjcl.decrypt(password, data.enc));
  delete data.enc;
  return _.extend(data, extraFields);
};


WalletUtils.sjclOpts = {
  iter: 5000,
};

WalletUtils.encryptWallet = function(data, accessWithoutEncrytion, password) {

  // Fields to encrypt, given the NOPASSWD access level
  var fieldsEncryptByLevel = {
    none: _.keys(data),
    readonly: ['xPrivKey', 'requestPrivKey', 'publicKeyRing'],
    readwrite: ['xPrivKey', ],
    full: [],
  };

  var fieldsEncrypt = fieldsEncryptByLevel[accessWithoutEncrytion];
  $.checkState(!_.isUndefined(fieldsEncrypt));

  var toEncrypt = _.pick(data, fieldsEncrypt);
  var enc = sjcl.encrypt(password, JSON.stringify(toEncrypt), WalletUtils.sjclOpts);

  var ret = _.omit(data, fieldsEncrypt);
  ret.enc = enc;
  return ret;
};



WalletUtils.signTxp = function(txp, xPrivKey) {
  var self = this;

  //Derive proper key to sign, for each input
  var privs = [],
    derived = {};

  var network = new Bitcore.Address(txp.toAddress).network.name;
  var xpriv = new Bitcore.HDPrivateKey(xPrivKey, network);

  _.each(txp.inputs, function(i) {
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
      privs.push(derived[i.path]);
    }
  });

  var t = new Bitcore.Transaction();

  _.each(txp.inputs, function(i) {
    t.from(i, i.publicKeys, txp.requiredSignatures);
  });

  t.to(txp.toAddress, txp.amount)
    .change(txp.changeAddress.address);

  var signatures = _.map(privs, function(priv, i) {
    return t.getSignatures(priv);
  });

  signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
    return s.signature.toDER().toString('hex');
  });

  return signatures;
};

module.exports = WalletUtils;
