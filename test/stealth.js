var should = require('chai').should();
var Stealth = require('../lib/expmt/stealth');
var Keypair = require('../lib/keypair');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var BN = require('../lib/bn');
var Hash = require('../lib/hash');
var base58check = require('../lib/base58check');

describe('Stealth', function() {
  
  var stealth = Stealth();
  stealth.payloadKeypair = Keypair();
  stealth.payloadKeypair.privkey = Privkey();
  stealth.payloadKeypair.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 1')));
  stealth.payloadKeypair.privkey2pubkey();
  stealth.scanKeypair = Keypair();
  stealth.scanKeypair.privkey = Privkey();
  stealth.scanKeypair.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 2')));
  stealth.scanKeypair.privkey2pubkey();

  var senderKeypair = Keypair();
  senderKeypair.privkey = Privkey();
  senderKeypair.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 3')));
  senderKeypair.privkey2pubkey();

  var addressString = '9dDbC9FzZ74r8njQkXD6W27gtrxLiWaeFPHxeo1fynQRXPicqxVt7u95ozbwoVVMXyrzaHKN9owsteg63FgwDfrxWx82SAW';

  it('should create a new stealth', function() {
    var stealth = new Stealth();
    should.exist(stealth);
  });

  it('should create a new stealth without using "new"', function() {
    var stealth = Stealth();
    should.exist(stealth);
  });

  describe('#set', function() {

    it('should set payload key', function() {
      should.exist(Stealth().set({payloadKeypair: stealth.payloadKeypair}).payloadKeypair);
    });

  });

  describe('#fromAddressBuffer', function() {

    it('should give a stealth address with the right pubkeys', function() {
      var stealth2 = new Stealth();
      var buf = base58check.decode(addressString);
      stealth2.fromAddressBuffer(buf);
      stealth2.payloadKeypair.pubkey.toString().should.equal(stealth.payloadKeypair.pubkey.toString());
      stealth2.scanKeypair.pubkey.toString().should.equal(stealth.scanKeypair.pubkey.toString());
    });

  });

  describe('#fromAddressString', function() {

    it('should give a stealth address with the right pubkeys', function() {
      var stealth2 = new Stealth();
      stealth2.fromAddressString(addressString);
      stealth2.payloadKeypair.pubkey.toString().should.equal(stealth.payloadKeypair.pubkey.toString());
      stealth2.scanKeypair.pubkey.toString().should.equal(stealth.scanKeypair.pubkey.toString());
    });

  });

  describe('#fromRandom', function() {

    it('should create a new stealth from random', function() {
      var stealth = Stealth().fromRandom();
      should.exist(stealth.payloadKeypair.privkey.bn.gt(0));
      should.exist(stealth.scanKeypair.privkey.bn.gt(0));
    });

  });

  describe('#getSharedKeypairAsReceiver', function() {

    it('should return a key', function() {
      var key = stealth.getSharedKeypairAsReceiver(senderKeypair.pubkey);
      (key instanceof Keypair).should.equal(true);
    });

  });

  describe('#getSharedKeypairAsSender', function() {

    it('should return a key', function() {
      var stealth2 = new Stealth();
      stealth2.payloadKeypair = new Keypair();
      stealth2.payloadKeypair.pubkey = stealth.payloadKeypair.pubkey;
      stealth2.scanKeypair = new Keypair();
      stealth2.scanKeypair.pubkey = stealth.scanKeypair.pubkey;
      var key = stealth2.getSharedKeypairAsSender(senderKeypair);
      (key instanceof Keypair).should.equal(true);
    });

    it('should return the same key as getSharedKeypairAsReceiver', function() {
      var stealth2 = new Stealth();
      stealth2.payloadKeypair = new Keypair();
      stealth2.payloadKeypair.pubkey = stealth.payloadKeypair.pubkey;
      stealth2.scanKeypair = new Keypair();
      stealth2.scanKeypair.pubkey = stealth.scanKeypair.pubkey;
      var key = stealth2.getSharedKeypairAsSender(senderKeypair);

      var key2 = stealth.getSharedKeypairAsReceiver(senderKeypair.pubkey);
      key.toString().should.equal(key2.toString());
    });

  });

  describe('#getReceivePubkeyAsReceiver', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealth.getReceivePubkeyAsReceiver(senderKeypair.pubkey);
      (pubkey instanceof Pubkey).should.equal(true);
    });

  });

  describe('#getReceivePubkeyAsSender', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealth.getReceivePubkeyAsSender(senderKeypair);
      (pubkey instanceof Pubkey).should.equal(true);
    });

    it('should return the same pubkey as getReceivePubkeyAsReceiver', function() {
      var pubkey = stealth.getReceivePubkeyAsSender(senderKeypair);
      var pubkey2 = stealth.getReceivePubkeyAsReceiver(senderKeypair.pubkey);
      pubkey2.toString().should.equal(pubkey.toString());
    });

  });

  describe('#getReceiveKeypair', function() {

    it('should return a key', function() {
      var key = stealth.getReceiveKeypair(senderKeypair.pubkey);
      (key instanceof Keypair).should.equal(true);
    });

    it('should return a key with the same pubkey as getReceivePubkeyAsReceiver', function() {
      var key = stealth.getReceiveKeypair(senderKeypair.pubkey);
      var pubkey = stealth.getReceivePubkeyAsReceiver(senderKeypair.pubkey);
      key.pubkey.toString().should.equal(pubkey.toString());
    });

    it('should return private key with length 32 or less', function() {
      var key = stealth.getReceiveKeypair(senderKeypair.pubkey);
      key.privkey.bn.toBuffer().length.should.be.below(33);
    });

  });

  describe('#isForMe', function() {

    it('should return true if it (the transaction or message) is for me', function() {
      var pubkeyhash = new Buffer('3cb64fa6ee9b3e8754e3e2bd033bf61048604a99', 'hex');
      stealth.isForMe(senderKeypair.pubkey, pubkeyhash).should.equal(true);
    });

    it('should return false if it (the transaction or message) is not for me', function() {
      var pubkeyhash = new Buffer('00b64fa6ee9b3e8754e3e2bd033bf61048604a99', 'hex');
      stealth.isForMe(senderKeypair.pubkey, pubkeyhash).should.equal(false);
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
