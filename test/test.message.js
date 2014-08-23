var Address = require('../lib/address');
var Message = require('../lib/message');
var Key = require('../lib/key');
var should = require('chai').should();

describe('Message', function() {
  
  it('should make a new message', function() {
    var message = new Message();
    should.exist(message);
  });

  it('should make a new message when called without "new"', function() {
    var message = Message();
    should.exist(message);
  });

  describe('#sign', function() {
    var messagebuf = new Buffer('this is my message');
    var key = Key().fromRandom();

    it('should sign a message', function() {
      var message = new Message();
      message.messagebuf = messagebuf;
      message.key = key;
      message.sign();
      var sig = message.sig;
      should.exist(sig);
    });

  });

  describe('#verify', function() {
    var messagebuf = new Buffer('this is my message');
    var key = Key().fromRandom();

    it('should verify a message that was just signed', function() {
      var message = new Message();
      message.messagebuf = messagebuf;
      message.key = key;
      message.address = Address().fromPubkey(key.pubkey);
      message.sign();
      message.verify();
      message.verified.should.equal(true);
    });

  });

  describe('@sign', function() {
    var messagebuf = new Buffer('this is my message');
    var key = Key().fromRandom();

    it('should return a base64 string', function() {
      var sigstr = Message.sign(messagebuf, key);
      var sigbuf = new Buffer(sigstr, 'base64');
      sigbuf.length.should.equal(1 + 32 + 32);
    });

    it('should sign with a compressed pubkey', function() {
      var key = Key().fromRandom();
      key.pubkey.compressed = true;
      var sigstr = Message.sign(messagebuf, key);
      var sigbuf = new Buffer(sigstr, 'base64');
      sigbuf[0].should.be.above(27 + 4 - 1);
      sigbuf[0].should.be.below(27 + 4 + 4 - 1);
    });

    it('should sign with an uncompressed pubkey', function() {
      var key = Key().fromRandom();
      key.pubkey.compressed = false;
      var sigstr = Message.sign(messagebuf, key);
      var sigbuf = new Buffer(sigstr, 'base64');
      sigbuf[0].should.be.above(27 - 1);
      sigbuf[0].should.be.below(27 + 4 - 1);
    });

  });

  describe('@verify', function() {
    var messagebuf = new Buffer('this is my message');
    var key = Key().fromRandom();

    it('should verify a signed message', function() {
      var sigstr = Message.sign(messagebuf, key);
      var addr = Address().fromPubkey(key.pubkey);
      Message.verify(messagebuf, sigstr, addr).should.equal(true);
    });

    it('should verify this known good signature', function() {
      var addrstr = '1CKTmxj6DjGrGTfbZzVxnY4Besbv8oxSZb';
      var address = Address().fromString(addrstr);
      var sigstr = 'IOrTlbNBI0QO990xOw4HAjnvRl/1zR+oBMS6HOjJgfJqXp/1EnFrcJly0UcNelqJNIAH4f0abxOZiSpYmenMH4M=';
      Message.verify(messagebuf, sigstr, address);
    });

  });

});
