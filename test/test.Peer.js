'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var PeerModule = bitcore.Peer;
var Peer;

describe('Peer', function() {
  it('should initialze the main object', function() {
    should.exist(PeerModule);
  });
  it('should be able to create class', function() {
    Peer = PeerModule;
    should.exist(Peer);
  });
  it('should be able to create instance', function() {
    var p = new Peer('localhost', 8333);
    should.exist(p);
  });
});





