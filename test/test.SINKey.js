'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var should = chai.should();

var SINKey = bitcore.SINKey;


describe('SINKey', function() {
  it('should initialze the main object', function() {
    should.exist(SINKey);
  });
  it('should be able to create instance', function() {
    var sk = new SINKey();
    sk.generate();
    should.exist(sk.created);
    should.exist(sk.privKey.private);
    should.exist(sk.privKey.public);
    should.exist(sk.privKey.compressed);
  });

  describe('#storeObj', function() {
    it('should give an object', function() {
      var sinkey = new SINKey();
      sinkey.generate();
      var obj = sinkey.storeObj();
      should.exist(obj);
    });
  });
});
