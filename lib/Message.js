'use strict';
var coinUtil = require('../util');
var Key = require('./Key');

var Message = function() {};

Message.sign = function(str, key) {
  var hash = Message.magicHash(str);
  var sig = key.signSync(hash);
  return sig;
};

Message.verifyWithPubKey = function(pubkey, message, sig) {
  var hash = Message.magicHash(message);
  var key = new Key();
  if (pubkey.length == 65)
    key.compressed = false;
  key.public = pubkey;

  return key.verifySignatureSync(hash, sig);
};

//TODO: Message.verify ... with address, not pubkey

Message.magicBytes = new Buffer('Bitcoin Signed Message:\n');

Message.magicHash = function(str) {
  var magicBytes = Message.magicBytes;
  var prefix1 = coinUtil.varIntBuf(magicBytes.length);
  var message = new Buffer(str);
  var prefix2 = coinUtil.varIntBuf(message.length);

  var buf = Buffer.concat([prefix1, magicBytes, prefix2, message]);

  var hash = coinUtil.twoSha256(buf);

  return hash;
};

module.exports = Message;
