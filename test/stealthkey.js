var should = require('chai').should();
var Stealthkey = require('../lib/expmt/stealthkey');
var Keypair = require('../lib/keypair');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var BN = require('../lib/bn');
var Hash = require('../lib/hash');

describe('Stealthkey', function() {
  
  var stealthkey = Stealthkey();
  stealthkey.payloadKeypair = Keypair();
  stealthkey.payloadKeypair.privkey = Privkey();
  stealthkey.payloadKeypair.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 1')));
  stealthkey.payloadKeypair.privkey2pubkey();
  stealthkey.scanKeypair = Keypair();
  stealthkey.scanKeypair.privkey = Privkey();
  stealthkey.scanKeypair.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 2')));
  stealthkey.scanKeypair.privkey2pubkey();

  var senderKeypair = Keypair();
  senderKeypair.privkey = Privkey();
  senderKeypair.privkey.bn = BN().fromBuffer(Hash.sha256(new Buffer('test 3')));
  senderKeypair.privkey2pubkey();

  it('should create a new stealthkey', function() {
    var stealthkey = new Stealthkey();
    should.exist(stealthkey);
  });

  it('should create a new stealthkey without using "new"', function() {
    var stealthkey = Stealthkey();
    should.exist(stealthkey);
  });

  it('should create a new stealthkey with both keypairs in the constructor', function() {
    var keypair1 = Keypair();
    var keypair2 = Keypair();
    var stealthkey = Stealthkey(keypair1, keypair2);
    should.exist(stealthkey.payloadKeypair);
    should.exist(stealthkey.scanKeypair);
  });

  describe('#set', function() {

    it('should set payload key', function() {
      should.exist(Stealthkey().set({payloadKeypair: stealthkey.payloadKeypair}).payloadKeypair);
    });

  });

  describe('#fromJSON', function() {
    
    it('should make a stealthkey from this JSON', function() {
      var sk = Stealthkey().fromJSON({
        payloadKeypair: stealthkey.payloadKeypair.toJSON(),
        scanKeypair: stealthkey.scanKeypair.toJSON()
      });
      sk.payloadKeypair.toString().should.equal(stealthkey.payloadKeypair.toString());
      sk.scanKeypair.toString().should.equal(stealthkey.scanKeypair.toString());
    });

  });

  describe('#toJSON', function() {
    
    it('should convert this stealthkey to json', function() {
      var json = stealthkey.toJSON()
      var json2 = Stealthkey().fromJSON(json).toJSON();
      json.payloadKeypair.privkey.should.equal(json2.payloadKeypair.privkey);
      json.scanKeypair.privkey.should.equal(json2.scanKeypair.privkey);
    });

  });

  describe('#fromRandom', function() {

    it('should create a new stealthkey from random', function() {
      var stealthkey = Stealthkey().fromRandom();
      should.exist(stealthkey.payloadKeypair.privkey.bn.gt(0));
      should.exist(stealthkey.scanKeypair.privkey.bn.gt(0));
    });

  });

  describe('#getSharedKeypair', function() {

    it('should return a key', function() {
      var key = stealthkey.getSharedKeypair(senderKeypair.pubkey);
      (key instanceof Keypair).should.equal(true);
    });

  });

  describe('#getReceivePubkey', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealthkey.getReceivePubkey(senderKeypair.pubkey);
      (pubkey instanceof Pubkey).should.equal(true);
    });

  });

  describe('#getReceiveKeypair', function() {

    it('should return a key', function() {
      var key = stealthkey.getReceiveKeypair(senderKeypair.pubkey);
      (key instanceof Keypair).should.equal(true);
    });

    it('should return a key with the same pubkey as getReceivePubkey', function() {
      var key = stealthkey.getReceiveKeypair(senderKeypair.pubkey);
      var pubkey = stealthkey.getReceivePubkey(senderKeypair.pubkey);
      key.pubkey.toString().should.equal(pubkey.toString());
    });

    it('should return private key with length 32 or less', function() {
      var key = stealthkey.getReceiveKeypair(senderKeypair.pubkey);
      key.privkey.bn.toBuffer().length.should.be.below(33);
    });

  });

  describe('#isForMe', function() {

    it('should return true if it (the transaction or message) is for me', function() {
      var pubkeyhash = new Buffer('3cb64fa6ee9b3e8754e3e2bd033bf61048604a99', 'hex');
      stealthkey.isForMe(senderKeypair.pubkey, pubkeyhash).should.equal(true);
    });

    it('should return false if it (the transaction or message) is not for me', function() {
      var pubkeyhash = new Buffer('00b64fa6ee9b3e8754e3e2bd033bf61048604a99', 'hex');
      stealthkey.isForMe(senderKeypair.pubkey, pubkeyhash).should.equal(false);
    });

  });

});
