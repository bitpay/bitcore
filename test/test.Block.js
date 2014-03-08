'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var should = chai.should();

var BlockModule = bitcore.Block;
var Block;

describe('Block', function() {
  it('should initialze the main object', function() {
    should.exist(BlockModule);
  });
  it('should be able to create class', function() {
    Block = BlockModule;
    should.exist(Block);
  });
  it('should be able to create instance', function() {
    var p = new Block();
    should.exist(p);
  });
});





