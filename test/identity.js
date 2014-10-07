var should = require('chai').should();
var constants = require('../lib/constants');
var PubKey = require('../lib/pubkey');
var Identity = require('../lib/identity');

describe('Identity', function() {
  
  var knownPrivKey    = 'L3e3ZneXzGw2wyyRoUxKGGrHCBhBE3uPMvQDXPaJTom4d4ogRxvC';
  var knownPubKey     = '02ff0c643214634691e6f1c5044df79f7002c404407c8db1897484017e1082f182';
  var knownPubKeyHash = 'bceb8b52237d7a6c09e9aaedcf26cf387530d23e';
  var knownIdent      = 'TfEmMAA5PSQRRJgiZka8y6B5x1pABHe6BVv';
  var knownIdentComp  = 'TfDBCwB4ciatE4Kx3r1TK5kfCTxrrpG1H8J';
  
  var pubkeyhash = new Buffer( knownPubKeyHash , 'hex');

  //var buf = Buffer.concat([ new Buffer([0]), new Buffer([0]), pubkeyhash ]);
  // note: key is wrong string until I figure out how to duplicate the generation of short keys
  //var buf = Buffer.concat([ new Buffer( 0x0f ) , new Buffer( 0x02 ) , pubkeyhash ])
  var buf = Buffer.concat([ new Buffer([0x0f]) , new Buffer([0x02]) , pubkeyhash ])
  var str = knownIdent;

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
      Identity.isValid( str ).should.equal( true );
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
      a.typestr.should.equal('scripthash');
    });

    it('should throw an error for invalid length hashbuf', function() {
      (function() {
        Identity().fromHashbuf(buf);
      }).should.throw('hashbuf must be exactly 20 bytes');
    });

  });

  describe('#fromPubkey', function() {

    it('should make this identity from a compressed pubkey', function() {
      var pubkey = new PubKey();
      pubkey.fromDER(new Buffer( knownPubKey , 'hex'));
      var identity = new Identity();
      identity.fromPubkey(pubkey);
      identity.toString().should.equal( knownIdent );
    });

    it('should make this identity from an uncompressed pubkey', function() {
      var pubkey = new PubKey();
      pubkey.fromDER(new Buffer( knownPubKey , 'hex'));
      var identity = new Identity();
      pubkey.compressed = false;
      identity.fromPubkey(pubkey, 'ephemeral');
      identity.toString().should.equal( knownIdentComp );
    });

  });

  describe('#fromString', function() {
    
    it('should derive from this known ephemeral identity string', function() {
      var identity = new Identity();
      identity.fromString( str );
      identity.toBuffer().slice(2).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

  });

  describe('#isValid', function() {
    
    it('should describe this valid identity as valid', function() {
      var identity = new Identity();
      identity.fromString( knownIdent );
      identity.isValid().should.equal(true);
    });

    it('should describe this identity with unknown network as invalid', function() {
      var identity = new Identity();
      identity.fromString( knownIdent );
      identity.networkstr = 'unknown';
      identity.isValid().should.equal(false);
    });

    it('should describe this identity with unknown type as invalid', function() {
      var identity = new Identity();
      identity.fromString( knownIdent );
      identity.typestr = 'unknown';
      identity.isValid().should.equal(false);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known hash', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.toBuffer().slice(2).toString('hex').should.equal(pubkeyhash.toString('hex'));
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
      }).should.throw('networkstr must be "ephemeral", "mainnet", or "testnet"');
    });

    it('should throw an error on this invalid type', function() {
      var identity = new Identity();
      identity.fromString(str);
      identity.typestr = 'unknown';
      (function() {
        identity.validate();
      }).should.throw('typestr must be "identity"');
    });

  });

});
