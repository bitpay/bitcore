var should = require('chai').should();
var constants = require('../lib/constants');
var Pubkey = require('../lib/pubkey');
var Address = require('../lib/address');

describe('Address', function() {
  var pubkeyhash = new Buffer('3c3fa3d4adcaf8f52d5b1843975e122548269937', 'hex');
  var str = '16VZnHwRhwrExfeHFHGjwrgEMq8VcYPs9r';

  it('should create a new address object', function() {
    var address = new Address();
    should.exist(address);
  });

  describe('@validate', function() {

    it('should validate this valid address string', function() {
      should.exist(Address.validate(str))
    });

  });

  describe('#fromPubkey', function() {

    it('should make this address from a compressed pubkey', function() {
      var pubkey = new Pubkey();
      pubkey.fromDER(new Buffer('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004', 'hex'));
      var address = new Address();
      address.fromPubkey(pubkey);
      address.toString().should.equal('19gH5uhqY6DKrtkU66PsZPUZdzTd11Y7ke');
    });

    it('should make this address from an uncompressed pubkey', function() {
      var pubkey = new Pubkey();
      pubkey.fromDER(new Buffer('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004', 'hex'));
      var address = new Address();
      pubkey.compressed = false;
      address.fromPubkey(pubkey, 'mainnet');
      address.toString().should.equal('16JXnhxjJUhxfyx4y6H4sFcxrgt8kQ8ewX');
    });

  });

  describe('#fromString', function() {
    
    it('should derive from this known address string mainnet', function() {
      var address = new Address();
      address.fromString(str);
      address.toBuffer().slice(1).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

    it('should derive from this known address string testnet', function() {
      var address = new Address();
      address.fromString(str);
      address.networkstr = 'testnet';
      address.fromString(address.toString());
      address.toString().should.equal('mm1X5M2QWyHVjn7txrF7mmtZDpjCXzoa98');
    });

    it('should derive from this known address string mainnet p2sh', function() {
      var address = new Address();
      address.fromString(str);
      address.networkstr = 'mainnet';
      address.typestr = 'p2sh';
      address.fromString(address.toString());
      address.toString().should.equal('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
    });

    it('should derive from this known address string testnet p2sh', function() {
      var address = new Address();
      address.fromString(str);
      address.networkstr = 'testnet';
      address.typestr = 'p2sh';
      address.fromString(address.toString());
      address.toString().should.equal('2MxjnmaMtsJfyFcyG3WZCzS2RihdNuWqeX4');
    });

  });

  describe('#isValid', function() {
    
    it('should describe this valid address as valid', function() {
      var address = new Address();
      address.fromString('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
      address.isValid().should.equal(true);
    });

    it('should describe this address with unknown network as invalid', function() {
      var address = new Address();
      address.fromString('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
      address.networkstr = 'unknown';
      address.isValid().should.equal(false);
    });

    it('should describe this address with unknown type as invalid', function() {
      var address = new Address();
      address.fromString('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
      address.typestr = 'unknown';
      address.isValid().should.equal(false);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known hash', function() {
      var address = new Address();
      address.fromString(str);
      address.toBuffer().slice(1).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

  });

  describe('#toString', function() {
    
    it('should output the same thing that was input', function() {
      var address = new Address();
      address.fromString(str);
      address.toString().should.equal(str);
    });

  });

  describe('#validate', function() {
    
    it('should not throw an error on this valid address', function() {
      var address = new Address();
      address.fromString(str);
      should.exist(address.validate());
    });

    it('should throw an error on this invalid network', function() {
      var address = new Address();
      address.fromString(str);
      address.networkstr = 'unknown';
      (function() {
        address.validate();
      }).should.throw('networkstr must be "mainnet" or "testnet"');
    });

    it('should throw an error on this invalid type', function() {
      var address = new Address();
      address.fromString(str);
      address.typestr = 'unknown';
      (function() {
        address.validate();
      }).should.throw('typestr must be "pubkeyhash" or "p2sh"');
    });

  });

});
