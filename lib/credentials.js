'use strict';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var sjcl = require('sjcl');

var FIELDS = [  
  'network',
  'xPrivKey',
  'xPrivKeyEncrypted',
  'xPubKey',
  'requestPrivKey',
  'requestPubKey',
  'copayerId',
  'publicKeyRing',
  'walletId',
  'walletName',
  'm',
  'n',
  'walletPrivKey',
  'personalEncryptingKey',
  'sharedEncryptingKey',
  'copayerName',
  'externalSource',
  'externalIndex'
];

var EXPORTABLE_FIELDS = [
  'xPrivKey',
  'xPrivKeyEncrypted',
  'requestPrivKey',
  'xPubKey',
  'm',
  'n',
  'publicKeyRing',
  'sharedEncryptingKey',
  'externalSource',
  'externalIndex'
];

function Credentials() {
  this.version = '1.0.0';
};

Credentials.create = function(network) {
  var x = new Credentials();

  x.network = network;
  x.xPrivKey = (new Bitcore.HDPrivateKey(network)).toString();
  x._expand();
  return x;
};

Credentials.fromExtendedPrivateKey = function(xPrivKey) {
  var x = new Credentials();
  x.xPrivKey = xPrivKey;
  x._expand();
  return x;
};

Credentials.fromExternalWalletPublicKey = function(xPubKey, source, index) {
  var x = new Credentials();
  x.xPubKey = xPubKey;
  x.externalSource = source;
  x.externalIndex = index;
  x._expand();
  return x;
};

Credentials.prototype._expand = function() {
  $.checkState(this.xPrivKey || this.xPubKey);

  if (this.xPrivKey) {
    var xPrivKey = new Bitcore.HDPrivateKey.fromString(this.xPrivKey);

    var addressDerivation = xPrivKey.derive(WalletUtils.PATHS.BASE_ADDRESS_DERIVATION);
    this.xPubKey = (new Bitcore.HDPublicKey(addressDerivation)).toString();

    var requestDerivation = xPrivKey.derive(WalletUtils.PATHS.REQUEST_KEY);
    this.requestPrivKey = requestDerivation.privateKey.toString();
    this.requestPubKey = requestDerivation.publicKey.toString();
  }
  var network = WalletUtils.getNetworkFromXPubKey(this.xPubKey);
  if (this.hasExternalSource()) {
    var xPrivKey = new Bitcore.PrivateKey(network);
    this.requestPrivKey = xPrivKey.toString();
    this.requestPubKey = xPrivKey.toPublicKey().toString();
  }  
  if (this.network) {
    $.checkState(this.network == network);
  } else {
    this.network = network;
  }

  this.personalEncryptingKey = WalletUtils.privateKeyToAESKey(this.requestPrivKey);
  this.copayerId = WalletUtils.xPubToCopayerId(this.xPubKey);
};

Credentials.fromObj = function(obj) {
  var x = new Credentials();

  _.each(FIELDS, function(k) {
    x[k] = obj[k];
  });

  $.checkState(x.xPrivKey || x.xPubKey || x.xPrivKeyEncrypted, "invalid input");
  return x;
};

Credentials.prototype.toObj = function() {
  var self = this;

  var x = {};
  _.each(FIELDS, function(k) {
    x[k] = self[k];
  });
  return x;
};

Credentials.prototype.addWalletInfo = function(walletId, walletName, m, n, walletPrivKey, copayerName) {
  this.walletId = walletId;
  this.walletName = walletName;
  this.m = m;
  this.n = n;
  this.walletPrivKey = walletPrivKey;
  if (walletPrivKey)
    this.sharedEncryptingKey = WalletUtils.privateKeyToAESKey(walletPrivKey);

  if (copayerName)
    this.copayerName = copayerName;

  if (n == 1) {
    this.addPublicKeyRing([{
      xPubKey: this.xPubKey,
      requestPubKey: this.requestPubKey,
    }]);
  }
};

Credentials.prototype.hasWalletInfo = function() {
  return !!this.walletId;
};

Credentials.prototype.isPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted) && !this.xPrivKey;
};

Credentials.prototype.hasPrivKeyEncrypted = function() {
  return (!!this.xPrivKeyEncrypted);
};

Credentials.prototype.setPrivateKeyEncryption = function(password, opts) {
  if (this.xPrivKeyEncrypted)
    throw new Error('Encrypted Privkey Already exists');

  if (!this.xPrivKey)
    throw new Error('No private key to encrypt');


  this.xPrivKeyEncrypted = sjcl.encrypt(password, this.xPrivKey, opts);
  if (!this.xPrivKeyEncrypted)
    throw new Error('Could not encrypt');
};


Credentials.prototype.disablePrivateKeyEncryption = function() {
  if (!this.xPrivKeyEncrypted)
    throw new Error('Private Key is not encrypted');

  if (!this.xPrivKey)
    throw new Error('Wallet is locked, cannot disable encryption');

  this.xPrivKeyEncrypted = null;
};


Credentials.prototype.lock = function() {
  if (!this.xPrivKeyEncrypted)
    throw new Error('Could not lock, no encrypted private key');

  delete this.xPrivKey;
};

Credentials.prototype.unlock = function(password) {
  if (this.xPrivKeyEncrypted) {
    this.xPrivKey = sjcl.decrypt(password, this.xPrivKeyEncrypted);
  }
};

Credentials.prototype.addPublicKeyRing = function(publicKeyRing) {
  this.publicKeyRing = _.clone(publicKeyRing);
};

Credentials.prototype.updatePublicKeyRing = function(publicKeyRing) {
  _.each(this.publicKeyRing, function(x) {
    if (x.isTemporaryRequestKey) {
      var y = _.find(publicKeyRing, {
        xPubKey: x.xPubKey
      });
      if (y && !y.isTemporaryRequestKey) {
        x.requestPubKey = y.requestPubKey;
        x.isTemporaryRequestKey = y.isTemporaryRequestKey;
      }
    }
  });
};

Credentials.prototype.canSign = function() {
  return (!!this.xPrivKey || !!this.xPrivKeyEncrypted);
};

Credentials.prototype.isComplete = function() {
  if (!this.m || !this.n) return false;
  if (!this.publicKeyRing || this.publicKeyRing.length != this.n) return false;
  return true;
};

Credentials.prototype.hasExternalSource = function() {
  return (typeof this.externalSource == "string");
};

Credentials.prototype.getExternalSourceName = function() {
  return this.externalSource;
};

Credentials.prototype.getExternalIndex = function() {
  return this.externalIndex;
};

Credentials.prototype.hasTemporaryRequestKeys = function() {
  if (!this.isComplete()) return null;
  return _.any(this.publicKeyRing, function(item) {
    return item.isTemporaryRequestKey;
  });
};

Credentials.prototype.exportCompressed = function() {
  var self = this;
  var values = _.map(EXPORTABLE_FIELDS, function(field) {
    if ((field == 'xPubKey' || field == 'requestPrivKey') && self.canSign()) return '';
    if (field == 'requestPrivKey') {
      return Bitcore.PrivateKey.fromString(self.requestPrivKey).toWIF();
    }
    if (field == 'publicKeyRing') {
      return _.reject(self.publicKeyRing, {
        xPubKey: self.xPubKey
      });
    }
    return self[field];
  });
  values.unshift(self.version);

  return JSON.stringify(values);
};

Credentials.importCompressed = function(compressed, password) {
  var list;
  try {
    list = JSON.parse(compressed);
  } catch (ex) {
    throw new Error('Invalid compressed format');
  }

  var x = new Credentials();

  // Remove version
  var version = list[0];
  list = _.rest(list);

  _.each(EXPORTABLE_FIELDS, function(field, i) {
    x[field] = list[i];
  });

  if (password)
    x.unlock(password);
  x._expand();
  if (password)
    x.lock(password);

  x.network = WalletUtils.getNetworkFromXPubKey(x.xPubKey);
  x.publicKeyRing.push({
    xPubKey: x.xPubKey,
    requestPubKey: x.requestPubKey,
  });
  return x;
};

Credentials.fromOldCopayWallet = function(w){
  var credentials = Credentials.fromExtendedPrivateKey(w.privateKey.extendedPrivateKeyString);

  var pkr = _.map(w.publicKeyRing.copayersExtPubKeys, function(xPubStr) {

    var isMe = xPubStr === credentials.xPubKey;
    var requestDerivation;

    if (isMe) {
      var path = WalletUtils.PATHS.REQUEST_KEY;
      requestDerivation = (new Bitcore.HDPrivateKey(credentials.xPrivKey))
        .derive(path).hdPublicKey;
    } else {
      var path = WalletUtils.PATHS.TMP_REQUEST_KEY;
      requestDerivation = (new Bitcore.HDPublicKey(xPubStr)).derive(path);
    }

    // Grab Copayer Name
    var hd = new Bitcore.HDPublicKey(xPubStr).derive('m/2147483646/0/0');
    var pubKey = hd.publicKey.toString('hex');
    var copayerName = w.publicKeyRing.nicknameFor[pubKey];
    if (isMe) {
      credentials.copayerName = copayerName;
    }

    return {
      xPubKey: xPubStr,
      requestPubKey: requestDerivation.publicKey.toString(),
      isTemporaryRequestKey: !isMe,
      copayerName: copayerName,
    };
  });
  credentials.addPublicKeyRing(pkr);
  return credentials;
};

module.exports = Credentials;
