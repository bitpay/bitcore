var StealthAddress = require('../lib/expmt/stealthaddress');
var should = require('chai').should();
var Stealthkey = require('../lib/expmt/stealthkey');
var Keypair = require('../lib/keypair');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var BN = require('../lib/bn');
var Hash = require('../lib/hash');
var Base58check = require('../lib/base58check');

describe('StealthAddress', function() {
  
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
  var dwhex = '2a0002697763d7e9becb0c180083738c32c05b0e2fee26d6278020c06bbb04d5f66b32010362408459041e0473298af3824dbabe4d2b7f846825ed4d1c2e2c670c07cb275d0100';

  it('should make a new stealth address', function() {
    var sa = new StealthAddress();
    should.exist(sa);
    sa = StealthAddress();
    should.exist(sa);
    sa = StealthAddress(addressString);
    should.exist(sa);
    sa = StealthAddress(Base58check.decode(addressString));
    should.exist(sa);
  });

  describe('#fromJSON', function() {

    it('should give a stealthkey address with the right pubkeys', function() {
      var sa = new StealthAddress();
      sa.fromJSON(addressString);
      sa.payloadPubkey.toString().should.equal(stealthkey.payloadKeypair.pubkey.toString());
      sa.scanPubkey.toString().should.equal(stealthkey.scanKeypair.pubkey.toString());
    });

  });

  describe('#toJSON', function() {
    
    it('should return this known address string', function() {
      StealthAddress().fromJSON(addressString).toJSON().should.equal(addressString);
    });

  });

  describe('#fromBitcoreBuffer', function() {

    it('should give a stealthkey address with the right pubkeys', function() {
      var sa = new StealthAddress();
      var buf = Base58check.decode(addressString);
      sa.fromBitcoreBuffer(buf);
      sa.payloadPubkey.toString().should.equal(stealthkey.payloadKeypair.pubkey.toString());
      sa.scanPubkey.toString().should.equal(stealthkey.scanKeypair.pubkey.toString());
    });

  });

  describe('#fromBuffer', function() {

    it('should parse this DW buffer', function() {
      StealthAddress().fromBuffer(new Buffer(dwhex, 'hex')).toBuffer().toString('hex').should.equal(dwhex);
    });

  });

  describe('#fromString', function() {

    it('should parse this DW buffer', function() {
      StealthAddress().fromString(Base58check(new Buffer(dwhex, 'hex')).toString()).toBuffer().toString('hex').should.equal(dwhex);
    });

  });

  describe('#fromBitcoreString', function() {

    it('should give a stealthkey address with the right pubkeys', function() {
      var sa = new StealthAddress();
      sa.fromBitcoreString(addressString);
      sa.payloadPubkey.toString().should.equal(stealthkey.payloadKeypair.pubkey.toString());
      sa.scanPubkey.toString().should.equal(stealthkey.scanKeypair.pubkey.toString());
    });

  });

  describe('#getSharedKeypair', function() {

    it('should return a key', function() {
      var sa = new StealthAddress();
      sa.payloadPubkey = stealthkey.payloadKeypair.pubkey;
      sa.scanPubkey = stealthkey.scanKeypair.pubkey;
      var key = sa.getSharedKeypair(senderKeypair);
      (key instanceof Keypair).should.equal(true);
    });

    it('should return the same key as Stealthkey.prototype.getSharedKeypair', function() {
      var sa = new StealthAddress();
      sa.payloadPubkey = stealthkey.payloadKeypair.pubkey;
      sa.scanPubkey = stealthkey.scanKeypair.pubkey;
      var key = sa.getSharedKeypair(senderKeypair);

      var key2 = stealthkey.getSharedKeypair(senderKeypair.pubkey);
      key.toString().should.equal(key2.toString());
    });

  });

  describe('#getReceivePubkey', function() {
    
    it('should return a pubkey', function() {
      var pubkey = StealthAddress().fromStealthkey(stealthkey).getReceivePubkey(senderKeypair);
      (pubkey instanceof Pubkey).should.equal(true);
    });

    it('should return the same pubkey as getReceivePubkey', function() {
      var pubkey = StealthAddress().fromStealthkey(stealthkey).getReceivePubkey(senderKeypair);
      var pubkey2 = stealthkey.getReceivePubkey(senderKeypair.pubkey);
      pubkey2.toString().should.equal(pubkey.toString());
    });

  });

  describe('#toBitcoreBuffer', function() {
    
    it('should return this known address buffer', function() {
      var buf = Base58check.decode(addressString);
      StealthAddress().fromBitcoreBuffer(buf).toBitcoreBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#toBuffer', function() {
    
    it('should return this known address buffer', function() {
      var buf = Base58check.decode(addressString);
      StealthAddress().fromBitcoreBuffer(buf).toBuffer().toString('hex').should.equal(dwhex);
    });

  });

  describe('#toString', function() {
    
    it('should return this known address buffer', function() {
      var buf = Base58check.decode(addressString);
      StealthAddress().fromBitcoreBuffer(buf).toString().should.equal(Base58check(new Buffer(dwhex, 'hex')).toString());
    });

  });

  describe('#toBitcoreString', function() {
    
    it('should return this known address string', function() {
      StealthAddress().fromBitcoreString(addressString).toBitcoreString().should.equal(addressString);
    });

  });

  describe('@parseDWBuffer', function() {

    it('should parse this known DW buffer', function() {
      var buf = new Buffer(dwhex, 'hex');
      var parsed = StealthAddress.parseDWBuffer(buf);
      parsed.version.should.equal(42);
      parsed.options.should.equal(0);
      parsed.scanPubkey.toString().should.equal('02697763d7e9becb0c180083738c32c05b0e2fee26d6278020c06bbb04d5f66b32');
      parsed.nPayloadPubkeys.should.equal(1);
      parsed.payloadPubkeys[0].toString().should.equal('0362408459041e0473298af3824dbabe4d2b7f846825ed4d1c2e2c670c07cb275d');
      parsed.nSigs.should.equal(1);
      parsed.prefix.toString().should.equal('');
    });

  });

});
