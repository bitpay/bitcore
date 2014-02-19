'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var PrivateKeyModule = bitcore.PrivateKey;
var PrivateKey;

describe('PrivateKey', function() {
  it('should initialze the main object', function() {
    should.exist(PrivateKeyModule);
  });
  it('should be able to create class', function() {
    PrivateKey = PrivateKeyModule.class();
    should.exist(PrivateKey);
  });
  it('should be able to create instance', function() {
    var pk = new PrivateKey();
    should.exist(pk);
  });
});





