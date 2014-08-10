var ECDSA = require('../lib/ecdsa');
var Hash = require('../lib/hash');
var Key = require('../lib/key');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var bn = require('../lib/bn');
var point = require('../lib/point');
var should = require('chai').should();

describe("ecdsa", function() {

  it('should create a blank ecdsa', function() {
    var ecdsa = new ECDSA();
  });

  var ecdsa = new ECDSA();
  ecdsa.hash = Hash.sha256(new Buffer('test data'));
  ecdsa.key = new Key();
  ecdsa.key.privkey = new Privkey(bn.fromBuffer(new Buffer('fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e', 'hex')));
  ecdsa.key.pubkey = new Pubkey(point(bn.fromBuffer(new Buffer('ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2', 'hex')),
                                      bn.fromBuffer(new Buffer('4836ab292c105a711ed10fcfd30999c31ff7c02456147747e03e739ad527c380', 'hex'))));

  describe('#signRandomK', function() {

    it('should produce a signature', function() {
      ecdsa.signRandomK();
      should.exist(ecdsa.sig);
    });

  });

  describe('#verify', function() {
    
    it('should verify a signature that was just signed', function() {
      ecdsa.signRandomK();
      ecdsa.verify().should.equal(true);
    });

  });

});
