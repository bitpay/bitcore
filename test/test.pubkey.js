var should = require('chai').should();
var pubkey = require('../lib/pubkey');
var point = require('../lib/point');
var bn = require('../lib/bn');

describe('pubkey', function() {
  
  it('should create a blank public key', function() {
    var pk = new pubkey();
    should.exist(pk);
  });

  it('should create a public key with a point', function() {
    var p = point();
    var pk = new pubkey(p);
    should.exist(pk.p);
  });

  describe('#fromDER', function() {
    
    it('should parse this uncompressed public key', function() {
      var pk = new pubkey();
      pk.fromDER(new Buffer('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341', 'hex'));
      pk.p.getX().toString(16).should.equal('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a');
      pk.p.getY().toString(16).should.equal('7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341');
    });

    it('should parse this compressed public key', function() {
      var pk = new pubkey();
      pk.fromDER(new Buffer('031ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a', 'hex'));
      pk.p.getX().toString(16).should.equal('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a');
      pk.p.getY().toString(16).should.equal('7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341');
    });

    it('should throw an error on this invalid public key', function() {
      var pk = new pubkey();
      (function() {
        pk.fromDER(new Buffer('091ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a', 'hex'));
      }).should.throw();
    });

  });

  describe('#fromString', function() {

    it('should parse this known valid public key', function() {
      pk = new pubkey();
      pk.fromString('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341');
      pk.p.getX().toString(16).should.equal('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a');
      pk.p.getY().toString(16).should.equal('7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341');
    });

  });

  describe('#fromX', function() {
    
    it('should create this known public key', function() {
      var x = bn.fromBuffer(new Buffer('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a', 'hex'));
      var pk = new pubkey();
      pk.fromX(true, x);
      pk.p.getX().toString(16).should.equal('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a');
      pk.p.getY().toString(16).should.equal('7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341');
    });

  });

  describe('#toDER', function() {

    it('should return this compressed DER format', function() {
      var x = bn.fromBuffer(new Buffer('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a', 'hex'));
      var pk = new pubkey();
      pk.fromX(true, x);
      pk.toDER(true).toString('hex').should.equal('031ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a');
    });

    it('should return this uncompressed DER format', function() {
      var x = bn.fromBuffer(new Buffer('1ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a', 'hex'));
      var pk = new pubkey();
      pk.fromX(true, x);
      pk.toDER(false).toString('hex').should.equal('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341');
    });

  });

  describe('#toString', function() {
    
    it('should print this known public key', function() {
      var hex = '031ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a';
      var pk = new pubkey();
      pk.fromString(hex);
      pk.toString().should.equal(hex);
    });

  });

  describe('#validate', function() {

    it('should not throw an error if pubkey is valid', function() {
      var hex = '031ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a';
      var pk = new pubkey();
      pk.fromString(hex);
      should.exist(pk.validate());
    });
    
    it('should not throw an error if pubkey is invalid', function() {
      var hex = '041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a0000000000000000000000000000000000000000000000000000000000000000';
      var pk = new pubkey();
      pk.fromString(hex);
      (function() {
        pk.validate();
      }).should.throw('point: Invalid y value of public key');
    });
    
    it('should not throw an error if pubkey is infinity', function() {
      var pk = new pubkey();
      pk.p = point.getG().mul(point.getN());
      (function() {
        pk.validate();
      }).should.throw('point: Point cannot be equal to Infinity');
    });
    
  });

});
