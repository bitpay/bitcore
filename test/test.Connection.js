'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var ConnectionModule = bitcore.Connection;
var Connection;
var nop = function() {};

describe('Connection', function() {
  it('should initialze the main object', function() {
    should.exist(ConnectionModule);
  });
  it('should be able to create class', function() {
    Connection = ConnectionModule;
    should.exist(Connection);
  });
  it('should be able to create instance', function() {
    var mSocket = {server: null, addListener: nop},
      mPeer;
    var c = new Connection(mSocket, mPeer);
    should.exist(c);
  });

  if (typeof process !== 'undefined' && process.versions) { //node-only tests
    it('should create a proxied socket if instructed', function() {
      var mPeer;
      var c = new Connection(null, mPeer, {
        proxy: { host: 'localhost', port: 9050 }
      });
      should.exist(c.socket);
    });
  };
});





