var should = require('chai').should();
var constants = require('../lib/constants');
var Pubkey = require('../lib/pubkey');
var Identity = require('../lib/identity');
var Script = require('../lib/script');

describe('Identity', function() {
  
  var pubkeyhash = new Buffer('3c3fa3d4adcaf8f52d5b1843975e122548269937', 'hex');
  var buf = Buffer.concat([new Buffer([0]), pubkeyhash]);
  var str = 'sMKQzi3RTDK8zRRimoPZQGw4sfsj9Ttx1';

  it('should create a new identity object', function() {
    var identity = new Identity();
    should.exist(identity);
    identity = Identity(buf);
    should.exist(identity);
    identity = Identity(str);
    should.exist(identity);
  });

  describe('@isValid', function() {

    it('should validate this valid identity string', function() {
      Identity.isValid(str).should.equal(true);
    });

    it('should invalidate this valid identity string', function() {
      Identity.isValid(str.substr(1)).should.equal(false);
    });

  });

  describe('#fromBuffer', function() {
    
    it('should make an identity from a buffer', function() {
      Identity().fromBuffer(buf).toString().should.equal(str);
    });

  });

  describe('#fromHashbuf', function() {
    
    it('should make an identity from a hashbuf', function() {
      Identity().fromHashbuf(pubkeyhash).toString().should.equal(str);
      var a = Identity().fromHashbuf(pubkeyhash, 'testnet', 'scripthash');
      a.networkstr.should.equal('testnet');
      a.typestr.should.equal('identephem');
    });

    it('should throw an error for invalid length hashbuf', function() {
      (function() {
        Identity().fromHashbuf(buf);
      }).should.throw('hashbuf must be exactly 20 bytes');
    });

  });

  describe('#fromPubkey', function() {

    it('should make this identity from a compressed pubkey', function() {
      var pubkey = new Pubkey();
      pubkey.fromDER(new Buffer('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004', 'hex'));
      var identity = new Identity();
      identity.fromPubkey(pubkey);
      identity.toString().should.equal('19gH5uhqY6DKrtkU66PsZPUZdzTd11Y7ke');
    });

    it('should make this identity from an uncompressed pubkey', function() {
      var pubkey = new Pubkey();
      pubkey.fromDER(new Buffer('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004', 'hex'));
      var identity = new Identity();
      pubkey.compressed = false;
      identity.fromPubkey(pubkey, 'mainnet');
      identity.toString().should.equal('16JXnhxjJUhxfyx4y6H4sFcxrgt8kQ8ewX');
    });

  });

  describe('#fromScript', function() {

    it('should make this identity from a script', function() {
      var script = Script().fromString("OP_CHECKMULTISIG");
      var identity = Identity().fromScript(script);
      identity.toString().should.equal('3BYmEwgV2vANrmfRymr1mFnHXgLjD6gAWm');
    });

    it('should make this identity from other script', function() {
      var script = Script().fromString("OP_CHECKSIG OP_HASH160");
      var identity = Identity().fromScript(script);
      identity.toString().should.equal('347iRqVwks5r493N1rsLN4k9J7Ljg488W7');
    });

  });

  describe('#fromString', function() {
    
    it('should derive from this known identity string mainnet', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.toBuffer().slice(1).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

    it('should derive from this known identity string testnet', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.networkstr = 'testnet';
      identity.fromString(identity.toString());
      identity.toString().should.equal('mm1X5M2QWyHVjn7txrF7mmtZDpjCXzoa98');
    });

    it('should derive from this known identity string mainnet scripthash', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.networkstr = 'mainnet';
      identity.typestr = 'identephem';
      identity.fromString(identity.toString());
      identity.toString().should.equal('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
    });

    it('should derive from this known identity string testnet scripthash', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.networkstr = 'testnet';
      identity.typestr = 'identephem';
      identity.fromString(identity.toString());
      identity.toString().should.equal('2MxjnmaMtsJfyFcyG3WZCzS2RihdNuWqeX4');
    });

  });

  describe('#isValid', function() {
    
    it('should describe this valid identity as valid', function() {
      var identity = new Identity();
      identity.fromString('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
      identity.isValid().should.equal(true);
    });

    it('should describe this identity with unknown network as invalid', function() {
      var identity = new Identity();
      identity.fromString('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
      identity.networkstr = 'unknown';
      identity.isValid().should.equal(false);
    });

    it('should describe this identity with unknown type as invalid', function() {
      var identity = new Identity();
      identity.fromString('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
      identity.typestr = 'unknown';
      identity.isValid().should.equal(false);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known hash', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.toBuffer().slice(1).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

  });

  describe('#toString', function() {
    
    it('should output the same thing that was input', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.toString().should.equal(str);
    });

  });

  describe('#validate', function() {
    
    it('should not throw an error on this valid identity', function() {
      var identity = new Identity();
      identity.fromString(str);
      should.exist(identity.validate());
    });

    it('should throw an error on this invalid network', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.networkstr = 'unknown';
      (function() {
        identity.validate();
      }).should.throw('networkstr must be "mainnet" or "testnet"');
    });

    it('should throw an error on this invalid type', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.typestr = 'unknown';
      (function() {
        identity.validate();
      }).should.throw('typestr must be "identephem" or "identpersist"');
    });

  });

});
