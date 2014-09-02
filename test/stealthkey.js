var should = require('chai').should();
var Stealthkey = require('../lib/expmt/stealthkey');
var Keypair = require('../lib/keypair');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var BN = require('../lib/bn');
var Hash = require('../lib/hash');
var base58check = require('../lib/base58check');

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

  var addressString = '9dDbC9FzZ74r8njQkXD6W27gtrxLiWaeFPHxeo1fynQRXPicqxVt7u95ozbwoVVMXyrzaHKN9owsteg63FgwDfrxWx82SAW';

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

  describe('#fromRandom', function() {

    it('should create a new stealthkey from random', function() {
      var stealthkey = Stealthkey().fromRandom();
      should.exist(stealthkey.payloadKeypair.privkey.bn.gt(0));
      should.exist(stealthkey.scanKeypair.privkey.bn.gt(0));
    });

  });

  describe('#getSharedKeypairAsReceiver', function() {

    it('should return a key', function() {
      var key = stealthkey.getSharedKeypairAsReceiver(senderKeypair.pubkey);
      (key instanceof Keypair).should.equal(true);
    });

  });

  describe('#getSharedKeypairAsSender', function() {

    it('should return a key', function() {
      var stealthkey2 = new Stealthkey();
      stealthkey2.payloadKeypair = new Keypair();
      stealthkey2.payloadKeypair.pubkey = stealthkey.payloadKeypair.pubkey;
      stealthkey2.scanKeypair = new Keypair();
      stealthkey2.scanKeypair.pubkey = stealthkey.scanKeypair.pubkey;
      var key = stealthkey2.getSharedKeypairAsSender(senderKeypair);
      (key instanceof Keypair).should.equal(true);
    });

    it('should return the same key as getSharedKeypairAsReceiver', function() {
      var stealthkey2 = new Stealthkey();
      stealthkey2.payloadKeypair = new Keypair();
      stealthkey2.payloadKeypair.pubkey = stealthkey.payloadKeypair.pubkey;
      stealthkey2.scanKeypair = new Keypair();
      stealthkey2.scanKeypair.pubkey = stealthkey.scanKeypair.pubkey;
      var key = stealthkey2.getSharedKeypairAsSender(senderKeypair);

      var key2 = stealthkey.getSharedKeypairAsReceiver(senderKeypair.pubkey);
      key.toString().should.equal(key2.toString());
    });

  });

  describe('#getReceivePubkeyAsReceiver', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealthkey.getReceivePubkeyAsReceiver(senderKeypair.pubkey);
      (pubkey instanceof Pubkey).should.equal(true);
    });

  });

  describe('#getReceivePubkeyAsSender', function() {
    
    it('should return a pubkey', function() {
      var pubkey = stealthkey.getReceivePubkeyAsSender(senderKeypair);
      (pubkey instanceof Pubkey).should.equal(true);
    });

    it('should return the same pubkey as getReceivePubkeyAsReceiver', function() {
      var pubkey = stealthkey.getReceivePubkeyAsSender(senderKeypair);
      var pubkey2 = stealthkey.getReceivePubkeyAsReceiver(senderKeypair.pubkey);
      pubkey2.toString().should.equal(pubkey.toString());
    });

  });

  describe('#getReceiveKeypair', function() {

    it('should return a key', function() {
      var key = stealthkey.getReceiveKeypair(senderKeypair.pubkey);
      (key instanceof Keypair).should.equal(true);
    });

    it('should return a key with the same pubkey as getReceivePubkeyAsReceiver', function() {
      var key = stealthkey.getReceiveKeypair(senderKeypair.pubkey);
      var pubkey = stealthkey.getReceivePubkeyAsReceiver(senderKeypair.pubkey);
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
