'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var RpcClientModule = bitcore.RpcClient;
var RpcClient;
    RpcClient = RpcClientModule;

describe('RpcClient', function() {
  it('should initialze the main object', function() {
    should.exist(RpcClientModule);
  });
  it('should be able to create class', function() {
    should.exist(RpcClient);
  });
  it('should be able to create instance', function() {
    var s = new RpcClient();
    should.exist(s);
  });
});





