var should = require('chai').should();
var bn = require('../lib/bn');
var point = require('../lib/point');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var Key = require('../lib/key');

describe('key', function() {
  
  it('should make a blank key', function() {
    var key = new Key();
    should.exist(key);
  });

  it('should make a key with a priv and pub', function() {
    var priv = new Privkey();
    var pub = new Pubkey();
    var key = new Key(priv, pub);
    should.exist(key);
    should.exist(key.privkey);
    should.exist(key.pubkey);
  });

  describe("#fromRandom", function() {
    
    it('should make a new priv and pub', function() {
      var key = new Key();
      key.fromRandom();
      should.exist(key.privkey);
      should.exist(key.pubkey);
      key.privkey.bn.gt(bn(0)).should.equal(true);
      key.pubkey.point.getX().gt(bn(0)).should.equal(true);
      key.pubkey.point.getY().gt(bn(0)).should.equal(true);
    });

  });

  describe("#fromString()", function() {
    
    it('should recover a key creating with toString', function() {
      var key = new Key();
      key.fromRandom();
      var priv = key.privkey;
      var pub = key.pubkey;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.privkey);
      should.exist(key.pubkey);
      key.privkey.toString().should.equal(priv.toString());
      key.pubkey.toString().should.equal(pub.toString());
    });

    it('should work with only Privkey set', function() {
      var key = new Key();
      key.fromRandom();
      key.pubkey = undefined;
      var priv = key.privkey;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.privkey);
      key.privkey.toString().should.equal(priv.toString());
    });

    it('should work with only Pubkey set', function() {
      var key = new Key();
      key.fromRandom();
      key.privkey = undefined;
      var pub = key.pubkey;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.pubkey);
      key.pubkey.toString().should.equal(pub.toString());
    });

  });

  describe("#privkey2pubkey", function() {
    
    it('should convert this known Privkey to known Pubkey', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var pubhex = '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc';
      var key = new Key();
      key.privkey = new Privkey(bn(new Buffer(privhex, 'hex')));
      key.privkey2pubkey();
      key.pubkey.toString().should.equal(pubhex);
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
