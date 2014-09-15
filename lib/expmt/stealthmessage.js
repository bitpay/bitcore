var Stealthkey = require('./stealthkey');
var StealthAddress = require('./stealthaddress');
var ECIES = require('./ecies');
var Message = require('../message');
var Keypair = require('../keypair');
var Address = require('../address');
var Pubkey = require('../pubkey');

var StealthMessage = function StealthMessage(obj) {
  if (!(this instanceof StealthMessage))
    return new StealthMessage(obj);
  if (obj)
    this.set(obj);
};

StealthMessage.prototype.set = function(obj) {
  this.messagebuf = obj.messagebuf || this.messagebuf;
  this.encbuf = obj.encbuf || this.encbuf;
  this.toStealthAddress = obj.toStealthAddress || this.toStealthAddress;
  this.toStealthkey = obj.toStealthkey || this.toStealthkey;
  this.fromKeypair = obj.fromKeypair || this.fromKeypair;
  this.receiveAddress = obj.receiveAddress || this.receiveAddress;
  return this;
};

StealthMessage.encrypt = function(messagebuf, toStealthAddress, fromKeypair, ivbuf) {
  var sm = StealthMessage().set({
    messagebuf: messagebuf,
    toStealthAddress: toStealthAddress,
    fromKeypair: fromKeypair
  });
  sm.encrypt(ivbuf);
  var buf = Buffer.concat([
    sm.receiveAddress.hashbuf,
    sm.fromKeypair.pubkey.toDER(true),
    sm.encbuf
  ]);
  return buf;
};

StealthMessage.decrypt = function(buf, toStealthkey) {
  var sm = StealthMessage().set({
    toStealthkey: toStealthkey,
    receiveAddress: Address().set({hashbuf: buf.slice(0, 20)}),
    fromKeypair: Keypair().set({pubkey: Pubkey().fromDER(buf.slice(20, 20 + 33))}),
    encbuf: buf.slice(20 + 33)
  });
  return sm.decrypt().messagebuf;
};

StealthMessage.isForMe = function(buf, toStealthkey) {
  var sm = StealthMessage().set({
    toStealthkey: toStealthkey,
    receiveAddress: Address().set({hashbuf: buf.slice(0, 20)}),
    fromKeypair: Keypair().set({pubkey: Pubkey().fromDER(buf.slice(20, 20 + 33))}),
    encbuf: buf.slice(20 + 33)
  });
  return sm.isForMe();
};

StealthMessage.prototype.encrypt = function(ivbuf) {
  if (!this.fromKeypair)
    this.fromKeypair = Keypair().fromRandom();
  var receivePubkey = this.toStealthAddress.getReceivePubkey(this.fromKeypair);
  this.receiveAddress = Address().fromPubkey(receivePubkey);
  this.encbuf = ECIES.encrypt(this.messagebuf, receivePubkey, this.fromKeypair, ivbuf);
  return this;
};

StealthMessage.prototype.decrypt = function() {
  var receiveKeypair = this.toStealthkey.getReceiveKeypair(this.fromKeypair.pubkey);
  this.messagebuf = ECIES.decrypt(this.encbuf, receiveKeypair.privkey);
  return this;
};

StealthMessage.prototype.isForMe = function() {
  var receivePubkey = this.toStealthkey.getReceivePubkey(this.fromKeypair.pubkey);
  var receiveAddress = Address().fromPubkey(receivePubkey);
  if (receiveAddress.toString('hex') === this.receiveAddress.toString('hex'))
    return true;
  else
    return false;
};

module.exports = StealthMessage;
