var should = require('chai').should();
var Stealth = require('../lib/expmt/stealth');
var Key = require('../lib/key');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var BN = require('../lib/bn');
var Hash = require('../lib/hash');
var base58check = require('../lib/base58check');

describe('stealth', function() {
  
  var stealth = Stealth();
  stealth.payloadKey = Key();
  stealth.payloadKey.privkey = Privkey();
  stealth.payloadKey.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 1')));
  stealth.payloadKey.privkey2pubkey();
  stealth.scanKey = Key();
  stealth.scanKey.privkey = Privkey();
  stealth.scanKey.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 2')));
  stealth.scanKey.privkey2pubkey();

  var senderKey = Key();
  senderKey.privkey = Privkey();
  senderKey.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 3')));
  senderKey.privkey2pubkey();

  var addressString = '9dDbC9FzZ74r8njQkXD6W27gtrxLiWaeFPHxeo1fynQRXPicqxVt7u95ozbwoVVMXyrzaHKN9owsteg63FgwDfrxWx82SAW';

  it('should create a new stealth', function() {
    var stealth = new Stealth();
    should.exist(stealth);
  });

  it('should create a new stealth without using "new"', function() {
    var stealth = Stealth();
    should.exist(stealth);
  });

  describe('#fromAddressBuffer', function() {

    it('should give a stealth address with the right pubkeys', function() {
      var stealth2 = new Stealth();
      var buf = base58check.decode(addressString);
      stealth2.fromAddressBuffer(buf);
      stealth2.payloadKey.pubkey.toString().should.equal(stealth.payloadKey.pubkey.toString());
      stealth2.scanKey.pubkey.toString().should.equal(stealth.scanKey.pubkey.toString());
    });

  });

  describe('#fromAddressString', function() {

    it('should give a stealth address with the right pubkeys', function() {
      var stealth2 = new Stealth();
      stealth2.fromAddressString(addressString);
      stealth2.payloadKey.pubkey.toString().should.equal(stealth.payloadKey.pubkey.toString());
      stealth2.scanKey.pubkey.toString().should.equal(stealth.scanKey.pubkey.toString());
    });

  });

  describe('#fromRandom', function() {

    it('should create a new stealth from random', function() {
      var stealth = Stealth().fromRandom();
      should.exist(stealth.payloadKey.privkey.bn.gt(0));
      should.exist(stealth.scanKey.privkey.bn.gt(0));
    });

  });

  describe('#getSharedKeyAsReceiver', function() {

    it('should return a key', function() {
      var key = stealth.getSharedKeyAsReceiver(senderKey.pubkey);
      (key instanceof Key).should.equal(true);
    });

  });

  describe('#getSharedKeyAsSender', function() {

    it('should return a key', function() {
      var stealth2 = new Stealth();
      stealth2.payloadKey = new Key();
      stealth2.payloadKey.pubkey = stealth.payloadKey.pubkey;
      stealth2.scanKey = new Key();
      stealth2.scanKey.pubkey = stealth.scanKey.pubkey;
      var key = stealth2.getSharedKeyAsSender(senderKey);
      (key instanceof Key).should.equal(true);
    });

    it('should return the same key as getSharedKeyAsReceiver', function() {
      var stealth2 = new Stealth();
      stealth2.payloadKey = new Key();
      stealth2.payloadKey.pubkey = stealth.payloadKey.pubkey;
      stealth2.scanKey = new Key();
      stealth2.scanKey.pubkey = stealth.scanKey.pubkey;
      var key = stealth2.getSharedKeyAsSender(senderKey);

      var key2 = stealth.getSharedKeyAsReceiver(senderKey.pubkey);
      key.toString().should.equal(key2.toString());
    });

  });

  describe('#getReceivePubkeyAsReceiver', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealth.getReceivePubkeyAsReceiver(senderKey.pubkey);
      (pubkey instanceof Pubkey).should.equal(true);
    });

  });

  describe('#getReceivePubkeyAsSender', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealth.getReceivePubkeyAsSender(senderKey);
      (pubkey instanceof Pubkey).should.equal(true);
    });

    it('should return the same pubkey as getReceivePubkeyAsReceiver', function() {
      var pubkey = stealth.getReceivePubkeyAsSender(senderKey);
      var pubkey2 = stealth.getReceivePubkeyAsReceiver(senderKey.pubkey);
      pubkey2.toString().should.equal(pubkey.toString());
    });

  });

  describe('#getReceiveKey', function() {

    it('should return a key', function() {
      var key = stealth.getReceiveKey(senderKey.pubkey);
      (key instanceof Key).should.equal(true);
    });

    it('should return a key with the same pubkey as getReceivePubkeyAsReceiver', function() {
      var key = stealth.getReceiveKey(senderKey.pubkey);
      var pubkey = stealth.getReceivePubkeyAsReceiver(senderKey.pubkey);
      key.pubkey.toString().should.equal(pubkey.toString());
    });

  });

  describe('#isForMe', function() {

    it('should return true if it (the transaction or message) is for me', function() {
      var pubkeyhash = new Buffer('3cb64fa6ee9b3e8754e3e2bd033bf61048604a99', 'hex');
      stealth.isForMe(senderKey.pubkey, pubkeyhash).should.equal(true);
    });

    it('should return false if it (the transaction or message) is not for me', function() {
      var pubkeyhash = new Buffer('00b64fa6ee9b3e8754e3e2bd033bf61048604a99', 'hex');
      stealth.isForMe(senderKey.pubkey, pubkeyhash).should.equal(false);
    });

  });

  describe('#toAddressBuffer', function() {
    
    it('should return this known address buffer', function() {
      var buf = stealth.toAddressBuffer();
      base58check.encode(buf).should.equal(addressString);
    });

  });

  describe('#toAddressString', function() {
    
    it('should return this known address string', function() {
      stealth.toAddressString().should.equal(addressString);
    });

  });

});
