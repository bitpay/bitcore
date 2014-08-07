var should = require('chai').should();
var constants = require('../lib/constants');
var Address = require('../lib/address');

describe('Address', function() {
  var pubkeyhash = new Buffer('3c3fa3d4adcaf8f52d5b1843975e122548269937', 'hex');
  var str = '1Cs8a3b7R5n4G9c8Cgbp9iW8BXbhv3SFt6';

  it('should create a new address object', function() {
    var address = new Address();
    should.exist(address);
  });

  it('should throw an error when input is not a string', function() {
    (function() {
      var address = new Address(5);
    }).should.throw('address: Input must be a string, or undefined');
  });

  describe('#getNetwork', function() {
    
    it('should return mainnet for pubkeyhash', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([constants.mainnet.pubkeyHash]), pubkeyhash]);
      address.getNetwork().should.equal('mainnet');
    });

    it('should return mainnet for p2sh', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([constants.mainnet.p2sh]), pubkeyhash]);
      address.getNetwork().should.equal('mainnet');
    });

    it('should return testnet for pubkeyhash', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([constants.testnet.pubkeyHash]), pubkeyhash]);
      address.getNetwork().should.equal('testnet');
    });

    it('should return testnet for p2sh', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([constants.testnet.p2sh]), pubkeyhash]);
      address.getNetwork().should.equal('testnet');
    });

    it('should return unknown', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([0x55]), pubkeyhash]);
      address.getNetwork().should.equal('unknown');
    });

    it('should throw an error if there is no buffer', function() {
      var address = new Address();
      (function() {
        address.getNetwork();
      }).should.throw();
    });

  });

  describe('#getHash', function() {
    
    it('should return the hash', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([0x00]), pubkeyhash]);
      address.getHash().toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

    it('should throw an error if the buffer is an invalid length', function() {
      var address = new Address();
      address.buf = Buffer.concat([new Buffer([0x00]), pubkeyhash.slice(-1)]);
      (function() {
        address.getHash();
      }).should.throw('address: Hash must be exactly 20 bytes');
    });

  });

  describe('#getType', function() {

    it('should get the type of 2MxjnmaMtsJfyFcyG3WZCzS2RihdNuWqeX4 correctly', function() {
      var addr = new Address();
      addr.fromString('2MxjnmaMtsJfyFcyG3WZCzS2RihdNuWqeX4');
      addr.getNetwork().should.equal('testnet');
      addr.getType().should.equal('p2sh');
    });

  });

  describe('#setBuf', function() {
    
    it('should convert this pubkeyhash on mainnet and type pubkeyHash to known address', function() {
      var address = new Address();
      address.setBuf(pubkeyhash, 'mainnet', 'pubkeyHash');
      address.toString().should.equal('16VZnHwRhwrExfeHFHGjwrgEMq8VcYPs9r');
    });

    it('should convert this pubkeyhash on mainnet and type p2sh to known address', function() {
      var address = new Address();
      address.setBuf(pubkeyhash, 'mainnet', 'p2sh');
      address.toString().should.equal('37BahqRsFrAd3qLiNNwLNV3AWMRD7itxTo');
    });

    it('should convert this pubkeyhash on testnet and type pubkeyHash to known address', function() {
      var address = new Address();
      address.setBuf(pubkeyhash, 'testnet', 'pubkeyHash');
      address.toString().should.equal('mm1X5M2QWyHVjn7txrF7mmtZDpjCXzoa98');
    });

    it('should convert this pubkeyhash on testnet and type p2sh to known address', function() {
      var address = new Address();
      address.setBuf(pubkeyhash, 'testnet', 'p2sh');
      address.toString().should.equal('2MxjnmaMtsJfyFcyG3WZCzS2RihdNuWqeX4');
    });

    it('should throw an error for an unknown type', function() {
      var address = new Address();
      (function() {
        address.setBuf(pubkeyhash, 'testnet', 'p2sh2');
      }).should.throw();
    });

    it('should throw an error for an unknown network', function() {
      var address = new Address();
      (function() {
        address.setBuf(pubkeyhash, 'testnet2', 'p2sh');
      }).should.throw();
    });

  });

  describe('#fromString', function() {

    it('should decode 1Cs8a3b7R5n4G9c8Cgbp9iW8BXbhv3SFt6 correctly', function() {
      var addr = new Address();
      addr.fromString('1Cs8a3b7R5n4G9c8Cgbp9iW8BXbhv3SFt6');
      addr.getHash().toString('hex').should.equal('82248027cfb0fe085b750f359fd1e43234e46c7f');
    });

  });

  describe('#toString', function() {

    it('should return 1Cs8a3b7R5n4G9c8Cgbp9iW8BXbhv3SFt6', function() {
      var addr = new Address();
      addr.fromString('1Cs8a3b7R5n4G9c8Cgbp9iW8BXbhv3SFt6');
      addr.toString().should.equal('1Cs8a3b7R5n4G9c8Cgbp9iW8BXbhv3SFt6');
    });

  });

});
