'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var ConnectionModule = bitcore.Connection;
var Connection;

describe('Connection', function() {
  it('should initialze the main object', function() {
    should.exist(ConnectionModule);
  });
  it('should be able to create class', function() {
    Connection = ConnectionModule.class();
    should.exist(Connection);
  });
  it('should be able to create instance', function() {
    var mSocket, mPeer;
    var c = new Connection(mSocket, mPeer);
    should.exist(c);
  });
});





