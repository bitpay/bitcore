var should = require('chai').should();
var bn = require('../lib/bn');
var point = require('../lib/point');
var privkey = require('../lib/privkey');
var pubkey = require('../lib/pubkey');
var Key = require('../lib/key');

describe('key', function() {
  
  it('should make a blank key', function() {
    var key = new Key();
    should.exist(key);
  });

  it('should make a key with a priv and pub', function() {
    var priv = new privkey();
    var pub = new pubkey();
    var key = new Key(priv, pub);
    should.exist(key);
    should.exist(key.priv);
    should.exist(key.pub);
  });

  describe("#fromRandom", function() {
    
    it('should make a new priv and pub', function() {
      var key = new Key();
      key.fromRandom();
      should.exist(key.priv);
      should.exist(key.pub);
      key.priv.n.gt(bn(0)).should.equal(true);
      key.pub.p.getX().gt(bn(0)).should.equal(true);
      key.pub.p.getY().gt(bn(0)).should.equal(true);
    });

  });

  describe("#fromString()", function() {
    
    it('should recover a key creating with toString', function() {
      var key = new Key();
      key.fromRandom();
      var priv = key.priv;
      var pub = key.pub;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.priv);
      should.exist(key.pub);
      key.priv.toString().should.equal(priv.toString());
      key.pub.toString().should.equal(pub.toString());
    });

    it('should work with only privkey set', function() {
      var key = new Key();
      key.fromRandom();
      key.pub = undefined;
      var priv = key.priv;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.priv);
      key.priv.toString().should.equal(priv.toString());
    });

    it('should work with only pubkey set', function() {
      var key = new Key();
      key.fromRandom();
      key.priv = undefined;
      var pub = key.pub;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.pub);
      key.pub.toString().should.equal(pub.toString());
    });

  });

  describe("#priv2pub", function() {
    
    it('should convert this known privkey to known pubkey', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var key = new Key();
      key.priv = new privkey(bn(new Buffer(privhex, 'hex')));
      key.priv2pub();
      key.pub.toString().should.equal(pubhex);
    });

  });

  describe("#toString()", function() {
    
    it('should exist', function() {
      var key = new Key();
      key.fromRandom();
      should.exist(key.toString());
    });

  });

});
