var should = require('chai').should();
var bn = require('../lib/bn');
var point = require('../lib/point');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var Keypair = require('../lib/keypair');

describe('Keypair', function() {
  
  it('should make a blank key', function() {
    var key = new Keypair();
    should.exist(key);
  });

  it('should make a key with a priv and pub', function() {
    var priv = new Privkey();
    var pub = new Pubkey();
    var key = new Keypair({privkey: priv, pubkey: pub});
    should.exist(key);
    should.exist(key.privkey);
    should.exist(key.pubkey);
  });

  describe("#set", function() {
    
    it('should make a new priv and pub', function() {
      should.exist(Keypair().set({privkey: Privkey()}).privkey);
    });

  });

  describe('#fromJSON', function() {

    it('should make a keypair from this json', function() {
      var privkey = Privkey().fromRandom();
      var pubkey = Pubkey().fromPrivkey(privkey);
      var keypair = Keypair().fromJSON({
        privkey: privkey.toJSON(),
        pubkey: pubkey.toJSON()
      })
      keypair.privkey.toString().should.equal(privkey.toString());
      keypair.pubkey.toString().should.equal(pubkey.toString());
    });

  });

  describe('#toJSON', function() {

    it('should make json from this keypair', function() {
      var json = Keypair().fromRandom().toJSON();
      should.exist(json.privkey);
      should.exist(json.pubkey);
      var keypair = Keypair().fromJSON(json);
      keypair.toJSON().privkey.toString().should.equal(json.privkey.toString());
      keypair.toJSON().pubkey.toString().should.equal(json.pubkey.toString());
    });

  });

  describe("#fromPrivkey", function() {
    
    it('should make a new key from a privkey', function() {
      should.exist(Keypair().fromPrivkey(Privkey().fromRandom()).pubkey);
    });

  });

  describe("#fromRandom", function() {
    
    it('should make a new priv and pub, should be compressed, mainnet', function() {
      var key = new Keypair();
      key.fromRandom();
      should.exist(key.privkey);
      should.exist(key.pubkey);
      key.privkey.bn.gt(bn(0)).should.equal(true);
      key.pubkey.point.getX().gt(bn(0)).should.equal(true);
      key.pubkey.point.getY().gt(bn(0)).should.equal(true);
      key.privkey.compressed.should.equal(true);
      key.privkey.networkstr.should.equal('mainnet');
      key.pubkey.compressed.should.equal(true);
    });

  });

  describe("#fromString()", function() {
    
    it('should recover a key creating with toString', function() {
      var key = new Keypair();
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
      var key = new Keypair();
      key.fromRandom();
      key.pubkey = undefined;
      var priv = key.privkey;
      var str = key.toString();
      key.fromString(str);
      should.exist(key.privkey);
      key.privkey.toString().should.equal(priv.toString());
    });

    it('should work with only Pubkey set', function() {
      var key = new Keypair();
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
      var key = new Keypair();
      key.privkey = new Privkey({bn: bn(new Buffer(privhex, 'hex'))});
      key.privkey2pubkey();
      key.pubkey.toString().should.equal(pubhex);
    });

    it('should convert this known Privkey to known Pubkey and preserve compressed=true', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var key = new Keypair();
      key.privkey = new Privkey({bn: bn(new Buffer(privhex, 'hex'))});
      key.privkey.compressed = true;
      key.privkey2pubkey();
      key.pubkey.compressed.should.equal(true);
    });

    it('should convert this known Privkey to known Pubkey and preserve compressed=true', function() {
      var privhex = '906977a061af29276e40bf377042ffbde414e496ae2260bbf1fa9d085637bfff';
      var key = new Keypair();
      key.privkey = new Privkey({bn: bn(new Buffer(privhex, 'hex'))});
      key.privkey.compressed = false;
      key.privkey2pubkey();
      key.pubkey.compressed.should.equal(false);
    });

  });

  describe("#toString()", function() {
    
    it('should exist', function() {
      var key = new Keypair();
      key.fromRandom();
      should.exist(key.toString());
    });

  });

});
